import { v4 as uuidv4 } from 'uuid';
import { endGeneration, isGenerationInProgress, startGeneration } from "./generationLock";
import Word from "../../models/Word";
import WordSuggestion from "../../models/Suggestion";
import DefaultSuggestion from "../../models/DefaultSuggestion";
import { fetchNewWordsSuggestions } from "./gptClient";
import { logPromptReport } from "./promptLogger";

export async function generateSuggestionsInBackground(userId: string, mainLang: string, translationLang: string) {
  const key = `${userId}_${mainLang}_${translationLang}`;
  if (isGenerationInProgress(key)) return;

  startGeneration(key);

  try {
    const userWords = await Word.find({ userId, mainLang, translationLang }).lean();
    if (userWords.length === 0) {
      await generateSuggestionsWithoutUserWords(userId, mainLang, translationLang);
    } else {
      await generateSuggestionsWithUserWords(userId, mainLang, translationLang, userWords);
    }
  } catch (error) {
    console.error("Error generating suggestions in background:", error);
  } finally {
    endGeneration(key);
  }
}

async function generateSuggestionsWithoutUserWords(userId: string, mainLang: string, translationLang: string) {
  const userSuggestions = await WordSuggestion.find({ userId, mainLang, translationLang }).lean();
  const knownWords = new Set([
    ...userSuggestions.map(s => s.word.toLowerCase()),
  ]);

  const defaults = await DefaultSuggestion.find({ mainLang, translationLang }).lean();
  const unseenDefaults = defaults.filter(d => d.word && !knownWords.has(d.word.toLowerCase()));

  if (unseenDefaults.length > 0) {
    await createUserSuggestionsFromDefaults(unseenDefaults, userId, mainLang, translationLang);
  } else {
    await generateFromGptAndStore(userId, mainLang, translationLang, knownWords);
  }
}

async function createUserSuggestionsFromDefaults(defaults: any[], userId: string, mainLang: string, trasnlationLang: string) {
  const newSuggestions = defaults.slice(0, 30).map(d => ({
    _id: uuidv4(),
    userId,
    word: d.word!,
    translation: d.translation!,
    mainLang,
    trasnlationLang,
    displayCount: 0,
    skipped: false,
    updatedAt: new Date(),
  }));
  await WordSuggestion.insertMany(newSuggestions);
}

async function generateFromGptAndStore(userId: string, mainLang: string, translationLang: string, knownWords: Set<string>) {
  const generated = await fetchNewWordsSuggestions(mainLang, translationLang, Array.from(knownWords), true);

  const [defaults, words, suggestions] = await Promise.all([
    DefaultSuggestion.find({ mainLang, translationLang }).lean(),
    Word.find({ userId, mainLang, translationLang }).lean(),
    WordSuggestion.find({ userId, mainLang, translationLang }).lean(),
  ]);

  const allKnown = new Set([
    ...defaults.map(d => d.word?.toLowerCase()),
    ...words.map(w => w.text.toLowerCase()),
    ...suggestions.map(s => s.word.toLowerCase()),
  ]);

  const uniqueGenerated = (generated.words ?? []).filter(w => w.word && !allKnown.has(w.word.toLowerCase()));

  await logPromptReport({
    ...generated.metadata,
    addedWords: uniqueGenerated.map((suggestion) => suggestion.word),
    mainLang,
    translationLang,
    userId,
  });

  if (uniqueGenerated.length > 0) {
    await DefaultSuggestion.insertMany(uniqueGenerated.map(w => ({
      word: w.word,
      translation: w.translation,
      mainLang: mainLang,
      translationLang: translationLang,
    })));

    await WordSuggestion.insertMany(uniqueGenerated.map(w => ({
      _id: uuidv4(),
      userId,
      word: w.word,
      translation: w.translation,
      mainLang: mainLang,
      translationLang: translationLang,
      displayCount: 0,
      skipped: false,
      updatedAt: new Date(),
    })));
  }
}

async function generateSuggestionsWithUserWords(userId: string, mainLang: string, translationLang: string, userWords: any[]) {
  const contextWords = userWords
    .sort((a, b) => (b.addDate?.getTime() ?? 0) - (a.addDate?.getTime() ?? 0))
    .slice(0, 50)
    .map(w => w.text);

  const generated = await fetchNewWordsSuggestions(mainLang, translationLang, contextWords);

  const existingDefaults = await DefaultSuggestion.find({ mainLang, translationLang }).lean();
  const existingWords = await Word.find({ userId, mainLang, translationLang }).lean();
  const existingSuggestions = await WordSuggestion.find({ userId, mainLang, translationLang }).lean();
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
      mainLang: mainLang,
      translationLang: translationLang,
      displayCount: 0,
      skipped: false,
      updatedAt: new Date(),
    }));

  await logPromptReport({
    ...generated.metadata,
    addedWords: newSuggestions.map((suggestion) => suggestion.word),
    mainLang,
    translationLang,
    userId,
  });

  if (newSuggestions.length) {
    await WordSuggestion.insertMany(newSuggestions);
  }
}