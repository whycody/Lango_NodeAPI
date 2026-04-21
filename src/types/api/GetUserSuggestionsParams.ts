import { LanguageCodeValue } from '../../constants/languageCodes';

export interface GetUserSuggestionsParams {
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    userId?: string;
    level: number;
    limit: number;
}
