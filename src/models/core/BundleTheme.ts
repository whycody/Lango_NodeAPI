import { Document, model, Schema, Types } from 'mongoose';

import { CEFR_LEVELS, CefrLevel } from '../../constants/cefrLevels';

interface BundleThemeFields {
    title: string;
    description: string;
    category: string;
    level: CefrLevel;
    status: 'proposed' | 'active' | 'archived';
    createdBy: 'claude' | Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

interface BundleTheme extends Document, BundleThemeFields {}

const bundleThemeSchema = new Schema<BundleTheme>(
    {
        category: { required: true, type: String },
        createdBy: { required: true, type: Schema.Types.Mixed },
        description: { required: true, type: String },
        level: { enum: CEFR_LEVELS, required: true, type: String },
        status: {
            default: 'proposed',
            enum: ['proposed', 'active', 'archived'],
            required: true,
            type: String,
        },
        title: { required: true, type: String },
    },
    { timestamps: true },
);

bundleThemeSchema.index({ category: 1, level: 1, status: 1 });

export default model<BundleTheme>('BundleTheme', bundleThemeSchema, 'bundle_themes');
