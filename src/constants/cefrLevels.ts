export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export function isCefrLevelValue(value: any): value is CefrLevel {
    return CEFR_LEVELS.includes(value);
}
