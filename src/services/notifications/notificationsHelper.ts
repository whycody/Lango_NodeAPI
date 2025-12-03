import { getTranslations } from "../../locales";
import { LanguageCodeValue } from "../../constants/languageCodes";

const neutralNotifications = [
  'time_for_study',
  'keep_it_up',
  'learning_moment',
  'daily_goal_reminder',
  'hydration_break',
  'streak_safety',
  'small_step',
  'consistency_matters',
  'mini_challenge',
] as const;

const endOfDayNotifications = [
  'dont_forget_session',
  'finish_before_midnight',
  'almost_end_of_day',
  'last_call',
  'quick_session',
  'end_of_day_focus',
] as const;

export const getRandomNeutralNotification = (lang: LanguageCodeValue): { title: string; body: string } => {
  const translations = getTranslations(lang);
  const key = neutralNotifications[Math.floor(Math.random() * neutralNotifications.length)];
  return {
    title: translations[`${key}_title`],
    body: translations[`${key}_body`]
  };
};

export const getRandomEndOfDayNotification = (lang: LanguageCodeValue): { title: string; body: string } => {
  const translations = getTranslations(lang);
  const key = endOfDayNotifications[Math.floor(Math.random() * endOfDayNotifications.length)];
  return {
    title: translations[`${key}_title`],
    body: translations[`${key}_body`]
  };
};
