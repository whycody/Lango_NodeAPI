import { LanguageCodeValue } from "../../constants/languageCodes";

export interface GetUserSuggestionsParams {
  userId: string;
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
  limit: number;
}