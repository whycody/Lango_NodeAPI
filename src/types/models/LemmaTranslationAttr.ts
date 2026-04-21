import { Types } from 'mongoose';

import { LanguageCodeValue } from '../../constants/languageCodes';

export type LemmaTranslationAttr = {
    lemmaId: Types.ObjectId | string;
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    translation: string | null;
    isValid: boolean;
    example: {
        source: string;
        target: string;
    } | null;
    addCount: number;
    skipCount: number;
    containsUnknownTranslations: boolean;
    validated: boolean;
};
