import { Document, model, Schema } from 'mongoose';

interface Evaluation extends Document {
  id: string;
  userId: string;
  wordId: string;
  sessionId: string;
  grade: number;
  date: Date;
  updatedAt: Date;
}

const evaluationSchema = new Schema<Evaluation>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  wordId: { type: String, required: true },
  sessionId: { type: String, required: true },
  grade: { type: Number, required: true },
  date: { type: Date, required: true },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: { updatedAt: 'updatedAt', createdAt: false },
});

evaluationSchema.virtual('id').get(function(this: Evaluation) {
  return this._id;
});

export default model<Evaluation>('Evaluation', evaluationSchema, 'evaluations');