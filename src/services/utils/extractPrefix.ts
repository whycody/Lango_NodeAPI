import { ExtractedArticle } from "../../types/shared/ExtractedArticle";

export const extractPrefix = (word: string, lemma: string, articles: string[]): ExtractedArticle => {
  const wpWordLower = word.toLowerCase();
  const lemmaLower = lemma.toLowerCase();

  for (const article of articles) {
    const articleLower = article.toLowerCase();

    if (article.endsWith("'")) {
      const cleanedWord = wpWordLower.replace(/'\s+/, "'");
      if (cleanedWord.startsWith(articleLower)) {
        const remainder = cleanedWord.slice(articleLower.length);
        if (remainder === lemmaLower) {
          return { articleFound: article, coreWord: word.slice(article.length).trimStart() };
        }
      }
    } else {
      if (wpWordLower.startsWith(articleLower + " ")) {
        const remainder = wpWordLower.slice(articleLower.length + 1);
        if (remainder === lemmaLower) {
          return { articleFound: article + " ", coreWord: word.slice(article.length + 1) };
        }
      }
    }
  }

  return { articleFound: null, coreWord: word };
}