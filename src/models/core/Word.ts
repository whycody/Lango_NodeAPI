import { Document, model, Schema } from 'mongoose';

import { LanguageCode, LanguageCodeValue } from '../../constants/languageCodes';

interface Word extends Document {
    id: string;
    userId: string;
    text: string;
    translation: string;
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    source: string;
    addDate: Date;
    updatedAt: Date;
    active: boolean;
    removed: boolean;
    lemmas?: string[];
}

const wordSchema = new Schema<Word>(
    {
        _id: { required: true, type: String },
        active: { default: true, type: Boolean },
        addDate: { default: Date.now, type: Date },
        lemmas: { default: null, required: false, select: false, type: [String] },
        mainLang: { enum: Object.values(LanguageCode), required: true, type: String },
        removed: { default: false, type: Boolean },
        source: { required: true, type: String },
        text: { required: true, type: String },
        translation: { required: true, type: String },
        translationLang: { enum: Object.values(LanguageCode), required: true, type: String },
        updatedAt: { default: Date.now, type: Date },
        userId: { required: true, type: String },
    },
    {
        timestamps: { createdAt: false, updatedAt: 'updatedAt' },
    },
);

wordSchema.virtual('id').get(function (this: Word) {
    return this._id;
});

wordSchema.index({ userId: 1 });

export default model<Word>('Word', wordSchema, 'words');
