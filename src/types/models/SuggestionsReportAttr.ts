import { Types } from 'mongoose';

import { LanguageCodeValue } from '../../constants/languageCodes';
import { LemmaUpdate } from '../shared/LemmaUpdate';
import { WordPair } from '../shared/WordPair';

export type SuggestionsReportAttr = {
    userId: Types.ObjectId | string;
    updatedLemmas: LemmaUpdate[];
    insertedSuggestions: WordPair[];
    insertedTranslations: WordPair[];
    skippedTranslations: string[];
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
};
