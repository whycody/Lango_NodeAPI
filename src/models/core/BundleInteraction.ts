import { Document, model, Schema, Types } from 'mongoose';

interface BundleInteraction extends Document {
    _id: Types.ObjectId;
    bundleId: Types.ObjectId;
    userId: Types.ObjectId;
    interactedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const bundleInteractionSchema = new Schema<BundleInteraction>(
    {
        bundleId: { ref: 'WordsBundle', required: true, type: Schema.Types.ObjectId },
        interactedAt: { required: true, type: Date },
        userId: { ref: 'User', required: true, type: Schema.Types.ObjectId },
    },
    { timestamps: true },
);

bundleInteractionSchema.index({ bundleId: 1, userId: 1 }, { unique: true });

export default model<BundleInteraction>(
    'BundleInteraction',
    bundleInteractionSchema,
    'bundle_interactions',
);
