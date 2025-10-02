import { LanguageCodeValue } from "../../constants/languageCodes";
import { Types } from "mongoose";

export type SuggestionAttr = {
  userId: Types.ObjectId | string;
  word: string;
  translation: string;
  lemmaId: Types.ObjectId | string;
  lemma: string;
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
  displayCount: number;
  skipped: boolean;
  added: boolean;
}