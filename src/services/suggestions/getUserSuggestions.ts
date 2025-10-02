import { generateSuggestionsInBackground } from "./generateSuggestions";
import { LanguageCodeValue } from "../../constants/languageCodes";
import Suggestion from "../../models/core/Suggestion";

const MAX_MIN_DISPLAYED = 20;

export async function getSuggestionsForUser(userId: string, mainLang: LanguageCodeValue, translationLang: LanguageCodeValue, since?: string) {
  const baseQuery: any = { userId, mainLang, translationLang };
  const allSuggestions = await Suggestion.find(baseQuery).lean();
  const activeSuggestions = allSuggestions.filter(s => !s.skipped && !s.added);
  const displayedLessThan3 = activeSuggestions.filter(s => s.displayCount <= 3).length;

  if (since) baseQuery.updatedAt = { $gt: new Date(since) };

  if (activeSuggestions.length >= MAX_MIN_DISPLAYED) {
    if (displayedLessThan3 <= MAX_MIN_DISPLAYED) {
      generateSuggestionsInBackground(userId, mainLang, translationLang);
    }
    return allSuggestions.filter(s => !since || new Date(s.updatedAt) > new Date(since)).map(cleanSuggestion);
  }

  await generateSuggestionsInBackground(userId, mainLang, translationLang);
  let updatedSuggestions = await Suggestion.find(baseQuery).lean();
  return updatedSuggestions.map(cleanSuggestion);
}

function cleanSuggestion(s: any) {
  return { ...s, id: s._id, _id: undefined, __v: undefined, lemma: undefined, translationId: null };
}