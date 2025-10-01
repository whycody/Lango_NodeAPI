import { WordPair } from "../shared/WordPair";
import { LanguageCodeValue } from "../../constants/languageCodes";

export type GPTReportAttr = {
  prompt: string;
  response: string;
  words: WordPair[];
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
  totalWords: number;
  tokensInput?: number;
  tokensOutput?: number;
  costUSD?: number;
  aiModel: string;
}