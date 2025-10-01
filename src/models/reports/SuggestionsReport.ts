import { Document, model, Schema } from 'mongoose';
import { LanguageCode } from "../../constants/languageCodes";
import { wordPairSchema } from "../WordPair";
import { SuggestionsReportAttr } from "../../types/models/SuggestionsReportAttr";
import { lemmaUpdateSchema } from "../lemmas/LemmaUpdate";

export interface SuggestionsReport extends Document, SuggestionsReportAttr {
  createdAt: Date;
}

const suggestionsReportSchema = new Schema<SuggestionsReport>({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  updatedLemmas: { type: [lemmaUpdateSchema], required: true },
  insertedSuggestions: { type: [wordPairSchema], required: true },
  insertedTranslations: { type: [wordPairSchema], required: true },
  skippedTranslations: { type: [String], required: true },
  mainLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false },
});

export default model<SuggestionsReport>('SuggestionsReport', suggestionsReportSchema, 'suggestions_reports');