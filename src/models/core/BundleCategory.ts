import { Document, model, Schema } from 'mongoose';

interface BundleCategoryFields {
    slug: string;
    label: string;
    description?: string;
    createdAt: Date;
}

interface BundleCategory extends Document, BundleCategoryFields {}

const bundleCategorySchema = new Schema<BundleCategory>(
    {
        description: { type: String },
        label: { required: true, type: String },
        slug: { required: true, type: String, unique: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

export default model<BundleCategory>('BundleCategory', bundleCategorySchema, 'bundle_categories');
