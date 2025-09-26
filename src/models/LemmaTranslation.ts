import { Document, model, Schema, Types } from 'mongoose';
import { LanguageCode, LanguageCodeValue } from "../constants/languageCodes";

export interface LemmaTranslation extends Document {
  lemmaId: Types.ObjectId;
  translationLang: LanguageCodeValue;
  translation: string;
}

const lemmaTranslationSchema = new Schema<LemmaTranslation>(
  {
    lemmaId: { type: Schema.Types.ObjectId, ref: 'Lemma', required: true },
    translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
    translation: { type: String, required: true },
  },
  { timestamps: { createdAt: 'addDate', updatedAt: 'updatedAt' } }
);

lemmaTranslationSchema.index({ lemmaId: 1, translationLang: 1 }, { unique: true });

export default model<LemmaTranslation>('LemmaTranslation', lemmaTranslationSchema, 'lemma_translations');
