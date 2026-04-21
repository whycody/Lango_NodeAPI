export const LANGUAGE_LEVELS = [1, 2, 3, 4, 5] as const;

export type LanguageLevelValue = (typeof LANGUAGE_LEVELS)[number];
