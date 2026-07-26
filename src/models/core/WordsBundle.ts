import { Document, model, Schema, Types } from 'mongoose';

import { LanguageCode, LanguageCodeValue } from '../../constants/languageCodes';

interface WordsBundle extends Document {
    ownerId: Types.ObjectId;
    title: string;
    description?: string;
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    visibility: 'private' | 'friends' | 'public';
    removed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const wordsBundleSchema = new Schema<WordsBundle>(
    {
        description: { type: String },
        mainLang: { enum: Object.values(LanguageCode), required: true, type: String },
        ownerId: { ref: 'User', required: true, type: Schema.Types.ObjectId },
        removed: { default: false, type: Boolean },
        title: { required: true, type: String },
        translationLang: { enum: Object.values(LanguageCode), required: true, type: String },
        visibility: {
            default: 'public',
            enum: ['private', 'friends', 'public'],
            required: true,
            type: String,
        },
    },
    { timestamps: true },
);

wordsBundleSchema.index({ ownerId: 1 });
// eslint-disable-next-line perfectionist/sort-objects
wordsBundleSchema.index({ visibility: 1, title: 'text' });

export default model<WordsBundle>('WordsBundle', wordsBundleSchema, 'words_bundles');
