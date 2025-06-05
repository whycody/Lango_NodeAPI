import { Schema, model, Document } from 'mongoose';

interface Suggestion extends Document {
  id: string;
  userId: string;
  word: string;
  translation: string;
  firstLang: string;
  secondLang: string;
  displayCount: number;
  skipped: boolean;
  updatedAt: Date;
}

const suggestionSchema = new Schema<Suggestion>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  word: { type: String, required: true },
  translation: { type: String, required: true },
  firstLang: { type: String, required: true },
  secondLang: { type: String, required: true },
  displayCount: { type: Number, default: 0 },
  skipped: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: { updatedAt: 'updatedAt', createdAt: false },
});

suggestionSchema.virtual('id').get(function (this: Suggestion) {
  return this._id;
});

export default model<Suggestion>('Suggestion', suggestionSchema);