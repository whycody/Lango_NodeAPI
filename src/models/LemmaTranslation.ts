import { Schema, model, Document, Types } from 'mongoose';
import { Lang, LANGS } from "../types/Lang";

export interface LemmaTranslation extends Document {
  lemmaId: Types.ObjectId;
  translationLang: Lang;
  translation: string;
}

const lemmaTranslationSchema = new Schema<LemmaTranslation>(
  {
    lemmaId: { type: Schema.Types.ObjectId, ref: 'Lemma', required: true },
    translationLang: { type: String, required: true, enum: LANGS },
    translation: { type: String, required: true },
  },
  { timestamps: { createdAt: 'addDate', updatedAt: 'updatedAt' } }
);

lemmaTranslationSchema.index({ lemmaId: 1, translationLang: 1 }, { unique: true });

export default model<LemmaTranslation>('LemmaTranslation', lemmaTranslationSchema, 'lemma_translations');
