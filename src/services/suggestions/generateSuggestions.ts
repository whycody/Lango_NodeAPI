import { LanguageCodeValue } from '../../constants/languageCodes';
import { SUGGESTIONS_TO_GENERATE } from '../../constants/suggestions';
import Suggestion from '../../models/core/Suggestion';
import User from '../../models/core/User';
import Lemma from '../../models/lemmas/Lemma';
import LemmaTranslation from '../../models/lemmas/LemmaTranslation';
import { SuggestionsRepository } from '../../types/api/SuggestionsRepository';
import { LemmaAttrWithId } from '../../types/models/LemmaAttr';
import { LemmaTranslationAttr } from '../../types/models/LemmaTranslationAttr';
import { SuggestionAttr } from '../../types/models/SuggestionAttr';
import { LemmaUpdate } from '../../types/shared/LemmaUpdate';
import { MatchPair } from '../../types/shared/MatchPair';
import { FastAPISuggestionsRepository } from './repositories/FastAPISuggestionRepository';
import { translateWords } from './translateWords';
import { createLemmaTranslation } from './utils/fabrics/createLemmaTranslation';
import { createSuggestion } from './utils/fabrics/createSuggestion';
import { getLemmasIdsToTranslate } from './utils/getLemmasToTranslate';
import { mapArrayToLemmaTranslations } from './utils/mapToLemmaTranslation';
import { matchTranslationsToLemmas } from './utils/matchTranslationsToLemmas';
import { saveGPTReport } from './utils/reports/saveGPTReport';
import { saveSuggestionsReport } from './utils/reports/saveSuggestionsReport';
import { withGenerationLock } from './utils/withGenerationLock';

export const generateSuggestionsInBackground = async (
    userId: string,
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
) => {
    const key = `${userId}_${mainLang}_${translationLang}`;

    await withGenerationLock(key, async () => {
        const user = await User.findOne({ _id: userId });
        const level = user?.languageLevels.find(l => l.language === mainLang)?.level || 1;
        const suggestionsRepo: SuggestionsRepository = new FastAPISuggestionsRepository();

        const suggestionsResponse = await suggestionsRepo.getUserSuggestions({
            level,
            limit: SUGGESTIONS_TO_GENERATE,
            mainLang,
            translationLang,
            userId,
        });

        const { median_freq: medianFreq, suggested_lemmas_ids: suggestedLemmasIds } =
            suggestionsResponse;

        const suggestedLemmas = await Lemma.find({
            _id: { $in: suggestedLemmasIds },
        }).lean();

        const lemmasIdsToTranslate = await getLemmasIdsToTranslate(
            suggestedLemmasIds,
            mainLang,
            translationLang,
            medianFreq,
            SUGGESTIONS_TO_GENERATE,
        );

        const lemmasToTranslate = await Lemma.find({
            _id: { $in: lemmasIdsToTranslate },
        }).lean<LemmaAttrWithId[]>();

        const translatedLemmasTranslations = await LemmaTranslation.find({
            lemmaId: { $in: suggestedLemmasIds },
            translation: { $ne: null },
            translationLang,
        }).lean();

        const translationMap = new Map(
            translatedLemmasTranslations.map(t => [
                t.lemmaId.toString(),
                { example: t.example ?? null, translation: t.translation },
            ]),
        );

        const suggestionsToInsert: SuggestionAttr[] = suggestedLemmas
            .filter(l => translationMap.has(l._id.toString()))
            .map(l => {
                const entry = translationMap.get(l._id.toString())!;
                return createSuggestion({
                    example: entry.example,
                    lemma: l.lemma,
                    lemmaId: l._id.toString(),
                    mainLang,
                    translation: entry.translation || '',
                    translationLang,
                    userId,
                    word: l.prefix ? `${l.prefix}${l.lemma}` : l.lemma,
                });
            });

        let translationsToInsert: LemmaTranslationAttr[] = [];
        let lemmasToUpdate: LemmaUpdate[] = [];

        if (lemmasToTranslate.length > 0) {
            const wordsToTranslate = lemmasToTranslate.map(l => l.lemma);
            const { fetchMetadata, translations } = await translateWords(
                mainLang,
                translationLang,
                wordsToTranslate,
            );

            const matchedPairs = matchTranslationsToLemmas(translations, lemmasToTranslate);

            await saveGPTReport(fetchMetadata);

            const prepared = prepareInsertData(
                matchedPairs,
                suggestedLemmasIds,
                userId,
                mainLang,
                translationLang,
            );

            translationsToInsert.push(...prepared.translationsToInsert);
            suggestionsToInsert.push(...prepared.suggestionsToInsert);
            lemmasToUpdate.push(...prepared.lemmasToUpdate);
        }

        const insertedTranslations = translationsToInsert.map(t => ({
            translation: t.translation,
            word: lemmasToTranslate.find(l => l._id.toString() === t.lemmaId)?.lemma || '',
        }));

        const insertedSuggestions = suggestionsToInsert.map(s => ({
            translation: s.translation,
            word: s.word,
        }));

        const skippedTranslations = insertedTranslations
            .filter(t => t.translation === null)
            .map(t => t.word);

        await Promise.all([
            saveSuggestionsReport({
                insertedSuggestions,
                insertedTranslations,
                mainLang,
                skippedTranslations,
                translationLang,
                updatedLemmas: lemmasToUpdate,
                userId,
            }),
            translationsToInsert.length > 0
                ? LemmaTranslation.insertMany(mapArrayToLemmaTranslations(translationsToInsert), {
                      ordered: false,
                  })
                : Promise.resolve(),
            suggestionsToInsert.length > 0
                ? Suggestion.insertMany(suggestionsToInsert)
                : Promise.resolve(),
            ...lemmasToUpdate.map(l =>
                Lemma.updateOne({ _id: l._id }, { $set: { prefix: l.prefix } }),
            ),
        ]);
    });
};

const prepareInsertData = (
    matchedPairs: MatchPair[],
    suggestedLemmaIds: string[],
    userId: string,
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
) => {
    const translationsToInsert: LemmaTranslationAttr[] = [];
    const suggestionsToInsert: SuggestionAttr[] = [];
    const lemmasToUpdate: LemmaUpdate[] = [];

    for (const pair of matchedPairs) {
        const { example, isValid, lemma, lemmaId, prefix, translation } = pair;

        translationsToInsert.push(
            createLemmaTranslation({
                example,
                isValid,
                lemmaId,
                mainLang,
                translation,
                translationLang,
            }),
        );

        if (!isValid || !translation) continue;

        if (prefix) {
            lemmasToUpdate.push({
                _id: lemmaId,
                lemma,
                prefix,
            });
        }

        if (suggestedLemmaIds.includes(lemmaId)) {
            suggestionsToInsert.push(
                createSuggestion({
                    example,
                    lemma,
                    lemmaId,
                    mainLang,
                    translation,
                    translationLang,
                    userId,
                    word: prefix ? `${prefix}${lemma}` : lemma,
                }),
            );
        }
    }

    return { lemmasToUpdate, suggestionsToInsert, translationsToInsert };
};
