import { Router, Request, Response } from 'express';
import authenticate from '../middleware/auth';
import { getSuggestionsForUser } from '../services/suggestions/suggestionService';
import WordSuggestion from "../models/Suggestion";

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { since, mainLang, translationLang } = req.query;

  if (typeof mainLang !== 'string' || typeof translationLang !== 'string') {
    return res.status(400).json({ error: 'mainLang and translationLang query params are required' });
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
  const clientSuggestions = req.body;
  const syncedSuggestions = [];

  for (const suggestion of clientSuggestions) {
    try {
      const existingSuggestion = await WordSuggestion.findOne({ _id: suggestion.id, userId });

      if (existingSuggestion && new Date(suggestion.locallyUpdatedAt) < new Date(existingSuggestion.updatedAt)) {
        continue;
      }

      const updatedSuggestion = await WordSuggestion.findOneAndUpdate(
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