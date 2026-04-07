import { Document, model, Schema } from 'mongoose';

import { LanguageCode } from '../../constants/languageCodes';
import { SuggestionsReportAttr } from '../../types/models/SuggestionsReportAttr';
import { WordPair } from '../../types/shared/WordPair';
import { lemmaUpdateSchema } from '../lemmas/LemmaUpdate';

export interface SuggestionsReport extends Document, SuggestionsReportAttr {
    createdAt: Date;
}

const wordPairSchema = new Schema<WordPair>(
    {
        translation: { default: null, type: String },
        word: { required: true, type: String },
    },
    { _id: false },
);

const suggestionsReportSchema = new Schema<SuggestionsReport>(
    {
        insertedSuggestions: { required: true, type: [wordPairSchema] },
        insertedTranslations: { required: true, type: [wordPairSchema] },
        mainLang: { enum: Object.values(LanguageCode), required: true, type: String },
        skippedTranslations: { required: true, type: [String] },
        translationLang: { enum: Object.values(LanguageCode), required: true, type: String },
        updatedLemmas: { required: true, type: [lemmaUpdateSchema] },
        userId: { ref: 'User', required: true, type: Schema.Types.ObjectId },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: false },
    },
);

export default model<SuggestionsReport>(
    'SuggestionsReport',
    suggestionsReportSchema,
    'suggestions_reports',
);
