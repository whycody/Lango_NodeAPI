import { Document, model, Schema, Types } from 'mongoose';

import { LanguageCode, LanguageCodeValue } from '../../constants/languageCodes';
import { hasDuplicateWords } from '../../services/utils/hasDuplicateWords';

interface BundleThemeInstanceFields {
    themeId: Types.ObjectId;
    mainLang: LanguageCodeValue;
    words: string[];
    wordsGeneratedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

interface BundleThemeInstance extends Document, BundleThemeInstanceFields {}

const bundleThemeInstanceSchema = new Schema<BundleThemeInstance>(
    {
        mainLang: { enum: Object.values(LanguageCode), required: true, type: String },
        themeId: { ref: 'BundleTheme', required: true, type: Schema.Types.ObjectId },
        words: {
            required: true,
            type: [String],
            validate: {
                message: 'words must not contain duplicate entries',
                validator: (value: string[]) => !hasDuplicateWords(value),
            },
        },
        wordsGeneratedAt: { required: true, type: Date },
    },
    { timestamps: true },
);

bundleThemeInstanceSchema.index({ mainLang: 1, themeId: 1 }, { unique: true });

export default model<BundleThemeInstance>(
    'BundleThemeInstance',
    bundleThemeInstanceSchema,
    'bundle_theme_instances',
);
