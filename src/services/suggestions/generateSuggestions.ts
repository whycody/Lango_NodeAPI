import { FastAPISuggestionsRepository } from "./repositories/FastAPISuggestionRepository";
import { LanguageCodeValue } from "../../constants/languageCodes";
import Lemma from "../../models/lemmas/Lemma";
import Suggestion from "../../models/core/Suggestion";
import { getLemmasIdsToTranslate } from "./utils/getLemmasToTranslate";
import { matchWordPairsToLemmas } from "./utils/matchWordPairsToLemmas";
import { translateWords } from "./translateWords";
import { saveGPTReport } from "./utils/reports/saveGPTReport";
import { saveSuggestionsReport } from "./utils/reports/saveSuggestionsReport";
import { MatchPair } from "../../types/shared/MatchPair";
import { LemmaUpdate } from "../../types/shared/LemmaUpdate";
import { LemmaTranslationAttr } from "../../types/models/LemmaTranslationAttr";
import LemmaTranslation from "../../models/lemmas/LemmaTranslation";
import { SuggestionAttr } from "../../types/models/SuggestionAttr";
import { SuggestionsRepository } from "../../types/api/SuggestionsRepository";
import { withGenerationLock } from "./utils/withGenerationLock";
import { mapArrayToLemmaTranslations } from "./utils/mapToLemmaTranslation";
import { createSuggestion } from "./utils/fabrics/createSuggestion";
import { createLemmaTranslation } from "./utils/fabrics/createLemmaTranslation";
import { LemmaAttrWithId } from "../../types/models/LemmaAttr";

export const generateSuggestionsInBackground = async (userId: string, mainLang: LanguageCodeValue, translationLang: LanguageCodeValue) => {
  const key = `${userId}_${mainLang}_${translationLang}`;

  await withGenerationLock(key, async () => {
    const suggestionsRepo: SuggestionsRepository = new FastAPISuggestionsRepository();
    console.log('1')
    const suggestionsResponse = await suggestionsRepo.getUserSuggestions({
      userId,
      mainLang,
      translationLang,
      limit: 30
    });
    console.log('2')

    const { suggested_lemmas_ids: suggestedLemmasIds, median_freq: medianFreq } = suggestionsResponse;
    const suggestedLemmas = await Lemma.find({ _id: { $in: suggestedLemmasIds } }).lean();
    const lemmasIdsToTranslate = await getLemmasIdsToTranslate(suggestedLemmasIds, mainLang, translationLang, medianFreq, 30);
    const lemmasToTranslate = await Lemma.find({ _id: { $in: lemmasIdsToTranslate } }).lean<LemmaAttrWithId[]>();

    const translatedLemmasTranslations = await LemmaTranslation.find({
      lemmaId: { $in: suggestedLemmasIds },
      translationLang,
      translation: { $ne: null },
    }).lean();

    const translationMap = new Map(translatedLemmasTranslations.map(t => [t.lemmaId.toString(), t.translation]));

    const suggestionsToInsert: SuggestionAttr[] = suggestedLemmas
      .filter(l => translationMap.has(l._id.toString()))
      .map(l => (createSuggestion({
        userId,
        lemma: l.lemma,
        lemmaId: l._id.toString(),
        word: l.prefix ? `${l.prefix}${l.lemma}` : l.lemma,
        translation: translationMap.get(l._id.toString()) || "",
        mainLang,
        translationLang,
      })));

    let translationsToInsert: LemmaTranslationAttr[] = [];
    let lemmasToUpdate: LemmaUpdate[] = [];

    if (lemmasToTranslate.length > 0) {
      const wordsToTranslate = lemmasToTranslate.map(l => l.lemma);
      const { wordPairs, fetchMetadata } = await translateWords(mainLang, translationLang, wordsToTranslate);

      const matchedPairs = matchWordPairsToLemmas(wordPairs, lemmasToTranslate, mainLang);
      const unmatchedLemmas = lemmasToTranslate.filter(l => !matchedPairs.some(pair => pair.lemmaId === l._id.toString()));

      await saveGPTReport(fetchMetadata);

      const prepared = prepareInsertData(matchedPairs, suggestedLemmasIds, userId, mainLang, translationLang);
      translationsToInsert.push(...prepared.translationsToInsert);
      suggestionsToInsert.push(...prepared.suggestionsToInsert);
      lemmasToUpdate.push(...prepared.lemmasToUpdate);

      translationsToInsert.push(...unmatchedLemmas.map(l => (createLemmaTranslation({
        lemmaId: l._id.toString(),
        translationLang,
      }))));
    }

    const insertedTranslations = translationsToInsert.map(t => ({
      word: lemmasToTranslate.find(l => l._id.toString() === t.lemmaId)?.lemma || '',
      translation: t.translation
    }));

    const insertedSuggestions = suggestionsToInsert.map(s => ({ word: s.word, translation: s.translation }));

    const skippedTranslations = insertedTranslations
      .filter(t => t.translation === null)
      .map(t => t.word)

    await Promise.all([
      saveSuggestionsReport({
        userId,
        updatedLemmas: lemmasToUpdate,
        insertedSuggestions,
        insertedTranslations,
        skippedTranslations,
        mainLang,
        translationLang,
      }),
      translationsToInsert.length > 0 ? LemmaTranslation.insertMany(mapArrayToLemmaTranslations(translationsToInsert), { ordered: false }) : Promise.resolve(),
      suggestionsToInsert.length > 0 ? Suggestion.insertMany(suggestionsToInsert) : Promise.resolve(),
      ...lemmasToUpdate.map(l => Lemma.updateOne({ _id: l._id }, { $set: { prefix: l.prefix } })),
    ]);
  });
}

const prepareInsertData = (
  matchedPairs: MatchPair[],
  suggestedLemmaIds: string[],
  userId: string,
  mainLang: LanguageCodeValue,
  translationLang: LanguageCodeValue
) => {
  const translationsToInsert: LemmaTranslationAttr[] = [];
  const suggestionsToInsert: SuggestionAttr[] = [];
  const lemmasToUpdate: LemmaUpdate[] = [];

  for (const pair of matchedPairs) {
    if (pair.prefix) {
      lemmasToUpdate.push({ _id: pair.lemmaId, lemma: pair.lemma, prefix: pair.prefix });
    }

    translationsToInsert.push(createLemmaTranslation({
      lemmaId: pair.lemmaId,
      translation: pair.translation,
      translationLang,
    }));

    if (suggestedLemmaIds.includes(pair.lemmaId)) {
      suggestionsToInsert.push(createSuggestion({
        userId,
        lemma: pair.lemma,
        lemmaId: pair.lemmaId,
        word: pair.prefix ? `${pair.prefix}${pair.lemma}` : pair.lemma,
        translation: pair.translation,
        mainLang,
        translationLang,
      }));
    }
  }

  return { translationsToInsert, suggestionsToInsert, lemmasToUpdate };
}