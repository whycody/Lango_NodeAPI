import { Document, model, Schema } from 'mongoose';

import { LanguageCode } from '../../constants/languageCodes';
import { SuggestionAttr } from '../../types/models/SuggestionAttr';

export interface Suggestion extends Omit<SuggestionAttr, 'id'>, Document {
    createdAt: Date;
    updatedAt: Date;
}

const suggestionSchema = new Schema<Suggestion>(
    {
        added: { default: false, type: Boolean },
        createdAt: { default: Date.now, type: Date },
        displayCount: { default: 0, type: Number },
        example: {
            default: null,
            type: {
                source: { required: false, type: String },
                target: { required: false, type: String },
            },
        },
        lemma: { required: true, type: String },
        lemmaId: { ref: 'Lemma', required: true, type: Schema.Types.ObjectId },
        mainLang: {
            enum: Object.values(LanguageCode),
            required: true,
            type: String,
        },
        skipped: { default: false, type: Boolean },
        translation: { required: true, type: String },
        translationLang: {
            enum: Object.values(LanguageCode),
            required: true,
            type: String,
        },
        updatedAt: { default: Date.now, type: Date },
        userId: { ref: 'User', required: true, type: Schema.Types.ObjectId },
        word: { required: true, type: String },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    },
);

suggestionSchema.index({ userId: 1 });
suggestionSchema.index({ lemmaId: 1, translationLang: 1, userId: 1 }, { unique: true });

export default model<Suggestion>('Suggestion', suggestionSchema, 'suggestions');
