import { Schema } from "mongoose";
import { LemmaUpdate } from "../../types/shared/LemmaUpdate";

export const lemmaUpdateSchema = new Schema<LemmaUpdate>({
  lemma: { type: String, required: true },
  prefix: { type: String, required: true },
}, { _id: false });