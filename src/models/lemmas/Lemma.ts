import { Document, model, Schema } from 'mongoose';

import { LanguageCode } from '../../constants/languageCodes';
import { LemmaType } from '../../constants/lemmasTypes';
import { LemmaAttr } from '../../types/models/LemmaAttr';

export interface Lemma extends Document, LemmaAttr {
    addDate: Date;
    updatedAt: Date;
}

const lemmaSchema = new Schema<Lemma>(
    {
        freq: { required: true, type: Number },
        freq_z: { required: true, type: Number },
        lang: { enum: Object.values(LanguageCode), required: true, type: String },
        lemma: { required: true, type: String },
        prefix: { default: '', type: String },
        type: { enum: Object.values(LemmaType), required: true, type: String },
    },
    {
        timestamps: { createdAt: 'addDate', updatedAt: 'updatedAt' },
    },
);

lemmaSchema.index({ lang: 1, lemma: 1 }, { unique: true });

export default model<Lemma>('Lemma', lemmaSchema, 'lemmas');
