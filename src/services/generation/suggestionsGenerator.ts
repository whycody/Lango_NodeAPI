import { v4 as uuidv4 } from 'uuid';
import { endGeneration, isGenerationInProgress, startGeneration } from "./generationLock";
import Word from "../../models/Word";
import WordSuggestion from "../../models/WordSuggestion";
import DefaultSuggestion from "../../models/DefaultSuggestion";
import { fetchNewWordsSuggestions } from "./gptClient";
import { logPromptReport } from "./promptLogger";

export async function generateSuggestionsInBackground(userId: string, firstLang: string, secondLang: string) {
  const key = `${userId}_${firstLang}_${secondLang}`;
  if (isGenerationInProgress(key)) return;

  startGeneration(key);

  try {
    const userWords = await Word.find({ userId, firstLang, secondLang }).lean();
    if (userWords.length === 0) {
      await generateSuggestionsWithoutUserWords(userId, firstLang, secondLang);
    } else {
      await generateSuggestionsWithUserWords(userId, firstLang, secondLang, userWords);
    }
  } catch (error) {
    console.error("Error generating suggestions in background:", error);
  } finally {
    endGeneration(key);
  }
}

async function generateSuggestionsWithoutUserWords(userId: string, firstLang: string, secondLang: string) {
  const userSuggestions = await WordSuggestion.find({ userId, firstLang, secondLang }).lean();
  const knownWords = new Set([
    ...userSuggestions.map(s => s.word.toLowerCase()),
  ]);

  const defaults = await DefaultSuggestion.find({ firstLang, secondLang }).lean();
  const unseenDefaults = defaults.filter(d => d.word && !knownWords.has(d.word.toLowerCase()));

  if (unseenDefaults.length > 0) {
    await createUserSuggestionsFromDefaults(unseenDefaults, userId, firstLang, secondLang);
  } else {
    await generateFromGptAndStore(userId, firstLang, secondLang, knownWords);
  }
}

async function createUserSuggestionsFromDefaults(defaults: any[], userId: string, firstLang: string, secondLang: string) {
  const newSuggestions = defaults.slice(0, 30).map(d => ({
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
  await WordSuggestion.insertMany(newSuggestions);
}

async function generateFromGptAndStore(userId: string, firstLang: string, secondLang: string, knownWords: Set<string>) {
  const generated = await fetchNewWordsSuggestions(firstLang, secondLang, Array.from(knownWords), true);

  const existingDefaults = await DefaultSuggestion.find({ firstLang, secondLang }).lean();
  const existingUserWords = await Word.find({ userId, firstLang, secondLang }).lean();
  const existingUserSuggestions = await WordSuggestion.find({ userId, firstLang, secondLang }).lean();

  const allKnown = new Set([
    ...existingDefaults.map(d => d.word?.toLowerCase()),
    ...existingUserWords.map(w => w.text.toLowerCase()),
    ...existingUserSuggestions.map(s => s.word.toLowerCase()),
  ]);

  const uniqueGenerated = generated.words.filter(w => w.word && !allKnown.has(w.word.toLowerCase()));

  await logPromptReport({
    ...generated.metadata,
    addedWords: uniqueGenerated.map((suggestion) => suggestion.word),
    firstLang,
    secondLang,
    userId,
  });

  if (uniqueGenerated.length > 0) {
    await DefaultSuggestion.insertMany(uniqueGenerated.map(w => ({
      word: w.word,
      translation: w.translation,
      firstLang,
      secondLang,
    })));

    await WordSuggestion.insertMany(uniqueGenerated.map(w => ({
      _id: uuidv4(),
      userId,
      word: w.word,
      translation: w.translation,
      firstLang,
      secondLang,
      displayCount: 0,
      skipped: false,
      updatedAt: new Date(),
    })));
  }
}

async function generateSuggestionsWithUserWords(userId: string, firstLang: string, secondLang: string, userWords: any[]) {
  const contextWords = userWords
    .sort((a, b) => (b.addDate?.getTime() ?? 0) - (a.addDate?.getTime() ?? 0))
    .slice(0, 50)
    .map(w => w.text);

  const generated = await fetchNewWordsSuggestions(firstLang, secondLang, contextWords);

  const existingDefaults = await DefaultSuggestion.find({ firstLang, secondLang }).lean();
  const existingWords = await Word.find({ userId, firstLang, secondLang }).lean();
  const existingSuggestions = await WordSuggestion.find({ userId, firstLang, secondLang }).lean();
  const known = new Set([
    ...existingDefaults.map(d => d.word?.toLowerCase()),
    ...existingWords.map(w => w.text.toLowerCase()),
    ...existingSuggestions.map(s => s.word.toLowerCase()),
  ]);

  const newSuggestions = generated.words
    .filter(s => !known.has(s.word.toLowerCase()))
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

  await logPromptReport({
    ...generated.metadata,
    addedWords: newSuggestions.map((suggestion) => suggestion.word),
    firstLang,
    secondLang,
    userId,
  });

  if (newSuggestions.length) {
    await WordSuggestion.insertMany(newSuggestions);
  }
}