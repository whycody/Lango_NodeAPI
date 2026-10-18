import { LanguageLevelValue } from './languageLevels';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export function isCefrLevelValue(value: any): value is CefrLevel {
    return CEFR_LEVELS.includes(value);
}

/** Mirrors the mobile app's LANGUAGE_LEVEL_KEYS: user language levels 1-5 map to A1-C1. */
export const CEFR_LEVEL_BY_LANGUAGE_LEVEL: Record<LanguageLevelValue, CefrLevel> = {
    1: 'A1',
    2: 'A2',
    3: 'B1',
    4: 'B2',
    5: 'C1',
};
