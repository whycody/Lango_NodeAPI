import { Document, model, Schema } from 'mongoose';
import { LemmaType } from "../../constants/lemmasTypes";
import { LanguageCode } from "../../constants/languageCodes";
import { LemmaAttr } from "../../types/models/LemmaAttr";

export interface Lemma extends Document, LemmaAttr {
  addDate: Date;
  updatedAt: Date;
}

const lemmaSchema = new Schema<Lemma>(
  {
    lemma: { type: String, required: true },
    type: { type: String, required: true, enum: Object.values(LemmaType) },
    lang: { type: String, required: true, enum: Object.values(LanguageCode) },
    prefix: { type: String, default: '' },
    freq: { type: Number, required: true },
    freq_z: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: 'addDate', updatedAt: 'updatedAt' }
  }
);

lemmaSchema.index({ lemma: 1, lang: 1 }, { unique: true });

export default model<Lemma>('Lemma', lemmaSchema, 'lemmas');