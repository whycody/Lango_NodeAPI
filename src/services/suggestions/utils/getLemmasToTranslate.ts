import { Types } from 'mongoose';

import { LanguageCodeValue } from '../../../constants/languageCodes';
import { SUGGESTIONS_TO_INSERT, SUGGESTIONS_TO_TRANSLATE } from '../../../constants/suggestions';
import Lemma from '../../../models/lemmas/Lemma';
import LemmaTranslation from '../../../models/lemmas/LemmaTranslation';

export async function getLemmasIdsToTranslate(
    lemmaIds: string[],
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    medianFreq: number,
    limit: number = SUGGESTIONS_TO_TRANSLATE,
): Promise<string[]> {
    const lemmaObjectIds = lemmaIds.map(id => new Types.ObjectId(id));

    const lemmaTranslations = await LemmaTranslation.find({
        lemmaId: { $in: lemmaObjectIds },
        translationLang,
    }).lean();

    const alreadyTranslatedLemmaIds = new Set(lemmaTranslations.map(doc => doc.lemmaId.toString()));

    const validLemmaTranslationsCount = lemmaTranslations.filter(t => !!t.translation).length;
    const untranslatedLemmaIds = lemmaIds.filter(id => !alreadyTranslatedLemmaIds.has(id));

    if (validLemmaTranslationsCount >= SUGGESTIONS_TO_INSERT) return [];

    const additionalTranslationsNeeded = Math.max(limit - untranslatedLemmaIds.length, 0);
    let lemmasIdsToTranslate: string[] = [];

    if (additionalTranslationsNeeded > 0) {
        const alreadyTranslatedLemmaIds = await LemmaTranslation.distinct('lemmaId', {
            translationLang,
        });

        const additionalCandidates = await Lemma.aggregate([
            {
                $match: {
                    _id: { $nin: alreadyTranslatedLemmaIds },
                    lang: mainLang,
                },
            },
            {
                $addFields: {
                    freqDistance: {
                        $abs: { $subtract: [{ $ifNull: ['$freq_z', 0] }, medianFreq] },
                    },
                },
            },
            { $sort: { freqDistance: 1 } },
            { $limit: additionalTranslationsNeeded },
        ]);

        lemmasIdsToTranslate = additionalCandidates.map(l => l._id.toString());
    }

    return [...untranslatedLemmaIds, ...lemmasIdsToTranslate];
}
