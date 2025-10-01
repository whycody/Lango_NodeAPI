import { Document, model, Schema } from 'mongoose';
import { LanguageCode } from "../../constants/languageCodes";
import { SuggestionAttr } from "../../types/models/SuggestionAttr";

interface Suggestion extends Omit<SuggestionAttr, "id">, Document {
  createdAt: Date;
  updatedAt: Date;
}

const suggestionSchema = new Schema<Suggestion>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  word: { type: String, required: true },
  translation: { type: String, required: true },
  lemma: { type: String, required: true },
  mainLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  displayCount: { type: Number, default: 0 },
  skipped: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

suggestionSchema.index({ userId: 1 });

export default model<Suggestion>('Suggestion', suggestionSchema, 'suggestions');