import { Document, model, Schema } from 'mongoose';
import { LanguageCode } from "../../constants/languageCodes";
import { GPTReportAttr } from "../../types/models/GPTReportAttr";
import { wordPairSchema } from "../WordPair";

export interface GPTReport extends Document, GPTReportAttr {
  updatedAt: Date;
}

const gptReportSchema = new Schema<GPTReport>({
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

export default model<GPTReport>('GPTReport', gptReportSchema, 'gpt_reports');