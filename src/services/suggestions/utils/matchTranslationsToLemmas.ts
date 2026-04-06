import { LemmaAttrWithId } from '../../../types/models/LemmaAttr';
import { MatchPair } from '../../../types/shared/MatchPair';
import { TranslationItem } from '../../../types/shared/TranslationItem';
import { normalizeWord } from '../../utils/normalizeWord';

const normalizeArticle = (article: string): string => {
    if (article.endsWith("'")) return article;
    return article.trimEnd() + ' ';
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

        const article = item.sourceArticle ? normalizeArticle(item.sourceArticle) : null;

        matchedPairs.push({
            example: item.example,
            isValid: item.isValid,
            lemma: lemma.lemma,
            lemmaId: lemma._id.toString(),
            prefix: lemma.type === 'subst' ? article : null,
            translation: item.translations.join(', ') ?? '',
            word: article ? `${article}${item.source}` : item.source,
        });
    }

    return matchedPairs;
};
