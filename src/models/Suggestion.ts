import { Document, model, Schema } from 'mongoose';
import { LanguageCode, LanguageCodeValue } from "../constants/languageCodes";

interface Suggestion extends Document {
  id: string;
  userId: string;
  word: string;
  translation: string;
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
  displayCount: number;
  skipped: boolean;
  updatedAt: Date;
}

const suggestionSchema = new Schema<Suggestion>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  word: { type: String, required: true },
  translation: { type: String, required: true },
  mainLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  displayCount: { type: Number, default: 0 },
  skipped: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: { updatedAt: 'updatedAt', createdAt: false },
});

suggestionSchema.virtual('id').get(function (this: Suggestion) {
  return this._id;
});

suggestionSchema.index({ userId: 1 });

export default model<Suggestion>('Suggestion', suggestionSchema, 'suggestions');