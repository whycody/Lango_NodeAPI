import { Document, model, Schema, Types } from 'mongoose';

interface BundleJoinCode extends Document {
    creatorId: Types.ObjectId;
    bundleId: Types.ObjectId;
    role: 'owner' | 'editor' | 'viewer';
    code: string;
    expireAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const bundleJoinCodeSchema = new Schema<BundleJoinCode>(
    {
        bundleId: { ref: 'WordsBundle', required: true, type: Schema.Types.ObjectId },
        code: { required: true, type: String, unique: true },
        creatorId: { ref: 'User', required: true, type: Schema.Types.ObjectId },
        expireAt: { required: true, type: Date },
        role: { enum: ['owner', 'editor', 'viewer'], required: true, type: String },
    },
    { timestamps: true },
);

bundleJoinCodeSchema.index({ bundleId: 1 });

export default model<BundleJoinCode>('BundleJoinCode', bundleJoinCodeSchema, 'bundle_join_codes');
