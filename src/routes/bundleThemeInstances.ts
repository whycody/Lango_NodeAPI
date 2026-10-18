import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isLanguageCodeValue, LanguageCodeValue } from '../constants/languageCodes';
import authenticate from '../middleware/auth';
import requireAdmin from '../middleware/requireAdmin';
import BundleThemeInstance from '../models/core/BundleThemeInstance';
import Word from '../models/core/Word';
import WordsBundle from '../models/core/WordsBundle';
import { translateWords } from '../services/suggestions/translateWords';
import { saveGPTReport } from '../services/suggestions/utils/reports/saveGPTReport';
import { withGenerationLock } from '../services/suggestions/utils/withGenerationLock';
import { hasDuplicateWords } from '../services/utils/hasDuplicateWords';
import { withIdField } from '../services/utils/withIdField';

const router = Router();

const isNonEmptyStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(entry => typeof entry === 'string' && entry.trim().length > 0);

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const { mainLang, themeId, words } = req.body as {
        themeId?: string;
        mainLang?: string;
        words?: string[];
    };

    if (typeof themeId !== 'string' || !themeId.trim()) {
        return res.status(400).json({ error: 'themeId is required' });
    }

    if (!isLanguageCodeValue(mainLang)) {
        return res.status(400).json({ error: 'mainLang must be a valid language code' });
    }

    if (!isNonEmptyStringArray(words)) {
        return res.status(400).json({ error: 'words must be a non-empty array of strings' });
    }

    if (hasDuplicateWords(words)) {
        return res.status(400).json({ error: 'words must not contain duplicate entries' });
    }

    try {
        const instance = await BundleThemeInstance.create({
            mainLang,
            themeId,
            words,
            wordsGeneratedAt: new Date(),
        });

        res.status(201).json(withIdField(instance.toObject()));
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return res.status(409).json({
                error: 'An instance for this theme and mainLang already exists',
            });
        }

        console.error('Failed to create bundle theme instance:', error);
        res.status(500).json({ error: 'Failed to create bundle theme instance' });
    }
});

const isWordChangeArray = (value: unknown): value is { old: string; new: string }[] =>
    Array.isArray(value) &&
    value.every(
        entry =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { old?: unknown }).old === 'string' &&
            typeof (entry as { new?: unknown }).new === 'string',
    );

const REGENERATE_BASE_LOCK_TTL_SECONDS = 60;
const REGENERATE_PER_WORD_LOCK_TTL_SECONDS = 2;

router.patch('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { regenerateExisting, wordChanges, words } = req.body as {
        words?: string[];
        regenerateExisting?: boolean;
        wordChanges?: unknown;
    };

    if (!isNonEmptyStringArray(words)) {
        return res.status(400).json({ error: 'words must be a non-empty array of strings' });
    }

    if (hasDuplicateWords(words)) {
        return res.status(400).json({ error: 'words must not contain duplicate entries' });
    }

    if (regenerateExisting && !isWordChangeArray(wordChanges)) {
        return res.status(400).json({
            error: 'wordChanges must be an array of { old, new } pairs when regenerateExisting is true',
        });
    }

    try {
        const instance = await BundleThemeInstance.findByIdAndUpdate(
            id,
            { $set: { words, wordsGeneratedAt: new Date() } },
            { new: true },
        );

        if (!instance) {
            return res.status(404).json({ error: 'Bundle theme instance not found' });
        }

        if (!regenerateExisting || !isWordChangeArray(wordChanges) || wordChanges.length === 0) {
            return res.json(withIdField(instance.toObject()));
        }

        const failedTranslationLangs = await regenerateExistingBundles(
            String(instance._id),
            instance.mainLang,
            wordChanges,
        );

        res.json({
            ...withIdField(instance.toObject()),
            failedTranslationLangs,
        });
    } catch (error) {
        console.error('Failed to update bundle theme instance:', error);
        res.status(500).json({ error: 'Failed to update bundle theme instance' });
    }
});

async function regenerateExistingBundles(
    themeInstanceId: string,
    mainLang: LanguageCodeValue,
    wordChanges: { old: string; new: string }[],
): Promise<string[]> {
    // Pending bundles get the updated instance words on lazy generation, so only bundles whose
    // words already exist need patching.
    const bundles = await WordsBundle.find({
        removed: false,
        themeInstanceId,
        wordsGenerated: true,
    }).lean();
    const failedTranslationLangs: string[] = [];

    const newTexts = wordChanges.map(change => change.new);
    const lockTTLSeconds =
        REGENERATE_BASE_LOCK_TTL_SECONDS + newTexts.length * REGENERATE_PER_WORD_LOCK_TTL_SECONDS;

    for (const bundle of bundles) {
        const lockKey = `theme-bundle_${bundle._id}`;

        try {
            const acquired = await withGenerationLock(
                lockKey,
                async () => {
                    const { fetchMetadata, translations } = await translateWords(
                        mainLang,
                        bundle.translationLang,
                        newTexts,
                    );

                    await saveGPTReport(fetchMetadata);

                    const translationByNewText = new Map(
                        translations
                            .filter(item => item.isValid && item.translations.length > 0)
                            .map(item => [item.source, item.translations.join(', ')]),
                    );

                    for (const change of wordChanges) {
                        const translation = translationByNewText.get(change.new);

                        if (!translation) {
                            continue;
                        }

                        const existingWord = await Word.findOne({
                            bundleId: bundle._id,
                            removed: false,
                            source: 'lango',
                            text: change.old,
                        });

                        if (existingWord) {
                            existingWord.text = change.new;
                            existingWord.translation = translation;
                            existingWord.updatedAt = new Date();
                            await existingWord.save();
                            continue;
                        }

                        await Word.create({
                            _id: uuidv4(),
                            bundleId: bundle._id,
                            mainLang,
                            source: 'lango',
                            text: change.new,
                            translation,
                            translationLang: bundle.translationLang,
                            userId: bundle.ownerId,
                        });
                    }
                },
                lockTTLSeconds,
            );

            if (!acquired) {
                failedTranslationLangs.push(bundle.translationLang);
            }
        } catch (error) {
            console.error(
                `Failed to regenerate words for bundle ${bundle._id} (${bundle.translationLang}):`,
                error,
            );
            failedTranslationLangs.push(bundle.translationLang);
        }
    }

    return failedTranslationLangs;
}

export default router;
