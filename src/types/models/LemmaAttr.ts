import { LemmaTypeValue } from "../../constants/lemmasTypes";
import { LanguageCodeValue } from "../../constants/languageCodes";

export type LemmaAttr = {
  lemma: string;
  type: LemmaTypeValue;
  lang: LanguageCodeValue;
  prefix: string;
  freq: number;
  freq_z: number;
}