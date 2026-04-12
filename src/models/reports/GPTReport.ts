import { Document, model, Schema } from 'mongoose';

import { LanguageCode } from '../../constants/languageCodes';
import { GPTReportAttr } from '../../types/models/GPTReportAttr';
import { translationItemSchema } from '../TranslationItem';

export interface GPTReport extends Document, GPTReportAttr {
    updatedAt: Date;
}

const gptReportSchema = new Schema<GPTReport>(
    {
        aiModel: { required: true, type: String },
        costUSD: { type: Number },
        mainLang: { enum: Object.values(LanguageCode), required: true, type: String },
        prompt: { required: true, type: String },
        response: { required: true, type: String },
        tokensInput: { type: Number },
        tokensOutput: { type: Number },
        totalWords: { required: true, type: Number },
        translationLang: { enum: Object.values(LanguageCode), required: true, type: String },
        updatedAt: { default: Date.now, type: Date },
        words: { required: true, type: [translationItemSchema] },
    },
    {
        timestamps: { createdAt: false, updatedAt: 'updatedAt' },
    },
);

export default model<GPTReport>('GPTReport', gptReportSchema, 'gpt_reports');
