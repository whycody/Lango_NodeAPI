import { LanguageCode, LanguageCodeValue } from '../../constants/languageCodes';
import { LANGUAGE_LEVELS } from '../../constants/languageLevels';
import { SUGGESTIONS_TO_TRANSLATE } from '../../constants/suggestions';
import Lemma from '../../models/lemmas/Lemma';
import LemmaTranslation from '../../models/lemmas/LemmaTranslation';
import { SuggestionsRepository } from '../../types/api/SuggestionsRepository';
import { LemmaAttrWithId } from '../../types/models/LemmaAttr';
import { LemmaTranslationAttr } from '../../types/models/LemmaTranslationAttr';
import { LemmaUpdate } from '../../types/shared/LemmaUpdate';
import { FastAPISuggestionsRepository } from './repositories/FastAPISuggestionRepository';
import { translateWords } from './translateWords';
import { createLemmaTranslation } from './utils/fabrics/createLemmaTranslation';
import { getLemmasIdsToTranslate } from './utils/getLemmasToTranslate';
import { mapArrayToLemmaTranslations } from './utils/mapToLemmaTranslation';
import { matchTranslationsToLemmas } from './utils/matchTranslationsToLemmas';
import { saveGPTReport } from './utils/reports/saveGPTReport';

export interface PopulateResultEntry {
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    level: number;
    validInPool: number;
    batches: number;
}

export async function populateLemmaTranslations(
    count: number,
    repo: SuggestionsRepository = new FastAPISuggestionsRepository(),
): Promise<PopulateResultEntry[]> {
    const languages = Object.values(LanguageCode);
    const results: PopulateResultEntry[] = [];

    for (const mainLang of languages) {
        for (const translationLang of languages) {
            if (mainLang === translationLang) continue;
            for (const level of LANGUAGE_LEVELS) {
                const entry = await populateForTriple(
                    mainLang,
                    translationLang,
                    level,
                    count,
                    repo,
                );
                results.push(entry);
            }
        }
    }

    return results;
}

async function populateForTriple(
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    level: number,
    targetCount: number,
    repo: SuggestionsRepository,
): Promise<PopulateResultEntry> {
    let batches = 0;
    let validInPool = 0;

    while (true) {
        const response = await repo.getUserSuggestions({
            level,
            limit: targetCount,
            mainLang,
            translationLang,
        });

        const suggestedIds = response.suggested_lemmas_ids;
        const medianFreq = response.median_freq;
        if (suggestedIds.length === 0) break;

        const validTranslations = await LemmaTranslation.find({
            lemmaId: { $in: suggestedIds },
            translation: { $ne: null },
            translationLang,
        }).lean();

        validInPool = validTranslations.length;

        if (validInPool >= suggestedIds.length) break;

        const toTranslateIds = await getLemmasIdsToTranslate(
            suggestedIds,
            mainLang,
            translationLang,
            medianFreq,
            SUGGESTIONS_TO_TRANSLATE,
        );

        if (toTranslateIds.length === 0) break;

        const lemmasToTranslate = await Lemma.find({
            _id: { $in: toTranslateIds },
        }).lean<LemmaAttrWithId[]>();

        if (lemmasToTranslate.length === 0) break;

        const wordsToTranslate = lemmasToTranslate.map(l => l.lemma);
        const { fetchMetadata, translations } = await translateWords(
            mainLang,
            translationLang,
            wordsToTranslate,
        );

        const matchedPairs = matchTranslationsToLemmas(translations, lemmasToTranslate);
        await saveGPTReport(fetchMetadata);

        const translationsToInsert: LemmaTranslationAttr[] = [];
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
                lemmasToUpdate.push({ _id: lemmaId, lemma, prefix });
            }
        }

        if (translationsToInsert.length === 0) break;

        await LemmaTranslation.insertMany(mapArrayToLemmaTranslations(translationsToInsert), {
            ordered: false,
        });

        await Promise.all(
            lemmasToUpdate.map(l =>
                Lemma.updateOne({ _id: l._id }, { $set: { prefix: l.prefix } }),
            ),
        );

        batches += 1;
    }

    return { batches, level, mainLang, translationLang, validInPool };
}
