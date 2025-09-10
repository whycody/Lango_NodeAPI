export const LEMMA_TYPES = ['subst', 'verb', 'adj', 'adv', 'num', 'qub', 'prep', 'pred'] as const;
export type LemmaType = typeof LEMMA_TYPES[number];