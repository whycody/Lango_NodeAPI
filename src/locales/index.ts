import fs from 'fs';
import path from 'path';

type NotificationKeys =
  | 'time_for_study'
  | 'keep_it_up'
  | 'learning_moment'
  | 'dont_forget_session'
  | 'finish_before_midnight'
  | 'almost_end_of_day'
  | 'daily_goal_reminder';

type Translation = {
  [key in `${NotificationKeys}_title` | `${NotificationKeys}_body`]: string;
};

const localesPath = path.join(__dirname);

const cache: Record<string, Translation> = {};

export const getTranslations = (lang: string): Translation => {
  if (cache[lang]) return cache[lang];

  const filePath = path.join(localesPath, lang, 'translation.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Translations not found for language: ${lang}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  cache[lang] = data;
  return data;
};