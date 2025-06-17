import { Schema, model, Document } from 'mongoose';

interface Word extends Document {
  id: string;
  userId: string;
  text: string;
  translation: string;
  firstLang: string;
  secondLang: string;
  source: string;
  interval: number;
  addDate: Date;
  repetitionCount: number;
  lastReviewDate: Date;
  nextReviewDate: Date;
  EF: number;
  updatedAt: Date;
  active: boolean;
  removed: boolean;
}

const wordSchema = new Schema<Word>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  text: { type: String, required: true },
  translation: { type: String, required: true },
  firstLang: { type: String, required: true },
  secondLang: { type: String, required: true },
  source: { type: String, required: true },
  interval: { type: Number, default: 1 },
  addDate: { type: Date, default: Date.now },
  repetitionCount: { type: Number, default: 0 },
  lastReviewDate: { type: Date, default: Date.now },
  nextReviewDate: { type: Date, default: Date.now },
  EF: { type: Number, default: 2.5 },
  updatedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  removed: { type: Boolean, default: false },
}, {
  timestamps: { updatedAt: 'updatedAt', createdAt: false },
});

wordSchema.virtual('id').get(function(this: Word) {
  return this._id;
});

wordSchema.index({ userId: 1 });

export default model<Word>('Word', wordSchema);