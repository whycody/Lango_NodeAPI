import { BaseWord } from "../constants/baseWords";
import { LanguageCodeValue } from "../constants/languageCodes";
import { ExampleTranslation } from "./ExampleTranslation";

export type Language = {
  languageCode: LanguageCodeValue,
  languageName: string,
  definedArticles: string[] | null,
  exampleTranslations: { [K in BaseWord]: ExampleTranslation },
}

export type Languages = Record<LanguageCodeValue, Language>;