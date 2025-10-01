import { Types } from "mongoose";
import { LanguageCodeValue } from "../../constants/languageCodes";

export type LemmaTranslationAttr = {
  lemmaId: Types.ObjectId | string;
  translationLang: LanguageCodeValue;
  translation: string | null;
}