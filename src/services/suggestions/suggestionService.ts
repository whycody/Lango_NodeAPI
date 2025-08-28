import WordSuggestion from '../../models/Suggestion';
import { generateSuggestionsInBackground } from '../generation/suggestionsGenerator';

const MAX_MIN_DISPLAYED = 20;

export async function getSuggestionsForUser(userId: string, mainLang: string, translationLang: string, since?: string) {
  const baseQuery: any = { userId, skipped: false, mainLang, translationLang };
  let allSuggestions = await WordSuggestion.find(baseQuery).lean();
  const displayedLessThan3 = allSuggestions.filter(s => s.displayCount <= 3).length;

  if (since) baseQuery.updatedAt = { $gt: new Date(since) };

  if (allSuggestions.length >= MAX_MIN_DISPLAYED) {
    if (displayedLessThan3 <= MAX_MIN_DISPLAYED) {
      generateSuggestionsInBackground(userId, mainLang, translationLang);
    }
    return allSuggestions.map(cleanSuggestion);
  }

  await generateSuggestionsInBackground(userId, mainLang, translationLang);
  let updatedSuggestions = await WordSuggestion.find(baseQuery).lean();
  return updatedSuggestions.map(cleanSuggestion);
}

function cleanSuggestion(s: any) {
  return { ...s, id: s._id, _id: undefined };
}