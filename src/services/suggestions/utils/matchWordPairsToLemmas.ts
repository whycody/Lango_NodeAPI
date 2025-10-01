import { WordPair } from "../../../types/shared/WordPair";
import { LanguageCodeValue } from "../../../constants/languageCodes";
import { languages } from "../../../constants/languages";
import { MatchPair } from "../../../types/shared/MatchPair";

export function matchWordPairsToLemmas(wordPairs: WordPair[], lemmas: any[], mainLangCode: LanguageCodeValue) {
  const mainLanguage = languages[mainLangCode];
  const matchedPairs: MatchPair[] = [];

  const articles = mainLanguage.definedArticles || [];

  for (const wp of wordPairs) {
    const wpWordLower = wp.word.toLowerCase();

    for (const lemma of lemmas) {
      let articleFound: string | null = null;
      let coreWord = wp.word;
      const lemmaLower = lemma.lemma.toLowerCase();

      for (const article of articles) {
        const articleLower = article.toLowerCase();

        if (article.endsWith("'")) {
          if (wpWordLower.startsWith(articleLower)) {
            const remainder = wpWordLower.slice(articleLower.length);
            if (remainder === lemmaLower) {
              articleFound = article;
              coreWord = wp.word.slice(article.length);
              break;
            }
          }
        } else {
          if (wpWordLower.startsWith(articleLower + " ")) {
            const remainder = wpWordLower.slice(articleLower.length + 1);
            if (remainder === lemmaLower) {
              articleFound = article + " ";
              coreWord = wp.word.slice(article.length + 1);
              break;
            }
          }
        }
      }

      if (coreWord.toLowerCase() === lemmaLower) {
        matchedPairs.push({
          lemmaId: lemma._id.toString(),
          lemma: lemma.lemma,
          word: wp.word,
          translation: wp.translation!,
          article: lemma.type === 'subst' ? articleFound : null,
        });
        break;
      }
    }
  }

  return matchedPairs;
}