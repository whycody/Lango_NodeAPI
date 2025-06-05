import { Router } from 'express';
import WordSuggestion from '../models/WordSuggestion';
import authenticate from '../middleware/auth';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { fetchNewWordsSuggestions } from "../services/gpt";
import { endGeneration, isGenerationInProgress, startGeneration } from "../services/wordGenerationLock";
import Word from "../models/Word";

const router = Router();

const MAX_MIN_DISPLAYED = 20;

router.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId ?? '';
  const { since, firstLang, secondLang } = req.query;

  if (typeof firstLang !== 'string' || typeof secondLang !== 'string') {
    return res.status(400).json({ error: 'firstLang and secondLang query params are required' });
  }

  const baseQuery: any = { userId, skipped: false, firstLang, secondLang };
  if (since) {
    baseQuery.updatedAt = { $gt: new Date(since as string) };
  }

  let suggestions = await WordSuggestion.find(baseQuery).lean();

  if (suggestions.length >= MAX_MIN_DISPLAYED) {
    res.json(suggestions.map(s => ({ ...s, id: s._id, _id: undefined })));
    generateSuggestionsInBackground(userId, firstLang, secondLang);
    return;
  }

  await generateSuggestionsInBackground(userId, firstLang, secondLang);
  suggestions = await WordSuggestion.find(baseQuery).lean();
  res.json(suggestions.map(s => ({ ...s, id: s._id, _id: undefined })));
});

async function generateSuggestionsInBackground(userId: string, firstLang: string, secondLang: string) {
  const key = `${userId}_${firstLang}_${secondLang}`;
  if (isGenerationInProgress(key)) return;

  startGeneration(key);

  try {
    const last20Words = await Word.find({ userId, firstLang: firstLang, secondLang: secondLang })
      .sort({ addDate: -1 })
      .limit(50)
      .lean();

    if (!last20Words.length) return;

    const contextWords = last20Words.map(w => w.text);
    const generatedSuggestions = await fetchNewWordsSuggestions(firstLang, secondLang, contextWords);

    const existingWords = await Word.find({ userId, firstLang, secondLang }).lean();
    const existingSuggestions = await WordSuggestion.find({ userId, firstLang, secondLang }).lean();

    const allKnownWords = new Set([
      ...existingWords.map(w => w.text.toLowerCase()),
      ...existingSuggestions.map(s => s.word.toLowerCase()),
    ]);

    const newSuggestions = generatedSuggestions
      .filter(s => !allKnownWords.has(s.word.toLowerCase()))
      .slice(0, 30)
      .map(s => ({
        _id: uuidv4(),
        userId,
        word: s.word,
        translation: s.translation,
        firstLang,
        secondLang,
        displayCount: 0,
        skipped: false,
        updatedAt: new Date(),
      }));

    if (newSuggestions.length) {
      await WordSuggestion.create(newSuggestions);
    }
  } catch (error) {
    console.error("Error generating suggestions in background:", error);
  } finally {
    endGeneration(key);
  }
}

export default router;