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
  base += `If a word is unsuitable for a language-learning flashcard (e.g., a proper name, misspelling, rare/archaic term, or overly technical word), skip it. `;

  if (bothLangsHaveArticles) {
    base += `Include defined articles specified both for ${mainLang.languageName} (${mainLang.definedArticles}) and ${translationLang.languageName} (${translationLang.definedArticles}) languages. `;
  } else if (mainLangHasArticles) {
    base += `Include defined articles specified for ${mainLang.languageName} language: ${mainLang.definedArticles}. `;
  } else if (translationLangHasArticles) {
    base += `Include defined articles specified for ${translationLang.languageName} language: ${translationLang.definedArticles}. `
  }

  base += `Example output: ${translationsMap}. `

  base += `Translate provided words: ${words}. `;

  base += `Return ONLY a plain list in the format: word-translation; without spaces after semicolons, no new lines, no extra text.`;

  return base;
}