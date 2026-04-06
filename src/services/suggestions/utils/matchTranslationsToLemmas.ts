import { TranslationItem } from "../../../types/shared/TranslationItem";
import { MatchPair } from "../../../types/shared/MatchPair";
import { normalizeWord } from "../../utils/normalizeWord";
import { LemmaAttrWithId } from "../../../types/models/LemmaAttr";

const normalizeArticle = (article: string): string => {
  if (article.endsWith("'")) return article;
  return article.trimEnd() + " ";
};

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

    const article = item.sourceArticle
      ? normalizeArticle(item.sourceArticle)
      : null;

    matchedPairs.push({
      lemmaId: lemma._id.toString(),
      lemma: lemma.lemma,
      isValid: item.isValid,
      word: article ? `${article}${item.source}` : item.source,
      example: item.example,
      translation: item.translations.join(", ") ?? "",
      prefix: lemma.type === "subst" ? article : null,
    });
  }

  return matchedPairs;
};
