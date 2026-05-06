import { Document, model, Schema } from 'mongoose';

import { LanguageCode } from '../../constants/languageCodes';
import { LemmaType } from '../../constants/lemmasTypes';
import { LemmaAttr } from '../../types/models/LemmaAttr';

export interface Lemma extends Document, LemmaAttr {
    createdAt: Date;
    updatedAt: Date;
}

const lemmaSchema = new Schema<Lemma>(
    {
        addCount: { default: 0, required: true, type: Number },
        freq: { required: true, type: Number },
        freqZ: { required: true, type: Number },
        invalidTranslationsLanguages: {
            default: [],
            type: [{ enum: Object.values(LanguageCode), type: String }],
        },
        lang: { enum: Object.values(LanguageCode), required: true, type: String },
        lemma: { required: true, type: String },
        prefix: { default: '', type: String },
        skipCount: { default: 0, required: true, type: Number },
        type: { enum: Object.values(LemmaType), required: true, type: String },
        validTranslationsLanguages: {
            default: [],
            type: [{ enum: Object.values(LanguageCode), type: String }],
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    },
);

lemmaSchema.index({ lang: 1, lemma: 1 }, { unique: true });
// eslint-disable-next-line perfectionist/sort-objects
lemmaSchema.index({ lang: 1, freqZ: 1 });
lemmaSchema.index({ lang: 1, validTranslationsLanguages: 1 });

export default model<Lemma>('Lemma', lemmaSchema, 'lemmas');
