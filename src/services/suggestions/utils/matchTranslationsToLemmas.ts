import { LanguageCode } from '../../../constants/languageCodes';
import { LemmaType } from '../../../constants/lemmasTypes';
import { LemmaAttrWithId } from '../../../types/models/LemmaAttr';
import { MatchPair } from '../../../types/shared/MatchPair';
import { TranslationItem } from '../../../types/shared/TranslationItem';
import { normalizeWord } from '../../utils/normalizeWord';

const normalizeArticle = (article: string): string => {
    if (/['’]$/.test(article)) return article;
    return article.trimEnd() + ' ';
};

const allowedPrefixes: Record<LanguageCode, Partial<Record<LemmaType, string[]>>> = {
    [LanguageCode.En]: {
        [LemmaType.Verb]: ['to'],
    },
    [LanguageCode.Es]: {
        [LemmaType.Subst]: ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'],
    },
    [LanguageCode.It]: {
        [LemmaType.Subst]: ['il', 'lo', 'la', "l'", 'i', 'gli', 'le', 'un', 'uno', 'una', "un'"],
    },
    [LanguageCode.Pl]: {},
};

export const matchTranslationsToLemmas = (
    translations: TranslationItem[],
    lemmas: LemmaAttrWithId[],
) => {
    const lemmaMap = new Map(lemmas.map(lemma => [lemma.lemma.toLowerCase(), lemma]));

    const matchedPairs: MatchPair[] = [];

    for (const item of translations) {
        const normalizedSource = normalizeWord(item.source).toLowerCase();
        const lemma = lemmaMap.get(normalizedSource);

        if (!lemma) continue;

        const normalizedPrefix =
            item.sourceArticle?.trim().toLowerCase().replace(/’/g, "'") || null;

        const isPrefixAllowed =
            normalizedPrefix &&
            allowedPrefixes[lemma.lang]?.[lemma.type]?.includes(normalizedPrefix);

        const prefix = isPrefixAllowed ? normalizeArticle(item.sourceArticle!) : null;

        const isValid = item.isValid && item.translations.length > 0;

        matchedPairs.push({
            example: isValid ? item.example : null,
            isValid,
            lemma: lemma.lemma,
            lemmaId: lemma._id.toString(),
            prefix,
            translation: isValid ? item.translations.join(', ') : null,
            word: prefix ? `${prefix}${item.source}` : item.source,
        });
    }

    return matchedPairs;
};
