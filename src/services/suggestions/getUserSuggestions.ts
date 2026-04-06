import { generateSuggestionsInBackground } from "./generateSuggestions";
import { LanguageCodeValue } from "../../constants/languageCodes";
import Suggestion from "../../models/core/Suggestion";
import {
  MIN_NUMBER_OF_SUGGESTIONS,
  MAX_SUGGESTIONS_DISPLAY_COUNT,
} from "../../constants/suggestions";

export async function getSuggestionsForUser(
  userId: string,
  mainLang: LanguageCodeValue,
  translationLang: LanguageCodeValue,
  since?: string,
) {
  const baseQuery: any = { userId, mainLang, translationLang };
  const allSuggestions = await Suggestion.find(baseQuery).lean();
  const activeSuggestions = allSuggestions.filter(
    (s) => !s.skipped && !s.added,
  );
  const displayedLessThanLimit = activeSuggestions.filter(
    (s) => s.displayCount <= MAX_SUGGESTIONS_DISPLAY_COUNT,
  ).length;

  if (since) baseQuery.updatedAt = { $gt: new Date(since) };

  if (activeSuggestions.length >= MIN_NUMBER_OF_SUGGESTIONS) {
    if (displayedLessThanLimit <= MIN_NUMBER_OF_SUGGESTIONS) {
      generateSuggestionsInBackground(userId, mainLang, translationLang);
    }
    return allSuggestions
      .filter((s) => !since || new Date(s.updatedAt) > new Date(since))
      .map(cleanSuggestion);
  }

  await generateSuggestionsInBackground(userId, mainLang, translationLang);
  let updatedSuggestions = await Suggestion.find(baseQuery).lean();
  return updatedSuggestions.map(cleanSuggestion);
}

function cleanSuggestion(s: any) {
  return {
    ...s,
    id: s._id,
    _id: undefined,
    __v: undefined,
    lemma: undefined,
    translationId: null,
  };
}
