import { Document, model, Schema, Types } from 'mongoose';

import { LanguageCode, LanguageCodeValue } from '../../constants/languageCodes';
import { stripDiacritics } from '../../services/utils/stripDiacritics';

interface WordsBundleFields {
    ownerId: Types.ObjectId;
    title: string;
    description?: string;
    searchText: string;
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    visibility: 'private' | 'friends' | 'public';
    removed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface WordsBundle extends Document, WordsBundleFields {}

const normalizeForSearch = (text: string): string => stripDiacritics(text).toLowerCase();

export const buildSearchText = (title: string, description?: string): string =>
    normalizeForSearch(description ? `${title} ${description}` : title);

const wordsBundleSchema = new Schema<WordsBundle>(
    {
        description: { type: String },
        mainLang: { enum: Object.values(LanguageCode), required: true, type: String },
        ownerId: { ref: 'User', required: true, type: Schema.Types.ObjectId },
        removed: { default: false, type: Boolean },
        searchText: { required: true, select: false, type: String },
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

export const applySearchTextToUpdate = (
    update: ({ $set?: Partial<WordsBundleFields> } & Partial<WordsBundleFields>) | null,
): void => {
    if (!update) {
        return;
    }

    const target = update.$set ?? update;

    if (target.title !== undefined) {
        target.searchText = buildSearchText(target.title, target.description);
    }
};

wordsBundleSchema.pre('save', function (next) {
    if (this.isModified('title') || this.isModified('description')) {
        this.searchText = buildSearchText(this.title, this.description);
    }

    next();
});

wordsBundleSchema.pre('findOneAndUpdate', function (next) {
    applySearchTextToUpdate(this.getUpdate() as Parameters<typeof applySearchTextToUpdate>[0]);
    next();
});

wordsBundleSchema.index({ ownerId: 1 });
wordsBundleSchema.index({ searchText: 1, visibility: 1 });

export default model<WordsBundle>('WordsBundle', wordsBundleSchema, 'words_bundles');
