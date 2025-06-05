import { Schema, model } from 'mongoose';

const DefaultSuggestionSchema = new Schema({
  word: String,
  translation: String,
  firstLang: String,
  secondLang: String,
});

export default model('DefaultSuggestion', DefaultSuggestionSchema);