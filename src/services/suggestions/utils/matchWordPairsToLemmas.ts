import { TranslationItem } from "../../../types/shared/TranslationItem";
import { MatchPair } from "../../../types/shared/MatchPair";
import { normalizeWord } from "../../utils/normalizeWord";
import { LemmaAttrWithId } from "../../../types/models/LemmaAttr";

export const matchTranslationsToLemmas = (
  translations: TranslationItem[],
  lemmas: LemmaAttrWithId[],
) => {
  const lemmaMap = new Map(
    lemmas.map((lemma) => [lemma.lemma.toLowerCase(), lemma]),
  );

  const matchedPairs: MatchPair[] = [];

  for (const item of translations) {
    const normalizedSource = normalizeWord(item.source).toLowerCase();
    const lemma = lemmaMap.get(normalizedSource);

    if (!lemma) continue;

    matchedPairs.push({
      lemmaId: lemma._id.toString(),
      lemma: lemma.lemma,
      isValid: item.isValid,
      word: item.sourceArticle
        ? `${item.sourceArticle}${item.source}`
        : item.source,
      example: item.example,
      translation: item.translations[0],
      prefix: lemma.type === "subst" ? item.sourceArticle : null,
    });
  }

  return matchedPairs;
};
