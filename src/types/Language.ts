import { BaseWord } from "../constants/baseWords";
import { LanguageCodeValue } from "../constants/languageCodes";

export type Language = {
  languageCode: LanguageCodeValue,
  languageName: string,
  definedArticles: string[] | null,
  exampleTranslations: { [K in BaseWord]: string },
}

export type Languages = Record<LanguageCodeValue, Language>;