import { Document, model, Schema } from 'mongoose';
import { LemmaType, LemmaTypeValue } from "../constants/lemmasTypes";
import { LanguageCode, LanguageCodeValue } from "../constants/languageCodes";

export interface Lemma extends Document {
  lemma: string;
  type: LemmaTypeValue;
  lang: LanguageCodeValue;
  prefix: string;
  add_count: number;
  skip_count: number;
  freq: number;
  freq_z: number;
}

const lemmaSchema = new Schema<Lemma>(
  {
    lemma: { type: String, required: true },
    type: { type: String, required: true, enum: Object.values(LemmaType) },
    lang: { type: String, required: true, enum: Object.values(LanguageCode) },
    prefix: { type: String, default: '' },
    add_count: { type: Number, default: 0 },
    skip_count: { type: Number, default: 0 },
    freq: { type: Number, required: true },
    freq_z: { type: Number, required: true },
  },
  { timestamps: { createdAt: 'addDate', updatedAt: false } }
);

lemmaSchema.index({ lemma: 1, lang: 1 }, { unique: true });

export default model<Lemma>('Lemma', lemmaSchema, 'lemmas');
