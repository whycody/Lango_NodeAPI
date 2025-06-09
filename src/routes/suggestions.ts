import { Router } from 'express';
import WordSuggestion from '../models/WordSuggestion';
import authenticate from '../middleware/auth';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { fetchNewWordsSuggestions } from "../services/gpt";
import { endGeneration, isGenerationInProgress, startGeneration } from "../services/wordGenerationLock";
import Word from "../models/Word";
import DefaultSuggestion from "../models/DefaultSuggestion";

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

  const displayedLessThan3 = suggestions.filter(s => s.displayCount <= 3).length;

  if (suggestions.length >= MAX_MIN_DISPLAYED) {
    res.json(suggestions.map(s => ({ ...s, id: s._id, _id: undefined })));

    if (displayedLessThan3 <= MAX_MIN_DISPLAYED) {
      generateSuggestionsInBackground(userId, firstLang, secondLang);
    }
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
    const userWords = await Word.find({ userId, firstLang, secondLang }).lean();

    if (userWords.length === 0) {
      const userSuggestions = await WordSuggestion.find({ userId, firstLang, secondLang }).lean();

      const knownWords = new Set([
        ...userWords.map(w => w.text.toLowerCase()),
        ...userSuggestions.map(s => s.word.toLowerCase()),
      ]);

      let defaults = await DefaultSuggestion.find({ firstLang, secondLang }).lean();

      const unseenDefaults = defaults.filter(
        d => d.word && !knownWords.has(d.word.toLowerCase())
      );

      if (unseenDefaults.length === 0) {
        const generated = await fetchNewWordsSuggestions(firstLang, secondLang, Array.from(knownWords), true);

        const existingDefaults = await DefaultSuggestion.find({ firstLang, secondLang }).lean();
        const existingUserWords = await Word.find({ userId, firstLang, secondLang }).lean();
        const existingUserSuggestions = await WordSuggestion.find({ userId, firstLang, secondLang }).lean();

        const existingDefaultWords = new Set(existingDefaults.map(d => d.word?.toLowerCase()));
        const existingUserWordsSet = new Set([
          ...existingUserWords.map(w => w.text.toLowerCase()),
          ...existingUserSuggestions.map(s => s.word.toLowerCase()),
        ]);

        const uniqueGenerated = generated.filter(
          g =>
            g.word &&
            !existingDefaultWords.has(g.word.toLowerCase()) &&
            !existingUserWordsSet.has(g.word.toLowerCase())
        );

        const newDefaults = uniqueGenerated.map(w => ({
          word: w.word,
          translation: w.translation,
          firstLang,
          secondLang,
        }));

        if (newDefaults.length) {
          await DefaultSuggestion.insertMany(newDefaults);
        }

        const newUserSuggestions = uniqueGenerated.map(w => ({
          _id: uuidv4(),
          userId,
          word: w.word,
          translation: w.translation,
          firstLang,
          secondLang,
          displayCount: 0,
          skipped: false,
          updatedAt: new Date(),
        }));

        if (newUserSuggestions.length) {
          await WordSuggestion.insertMany(newUserSuggestions);
        }
      } else {
        const newUserSuggestions = unseenDefaults.slice(0, 30).map(d => ({
          _id: uuidv4(),
          userId,
          word: d.word!,
          translation: d.translation!,
          firstLang,
          secondLang,
          displayCount: 0,
          skipped: false,
          updatedAt: new Date(),
        }));

        await WordSuggestion.insertMany(newUserSuggestions);
      }

      return;
    }

    const contextWords = userWords
      .sort((a, b) => (b.addDate?.getTime() ?? 0) - (a.addDate?.getTime() ?? 0))
      .slice(0, 50)
      .map(w => w.text);

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
      await WordSuggestion.insertMany(newSuggestions);
    }
  } catch (error) {
    console.error("Error generating suggestions in background:", error);
  } finally {
    endGeneration(key);
  }
}

export default router;