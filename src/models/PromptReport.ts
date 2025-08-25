import mongoose from 'mongoose';

const PromptReportSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  words: [{ type: String }],
  excludedWords: [{ type: String }],
  totalWords: { type: Number, required: true },
  hasExcludedWords: { type: Boolean, required: true },
  addedWords: [{ type: String }],
  tokensInput: { type: Number },
  tokensOutput: { type: Number },
  costUSD: { type: Number },
  model: { type: String, required: true },
  success: { type: Boolean, required: true },
  userId: { type: String, required: false },
  firstLang: { type: String, required: false },
  secondLang: { type: String, required: false },
  createdAt: { type: Date, default: Date.now }
});

export const PromptReport = mongoose.model('PromptReport', PromptReportSchema, 'prompt_reports');