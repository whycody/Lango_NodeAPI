import { Document, model, Schema, Types } from 'mongoose';

interface BundleMember extends Document {
    userId: Types.ObjectId;
    bundleId: Types.ObjectId;
    role: 'owner' | 'editor' | 'viewer';
    subscribed: boolean;
    removed: boolean;
    joinedViaCodeId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const bundleMemberSchema = new Schema<BundleMember>(
    {
        bundleId: { ref: 'WordsBundle', required: true, type: Schema.Types.ObjectId },
        joinedViaCodeId: { ref: 'BundleJoinCode', type: Schema.Types.ObjectId },
        removed: { default: false, type: Boolean },
        role: { enum: ['owner', 'editor', 'viewer'], required: true, type: String },
        subscribed: { default: true, type: Boolean },
        userId: { ref: 'User', required: true, type: Schema.Types.ObjectId },
    },
    { timestamps: true },
);

bundleMemberSchema.index({ bundleId: 1, userId: 1 }, { unique: true });
bundleMemberSchema.index({ userId: 1 });

export default model<BundleMember>('BundleMember', bundleMemberSchema, 'bundle_members');
