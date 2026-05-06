import Lemma from '../../models/lemmas/Lemma';
import LemmaTranslation from '../../models/lemmas/LemmaTranslation';
import { SuggestionAttr } from '../../types/models/SuggestionAttr';

const delta = (prev: boolean | undefined, next: boolean) =>
    Number(!prev && next) - Number(!!prev && !next);

export const updateLemmaTranslationCounts = async (
    existingSuggestion: SuggestionAttr,
    suggestion: SuggestionAttr,
) => {
    const addCountDelta = delta(existingSuggestion.added, suggestion.added);
    const skipCountDelta = delta(existingSuggestion.skipped, suggestion.skipped);

    if (addCountDelta === 0 && skipCountDelta === 0) return;

    await Promise.all([
        LemmaTranslation.updateOne(
            {
                lemmaId: existingSuggestion.lemmaId,
                translationLang: existingSuggestion.translationLang,
            },
            {
                $inc: { addCount: addCountDelta, skipCount: skipCountDelta },
                $set: { mainLang: existingSuggestion.mainLang },
            },
        ),
        Lemma.updateOne(
            { _id: existingSuggestion.lemmaId },
            { $inc: { addCount: addCountDelta, skipCount: skipCountDelta } },
        ),
    ]);
};
