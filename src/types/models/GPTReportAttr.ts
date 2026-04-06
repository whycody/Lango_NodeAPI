import { LanguageCodeValue } from '../../constants/languageCodes';
import { TranslationItem } from '../shared/TranslationItem';

export type GPTReportAttr = {
    prompt: string;
    response: string;
    words: TranslationItem[];
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    totalWords: number;
    tokensInput?: number;
    tokensOutput?: number;
    costUSD?: number;
    aiModel: string;
};
