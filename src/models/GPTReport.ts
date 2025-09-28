import { Document, model, Schema } from 'mongoose';
import { LanguageCode } from "../constants/languageCodes";
import { WordPair } from "../types/WordPair";
import { FetchMetadata } from "../types/FetchMetadata";

export interface GPTReport extends Document, FetchMetadata {
  _id: string;
  updatedAt: Date;
}

const wordPairSchema = new Schema<WordPair>({
  word: { type: String, required: true },
  translation: { type: String, required: true },
}, { _id: false });

const gptReportSchema = new Schema<GPTReport>({
  _id: { type: String, required: true },
  prompt: { type: String, required: true },
  words: { type: [wordPairSchema], required: true },
  mainLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
  totalWords: { type: Number, required: true },
  tokensInput: { type: Number },
  tokensOutput: { type: Number },
  costUSD: { type: Number },
  aiModel: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: { updatedAt: 'updatedAt', createdAt: false },
});

gptReportSchema.virtual('id').get(function(this: GPTReport) {
  return this._id;
});

export default model<GPTReport>('GPTReport', gptReportSchema, 'gpt_reports');
