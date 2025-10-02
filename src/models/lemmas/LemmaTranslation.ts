import { Document, model, Schema } from 'mongoose';
import { LanguageCode } from "../../constants/languageCodes";
import { LemmaTranslationAttr } from "../../types/models/LemmaTranslationAttr";

export interface LemmaTranslation extends Document, LemmaTranslationAttr {
  createdAt: Date;
  updatedAt: Date;
}

const lemmaTranslationSchema = new Schema<LemmaTranslation>(
  {
    lemmaId: { type: Schema.Types.ObjectId, ref: 'Lemma', required: true },
    translationLang: { type: String, required: true, enum: Object.values(LanguageCode) },
    translation: { type: String, required: false, default: null },
    addCount: { type: Number, default: 0 },
    skipCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

lemmaTranslationSchema.index({ lemmaId: 1, translationLang: 1 }, { unique: true });

export default model<LemmaTranslation>('LemmaTranslation', lemmaTranslationSchema, 'lemmas_translations');
