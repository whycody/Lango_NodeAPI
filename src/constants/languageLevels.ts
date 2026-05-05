export const LEVEL_PERCENTILES: Record<LanguageLevelValue, number> = {
    1: 0.001,
    2: 0.01,
    3: 0.1,
    4: 0.3,
    5: 0.7,
};
export const LANGUAGE_LEVELS = [1, 2, 3, 4, 5] as const;

export type LanguageLevelValue = (typeof LANGUAGE_LEVELS)[number];
