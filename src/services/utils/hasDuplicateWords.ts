export const hasDuplicateWords = (words: string[]): boolean => new Set(words).size !== words.length;
