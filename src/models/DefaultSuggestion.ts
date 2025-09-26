import { Document, model, Schema } from 'mongoose';
import { LanguageCode, LanguageCodeValue } from "../constants/languageCodes";

export interface DefaultSuggestion extends Document {
  word: string;
  translation: string;
  mainLang: LanguageCodeValue;
  translationLang: LanguageCodeValue;
}

const DefaultSuggestionSchema = new Schema<DefaultSuggestion>({
  word: { type: String, required: true },
  translation: { type: String, required: true },
  mainLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
}, { timestamps: true });

export default model<DefaultSuggestion>('DefaultSuggestion', DefaultSuggestionSchema, 'default_suggestions');