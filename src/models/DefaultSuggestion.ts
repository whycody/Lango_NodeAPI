import { Schema, model } from 'mongoose';

const DefaultSuggestionSchema = new Schema({
  word: String,
  translation: String,
  mainLang: String,
  translationLang: String,
});

export default model('DefaultSuggestion', DefaultSuggestionSchema, 'default_suggestions');