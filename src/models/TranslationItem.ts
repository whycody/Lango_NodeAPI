import { Schema } from 'mongoose';

import { TranslationItem } from '../types/shared/TranslationItem';

export const translationItemSchema = new Schema<TranslationItem>(
    {
        example: {
            default: null,
            type: {
                source: { type: String },
                target: { type: String },
            },
        },
        isValid: { required: true, type: Boolean },
        source: { required: true, type: String },
        sourceArticle: { default: null, type: String },
        translations: { required: true, type: [String] },
    },
    { _id: false },
);
