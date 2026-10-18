import { HydratedDocument, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import BundleThemeInstance from '../../models/core/BundleThemeInstance';
import Word from '../../models/core/Word';
import WordsBundle from '../../models/core/WordsBundle';
import { translateWords } from '../suggestions/translateWords';
import { saveGPTReport } from '../suggestions/utils/reports/saveGPTReport';
import { withGenerationLock } from '../suggestions/utils/withGenerationLock';

const ENSURE_WORDS_BASE_LOCK_TTL_SECONDS = 60;
const ENSURE_WORDS_PER_WORD_LOCK_TTL_SECONDS = 2;

type WordsBundleDocument = HydratedDocument<InstanceType<typeof WordsBundle>>;

const findBundleWords = (bundleId: unknown) => Word.find({ bundleId, removed: false }).lean();

export type EnsureBundleWordsResult =
    | { status: 'ready'; words: Awaited<ReturnType<typeof findBundleWords>> }
    | { status: 'locked' }
    | { status: 'failed' }
    | { status: 'not-a-theme-bundle' }
    | { status: 'misconfigured' };

export async function ensureBundleWordsGenerated(
    bundle: WordsBundleDocument,
): Promise<EnsureBundleWordsResult> {
    if (!bundle.themeInstanceId) {
        return { status: 'not-a-theme-bundle' };
    }

    if (bundle.wordsGenerated) {
        const words = await findBundleWords(bundle._id);
        return { status: 'ready', words };
    }

    const instance = await BundleThemeInstance.findById(bundle.themeInstanceId).lean();

    if (!instance) {
        console.error(`Theme instance ${bundle.themeInstanceId} missing for bundle ${bundle._id}`);
        return { status: 'misconfigured' };
    }

    if (!process.env.ADMIN_USER_ID) {
        console.error('ADMIN_USER_ID is not configured');
        return { status: 'misconfigured' };
    }

    const lockKey = `theme-bundle_${bundle._id}`;
    const lockTTLSeconds =
        ENSURE_WORDS_BASE_LOCK_TTL_SECONDS +
        instance.words.length * ENSURE_WORDS_PER_WORD_LOCK_TTL_SECONDS;

    let generationFailed = false;

    const acquired = await withGenerationLock(
        lockKey,
        async () => {
            const refreshedBundle = await WordsBundle.findById(bundle._id);

            if (refreshedBundle?.wordsGenerated) {
                return;
            }

            const { fetchMetadata, translations } = await translateWords(
                instance.mainLang,
                bundle.translationLang,
                instance.words,
            );

            await saveGPTReport(fetchMetadata);

            if (translations.length === 0) {
                generationFailed = true;
                return;
            }

            const adminUserId = new Types.ObjectId(process.env.ADMIN_USER_ID);

            const words = translations
                .filter(item => item.isValid && item.translations.length > 0)
                .map(item => ({
                    _id: uuidv4(),
                    bundleId: bundle._id,
                    mainLang: instance.mainLang,
                    source: 'lango',
                    text: item.source,
                    translation: item.translations.join(', '),
                    translationLang: bundle.translationLang,
                    userId: adminUserId,
                }));

            if (words.length === 0) {
                generationFailed = true;
                return;
            }

            await Word.insertMany(words, { ordered: false });

            await WordsBundle.findByIdAndUpdate(bundle._id, {
                $set: { wordsGenerated: true },
            });
        },
        lockTTLSeconds,
    );

    if (!acquired) {
        return { status: 'locked' };
    }

    if (generationFailed) {
        return { status: 'failed' };
    }

    const words = await findBundleWords(bundle._id);
    return { status: 'ready', words };
}
