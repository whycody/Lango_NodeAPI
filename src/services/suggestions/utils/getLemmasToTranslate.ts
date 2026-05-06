import { LanguageCodeValue } from '../../../constants/languageCodes';
import { SUGGESTIONS_TO_INSERT, SUGGESTIONS_TO_TRANSLATE } from '../../../constants/suggestions';
import Lemma from '../../../models/lemmas/Lemma';
import { LemmaAttrWithId } from '../../../types/models/LemmaAttr';

export async function getLemmasToTranslate(
    suggestedLemmas: LemmaAttrWithId[],
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    medianFreq: number,
    limit: number = SUGGESTIONS_TO_TRANSLATE,
): Promise<LemmaAttrWithId[]> {
    const validCount = suggestedLemmas.filter(l =>
        l.validTranslationsLanguages.includes(translationLang),
    ).length;

    if (validCount >= SUGGESTIONS_TO_INSERT) return [];

    const untranslated = suggestedLemmas.filter(
        l =>
            !l.validTranslationsLanguages.includes(translationLang) &&
            !l.invalidTranslationsLanguages.includes(translationLang),
    );

    if (untranslated.length >= limit) return untranslated.slice(0, limit);

    const additionalNeeded = limit - untranslated.length;
    const suggestedIds = suggestedLemmas.map(l => l._id);

    const additionalCandidates = await Lemma.aggregate<LemmaAttrWithId>([
        {
            $match: {
                _id: { $nin: suggestedIds },
                invalidTranslationsLanguages: { $ne: translationLang },
                lang: mainLang,
                validTranslationsLanguages: { $ne: translationLang },
            },
        },
        { $addFields: { freqDistance: { $abs: { $subtract: ['$freqZ', medianFreq] } } } },
        { $sort: { freqDistance: 1 } },
        { $limit: additionalNeeded },
    ]);

    return [...untranslated, ...additionalCandidates];
}
