import WordSuggestion from '../../models/WordSuggestion';
import { generateSuggestionsInBackground } from '../generation/suggestionsGenerator';

const MAX_MIN_DISPLAYED = 20;

export async function getSuggestionsForUser(userId: string, firstLang: string, secondLang: string, since?: string) {
  const baseQuery: any = { userId, skipped: false, firstLang, secondLang };
  if (since) baseQuery.updatedAt = { $gt: new Date(since) };

  let suggestions = await WordSuggestion.find(baseQuery).lean();
  const displayedLessThan3 = suggestions.filter(s => s.displayCount <= 3).length;

  if (suggestions.length >= MAX_MIN_DISPLAYED) {
    if (displayedLessThan3 <= MAX_MIN_DISPLAYED) {
      generateSuggestionsInBackground(userId, firstLang, secondLang);
    }
    return suggestions.map(cleanSuggestion);
  }

  await generateSuggestionsInBackground(userId, firstLang, secondLang);
  suggestions = await WordSuggestion.find(baseQuery).lean();
  return suggestions.map(cleanSuggestion);
}

function cleanSuggestion(s: any) {
  return { ...s, id: s._id, _id: undefined };
}