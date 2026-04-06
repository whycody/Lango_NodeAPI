import { WordPair } from '../types/shared/WordPair';

interface ParseOptions {
    pairSeparator?: string;
    keyValueSeparator?: string;
    trimPeriod?: boolean;
}

export function parseWordPairs(text: string, options: ParseOptions = {}): WordPair[] {
    const { keyValueSeparator = '-', pairSeparator = ';', trimPeriod = true } = options;

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
            return { translation, word };
        })
        .filter((w): w is NonNullable<typeof w> => w !== null);
}
