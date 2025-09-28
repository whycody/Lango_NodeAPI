import { WordPair } from "./WordPair";
import { LanguageCodeValue } from "../constants/languageCodes";

export type FetchMetadata = {
  prompt: string;
  words: WordPair[];
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
  totalWords: number;
  tokensInput?: number;
  tokensOutput?: number;
  costUSD?: number;
  aiModel: string;
}