import { WordPair } from "../types/WordPair";

interface ParseOptions {
  pairSeparator?: string;
  keyValueSeparator?: string;
  trimPeriod?: boolean;
}

export function parseWordPairs(text: string, options: ParseOptions = {}): WordPair[] {
  const {
    pairSeparator = ";",
    keyValueSeparator = "-",
    trimPeriod = true
  } = options;

  return text
    .split(pairSeparator)
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const [wordRaw, translationRaw] = pair.split(keyValueSeparator);
      if (!wordRaw || !translationRaw) return null;
      const word = wordRaw.trim();
      let translation = translationRaw.trim();
      if (trimPeriod) {
        translation = translation.replace(/\.$/, '');
      }
      return { word, translation };
    }).filter((w): w is WordPair => w !== null);
}