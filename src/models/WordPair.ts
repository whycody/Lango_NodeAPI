import { Schema } from "mongoose";
import { WordPair } from "../types/shared/WordPair";

export const wordPairSchema = new Schema<WordPair>({
  word: { type: String, required: true },
  translation: { type: String, required: false, default: null },
}, { _id: false });