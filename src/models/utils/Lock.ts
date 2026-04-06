import { Document, model, Schema } from 'mongoose';

export interface Lock extends Document {
    _id: string;
    lockedAt: Date;
    expiresAt: Date;
}

const lockSchema = new Schema<Lock>(
    {
        _id: { required: true, type: String },
        expiresAt: { required: true, type: Date },
        lockedAt: { default: Date.now, required: true, type: Date },
    },
    {
        timestamps: false,
        versionKey: false,
    },
);

lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<Lock>('Lock', lockSchema, 'generation_locks');
