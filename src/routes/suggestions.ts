import { Request, Response, Router } from 'express';
import authenticate from '../middleware/auth';
import { getSuggestionsForUser } from '../services/suggestions/getUserSuggestions';
import { isLanguageCodeValue } from "../constants/languageCodes";
import Suggestion from "../models/core/Suggestion";
import { SuggestionAttr } from "../types/models/SuggestionAttr";
import { updateLemmaTranslationCounts } from "../services/utils/translationService";

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { since, mainLang, translationLang } = req.query;

  if (!isLanguageCodeValue(mainLang) || !isLanguageCodeValue(translationLang)) {
    return res.status(400).json({ error: 'mainLang and translationLang must be valid language codes' });
  }

  try {
    const suggestions = await getSuggestionsForUser(userId, mainLang, translationLang, since as string | undefined);
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId ?? '';
  const clientSuggestions: (SuggestionAttr & { id: string, locallyUpdatedAt: number })[] = req.body;
  const syncedSuggestions = [];

  for (const suggestion of clientSuggestions) {
    try {
      const existingSuggestion = await Suggestion.findOne({ _id: suggestion.id, userId });

      if (existingSuggestion && new Date(suggestion.locallyUpdatedAt) < new Date(existingSuggestion.updatedAt)) {
        continue;
      }

      if (existingSuggestion && (suggestion.added !== existingSuggestion?.added || suggestion.skipped !== existingSuggestion?.skipped)) {
        await updateLemmaTranslationCounts(existingSuggestion, suggestion);
      }

      const updatedSuggestion = await Suggestion.findOneAndUpdate(
        { _id: suggestion.id, userId },
        { $set: { ...suggestion, updatedAt: nowUTC() } },
        { upsert: true, new: true }
      );

      syncedSuggestions.push({ id: updatedSuggestion._id, updatedAt: updatedSuggestion.updatedAt });
    } catch (error) {
      console.error(`Failed to sync suggestion ${suggestion.id}:`, error);
    }
  }

  res.json(syncedSuggestions);
});

export default router;