import enTranslations from './en/translations.json';
import plTranslations from './pl/translations.json';
import esTranslations from './es/translations.json';
import itTranslations from './it/translations.json';
import { LanguageCodeValue } from "../constants/languageCodes";

type NotificationKeys =
  | 'time_for_study'
  | 'keep_it_up'
  | 'learning_moment'
  | 'daily_goal_reminder'
  | 'hydration_break'
  | 'streak_safety'
  | 'small_step'
  | 'consistency_matters'
  | 'mini_challenge'
  | 'dont_forget_session'
  | 'finish_before_midnight'
  | 'almost_end_of_day'
  | 'last_call'
  | 'quick_session'
  | 'end_of_day_focus';

type Translation = {
  [key in `${NotificationKeys}_title` | `${NotificationKeys}_body`]: string;
};

const translationsMap: Record<LanguageCodeValue, Translation> = {
  en: enTranslations,
  pl: plTranslations,
  es: esTranslations,
  it: itTranslations
};

export const getTranslations = (lang: LanguageCodeValue): Translation => {
  const data = translationsMap[lang];
  if (!data) throw new Error(`Translations not found for language: ${lang}`);
  return data;
};