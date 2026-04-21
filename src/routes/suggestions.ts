import { Request, Response, Router } from 'express';

import { isLanguageCodeValue } from '../constants/languageCodes';
import { SUGGESTIONS_TO_INSERT } from '../constants/suggestions';
import authenticate from '../middleware/auth';
import requireAdmin from '../middleware/requireAdmin';
import Suggestion from '../models/core/Suggestion';
import { getSuggestionsForUser } from '../services/suggestions/getUserSuggestions';
import { populateLemmaTranslations } from '../services/suggestions/populateLemmaTranslations';
import { mergeSuggestionFlags } from '../services/utils/mergeSuggestionFlags';
import { updateLemmaTranslationCounts } from '../services/utils/translationService';
import { SuggestionAttr } from '../types/models/SuggestionAttr';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { mainLang, since, translationLang } = req.query;

    if (!isLanguageCodeValue(mainLang) || !isLanguageCodeValue(translationLang)) {
        return res
            .status(400)
            .json({ error: 'mainLang and translationLang must be valid language codes' });
    }

    try {
        const suggestions = await getSuggestionsForUser(
            userId,
            mainLang,
            translationLang,
            since as string | undefined,
        );
        res.json(suggestions);
    } catch (err) {
        console.error('Failed to get suggestions:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const clientSuggestions: (SuggestionAttr & { id: string; locallyUpdatedAt: number })[] =
        req.body;
    const syncedSuggestions = [];

    for (const suggestion of clientSuggestions) {
        try {
            const existing = await Suggestion.findOne({ _id: suggestion.id, userId });
            const now = nowUTC();

            if (existing) {
                const mergedFlags = mergeSuggestionFlags(existing, suggestion);
                const providedSuggestionLocallyUpdatedAt = new Date(suggestion.locallyUpdatedAt);
                const existingSuggestionUpdatedAt = new Date(existing.updatedAt);

                const shouldUpdate =
                    mergedFlags.added !== existing.added ||
                    mergedFlags.skipped !== existing.skipped ||
                    providedSuggestionLocallyUpdatedAt > existingSuggestionUpdatedAt;

                const updatingSuggestion =
                    providedSuggestionLocallyUpdatedAt > existingSuggestionUpdatedAt
                        ? suggestion
                        : { id: suggestion.id };

                if (shouldUpdate) {
                    await updateLemmaTranslationCounts(existing, suggestion);

                    const updated = await Suggestion.findOneAndUpdate(
                        { _id: updatingSuggestion.id, userId },
                        { $set: { ...updatingSuggestion, ...mergedFlags, updatedAt: now } },
                        { new: true, upsert: true },
                    );
                    syncedSuggestions.push({ id: updated?._id, updatedAt: updated?.updatedAt });
                }

                continue;
            }

            const created = await Suggestion.findOneAndUpdate(
                { _id: suggestion.id, userId },
                { $set: { ...suggestion, updatedAt: now } },
                { new: true, upsert: true },
            );

            syncedSuggestions.push({ id: created._id, updatedAt: created.updatedAt });
        } catch (error) {
            console.error(`Failed to sync suggestion ${suggestion.id}:`, error);
        }
    }

    res.json(syncedSuggestions);
});

router.post(
    '/admin/populate-translations',
    authenticate,
    requireAdmin,
    async (req: Request, res: Response) => {
        const count = Number(req.query.count);
        const skipLimit = req.query.skipLimit === 'true';

        if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
            return res.status(400).json({ error: 'count must be a positive integer' });
        }

        if (!skipLimit && count > SUGGESTIONS_TO_INSERT) {
            return res.status(400).json({
                error: `count must not exceed ${SUGGESTIONS_TO_INSERT} (pass skipLimit=true to override)`,
            });
        }

        req.setTimeout(0);

        try {
            const results = await populateLemmaTranslations(count);
            res.json({ results });
        } catch (err) {
            console.error(
                'Failed to populate translations:',
                err instanceof Error ? err.message : err,
            );
            res.status(500).json({ error: 'Failed to populate translations' });
        }
    },
);

export default router;
