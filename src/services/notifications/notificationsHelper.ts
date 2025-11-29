import { getTranslations } from "../../locales";
import { LanguageCodeValue } from "../../constants/languageCodes";


const neutralNotifications = [
  'time_for_study',
  'keep_it_up',
  'learning_moment'
] as const;

const endOfDayNotifications = [
  'dont_forget_session',
  'finish_before_midnight',
  'almost_end_of_day'
] as const;

type NeutralNotification = typeof neutralNotifications[number];
type EndOfDayNotification = typeof endOfDayNotifications[number];

type Notification = NeutralNotification | EndOfDayNotification;

export const getRandomNeutralNotification = (lang: LanguageCodeValue): { title: string; body: string } => {
  const translations = getTranslations(lang);
  console.log(translations)
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

