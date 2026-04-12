import { Document, model, Schema } from 'mongoose';

import { LanguageCode } from '../../constants/languageCodes';
import { LemmaTranslationAttr } from '../../types/models/LemmaTranslationAttr';

export interface LemmaTranslation extends Document, LemmaTranslationAttr {
    createdAt: Date;
    updatedAt: Date;
}

const lemmaTranslationSchema = new Schema<LemmaTranslation>(
    {
        addCount: { default: 0, type: Number },
        example: {
            default: null,
            type: {
                source: { required: false, type: String },
                target: { required: false, type: String },
            },
        },
        isValid: { default: false, type: Boolean },
        lemmaId: { ref: 'Lemma', required: true, type: Schema.Types.ObjectId },
        mainLang: {
            enum: Object.values(LanguageCode),
            required: true,
            type: String,
        },
        skipCount: { default: 0, type: Number },
        translation: { default: null, required: false, type: String },
        translationLang: {
            enum: Object.values(LanguageCode),
            required: true,
            type: String,
        },
    },
    { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
);

lemmaTranslationSchema.index({ lemmaId: 1, translationLang: 1 }, { unique: true });

export default model<LemmaTranslation>(
    'LemmaTranslation',
    lemmaTranslationSchema,
    'lemmas_translations',
);
