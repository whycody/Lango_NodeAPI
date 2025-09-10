export const LANGS = ['pl', 'it', 'en', 'es'] as const;
export type Lang = typeof LANGS[number];