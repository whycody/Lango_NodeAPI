import { LanguageCodeValue } from "../constants/languageCodes";
import { languages } from "../constants/languages";

export const buildTranslatingWordsPrompt = (
  mainLangCode: LanguageCodeValue,
  translationLangCode: LanguageCodeValue,
  words: string[],
) => {
  const mainLang = languages[mainLangCode];
  const translationLang = languages[translationLangCode];

  const mainLangHasArticles =
    mainLang.definedArticles && mainLang.definedArticles.length > 1;
  const translationLangHasArticles =
    translationLang.definedArticles &&
    translationLang.definedArticles.length > 1;
  const bothLangsHaveArticles =
    mainLangHasArticles && translationLangHasArticles;

  let base = `You are a language learning assistant. Task: Process a list of words and return translations and examples. Rules: \n- `;

  const rules = [
    "Keep output short and compact",
    "Max 2 translations per word",
    "Prefer common meanings",
    "Skip rare/archaic meanings",
    "If invalid word, mark isValid=false",
    "If identical words but not borrowed, mark isValid=false",
    "If proper name, mark isValid=false",
    "If overly technical word, mark isValid=false",
    "Generate max 1 example per word",
    "No explanations unless invalid",
  ];

  base += rules.join(", \n- ") + ". ";

  if (bothLangsHaveArticles) {
    base += `For substantives include correct articles specified both for ${mainLang.languageName} (${mainLang.definedArticles}) and ${translationLang.languageName} (${translationLang.definedArticles}) languages. `;
  } else if (mainLangHasArticles) {
    base += `For substantives include correct articles specified for ${mainLang.languageName} language: ${mainLang.definedArticles}. `;
  } else if (translationLangHasArticles) {
    base += `For substantives include correct articles specified for ${translationLang.languageName} language: ${translationLang.definedArticles}. `;
  }

  base += `Return JSON array: [ { "source": string, "sourceWordArticle": string | null, "isValid": boolean, "translations": [string], "example": { "source": string, "target": string } | null } ]`;

  base += `Input: \n`;

  base += `language_from: ${mainLang.languageName}\n`;

  base += `language_to: ${translationLang.languageName}\n`;

  base += `words: [${words.join(", ")}]`;

  return base;
};
