export function normalizeWord(word: string): string {
  return word.replace(/'\s+/, "'");
}