import { Document, model, Schema } from 'mongoose';

export interface Lock extends Document {
  _id: string;
  lockedAt: Date;
  expiresAt: Date;
}

const lockSchema = new Schema<Lock>({
  _id: { type: String, required: true },
  lockedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
}, {
  versionKey: false,
  timestamps: false,
});

lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<Lock>('Lock', lockSchema, 'generation_locks');