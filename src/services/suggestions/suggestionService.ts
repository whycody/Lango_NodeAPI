import WordSuggestion from '../../models/Suggestion';
import { generateSuggestionsInBackground } from '../generation/suggestionsGenerator';

const MAX_MIN_DISPLAYED = 20;

export async function getSuggestionsForUser(userId: string, firstLang: string, secondLang: string, since?: string) {
  const baseQuery: any = { userId, skipped: false, firstLang, secondLang };
  let allSuggestions = await WordSuggestion.find(baseQuery).lean();
  const displayedLessThan3 = allSuggestions.filter(s => s.displayCount <= 3).length;

  if (since) baseQuery.updatedAt = { $gt: new Date(since) };

  if (allSuggestions.length >= MAX_MIN_DISPLAYED) {
    if (displayedLessThan3 <= MAX_MIN_DISPLAYED) {
      generateSuggestionsInBackground(userId, firstLang, secondLang);
    }
    return allSuggestions.map(cleanSuggestion);
  }

  await generateSuggestionsInBackground(userId, firstLang, secondLang);
  let updatedSuggestions = await WordSuggestion.find(baseQuery).lean();
  return updatedSuggestions.map(cleanSuggestion);
}

function cleanSuggestion(s: any) {
  return { ...s, id: s._id, _id: undefined };
}