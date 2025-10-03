import { WordPair } from "../../../types/shared/WordPair"
import { LanguageCodeValue } from "../../../constants/languageCodes"
import { languages } from "../../../constants/languages"
import { MatchPair } from "../../../types/shared/MatchPair"
import { extractPrefix } from "../../utils/extractPrefix";
import { normalizeWord } from "../../utils/normalizeWord";
import { LemmaAttrWithId } from "../../../types/models/LemmaAttr";

export const matchWordPairsToLemmas = (wordPairs: WordPair[], lemmas: LemmaAttrWithId[], mainLangCode: LanguageCodeValue) => {
  const mainLanguage = languages[mainLangCode];
  const matchedPairs: MatchPair[] = [];

  const articles = mainLanguage.definedArticles || [];

  for (const wp of wordPairs) {
    const normalizedWord = normalizeWord(wp.word);

    for (const lemma of lemmas) {
      const lemmaLower = lemma.lemma.toLowerCase();
      const { articleFound, coreWord } = extractPrefix(normalizedWord, lemmaLower, articles);

      if (coreWord.toLowerCase() === lemmaLower) {
        matchedPairs.push({
          lemmaId: lemma._id.toString(),
          lemma: lemma.lemma,
          word: wp.word,
          translation: wp.translation!,
          prefix: lemma.type === "subst" ? articleFound : null,
        });
        break;
      }
    }
  }

  return matchedPairs;
}