import LemmaTranslation from "../../models/lemmas/LemmaTranslation";
import { SuggestionAttr } from "../../types/models/SuggestionAttr";

export const updateLemmaTranslationCounts = async (existingSuggestion: SuggestionAttr, suggestion: SuggestionAttr) => {
  const existingTranslation = await LemmaTranslation.findOne({
    lemmaId: existingSuggestion.lemmaId,
    translationLang: existingSuggestion.translationLang,
  });

  if (!existingTranslation) return;

  const updateCount = (prev: boolean | undefined, next: boolean, field: 'addCount' | 'skipCount') => {
    if (!prev && next) existingTranslation[field] = (existingTranslation[field] ?? 0) + 1;
    if (prev && !next) existingTranslation[field] = (existingTranslation[field] ?? 0) - 1;
  };

  updateCount(existingSuggestion.added, suggestion.added, 'addCount');
  updateCount(existingSuggestion.skipped, suggestion.skipped, 'skipCount');

  await existingTranslation.save();
};
