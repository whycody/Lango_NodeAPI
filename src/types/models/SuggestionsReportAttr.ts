import { WordPair } from "../shared/WordPair";
import { LanguageCodeValue } from "../../constants/languageCodes";
import { LemmaUpdate } from "../shared/LemmaUpdate";
import { Types } from "mongoose";

export type SuggestionsReportAttr = {
  userId: Types.ObjectId | string;
  updatedLemmas: LemmaUpdate[];
  insertedSuggestions: WordPair[];
  insertedTranslations: WordPair[];
  skippedTranslations: string[];
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
}