import { Document, model, Schema } from 'mongoose';
import { LanguageCode, LanguageCodeValue } from "../../constants/languageCodes";

interface Word extends Document {
  id: string;
  userId: string;
  text: string;
  translation: string;
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
  source: string;
  addDate: Date;
  updatedAt: Date;
  active: boolean;
  removed: boolean;
  lemmas?: string[];
}

const wordSchema = new Schema<Word>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  text: { type: String, required: true },
  translation: { type: String, required: true },
  mainLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  source: { type: String, required: true },
  addDate: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  removed: { type: Boolean, default: false },
  lemmas: { type: [String], select: false },
}, {
  timestamps: { updatedAt: 'updatedAt', createdAt: false },
});

wordSchema.virtual('id').get(function(this: Word) {
  return this._id;
});

wordSchema.index({ userId: 1 });

export default model<Word>('Word', wordSchema, 'words');