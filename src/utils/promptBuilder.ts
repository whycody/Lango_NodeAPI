import { LanguageCodeValue } from "../constants/languageCodes";
import { languages } from "../constants/languages";

export const buildTranslatingWordsPrompt = (mainLangCode: LanguageCodeValue, translationLangCode: LanguageCodeValue, words: string[]) => {
  const mainLang = languages[mainLangCode];
  const translationLang = languages[translationLangCode];

  const mainLangHasArticles = mainLang.definedArticles && mainLang.definedArticles.length > 1;
  const translationLangHasArticles = translationLang.definedArticles && translationLang.definedArticles.length > 1;
  const bothLangsHaveArticles = mainLangHasArticles && translationLangHasArticles;

  const translationsMap = Object.keys(mainLang.exampleTranslations)
    .map((key) => {
      const mainWord = mainLang.exampleTranslations[key as keyof typeof mainLang.exampleTranslations];
      const translationWord = translationLang.exampleTranslations[key as keyof typeof translationLang.exampleTranslations];
      return `${mainWord}-${translationWord}`;
    })
    .join(";");

  let base = `Translate provided ${mainLang.languageName} words into ${translationLang.languageName}. `;

  base += `Skip proper names, misspellings, rare or very archaic terms, or overly technical words. `;

  base += `Example output: ${translationsMap}. `

  base += `Translate provided words: ${words}. `;

  base += `Return ONLY a plain list in the format: word-translation; without spaces after semicolons, no new lines, no extra text. `;

  if (bothLangsHaveArticles) {
    base += `For substantives include correct articles specified both for ${mainLang.languageName} (${mainLang.definedArticles}) and ${translationLang.languageName} (${translationLang.definedArticles}) languages. `;
  } else if (mainLangHasArticles) {
    base += `For substantives include correct articles specified for ${mainLang.languageName} language: ${mainLang.definedArticles}. `;
  } else if (translationLangHasArticles) {
    base += `For substantives include correct articles specified for ${translationLang.languageName} language: ${translationLang.definedArticles}. `
  }

  return base;
}