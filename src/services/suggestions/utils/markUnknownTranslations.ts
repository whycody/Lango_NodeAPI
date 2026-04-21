import { LanguageCode, LanguageCodeValue } from '../../../constants/languageCodes';
import Lemma from '../../../models/lemmas/Lemma';
import { LemmaTranslationAttr } from '../../../types/models/LemmaTranslationAttr';

const normalizeForLookup = (word: string, translationLang: LanguageCodeValue): string => {
    if (translationLang === LanguageCode.En && word.startsWith('to ')) {
        return word.slice(3);
    }
    return word;
};

const splitTranslation = (translation: string, translationLang: LanguageCodeValue): string[] =>
    translation
        .split(',')
        .map(word => normalizeForLookup(word.trim().toLowerCase(), translationLang))
        .filter(word => word.length > 0);

export async function markUnknownTranslations(
    translationsToInsert: LemmaTranslationAttr[],
    translationLang: LanguageCodeValue,
): Promise<void> {
    const allWords = new Set<string>();
    for (const t of translationsToInsert) {
        if (!t.translation) continue;
        for (const word of splitTranslation(t.translation, translationLang)) {
            allWords.add(word);
        }
    }

    if (allWords.size === 0) return;

    const knownLemmas = await Lemma.find({
        lang: translationLang,
        lemma: { $in: [...allWords] },
    })
        .select('lemma')
        .lean<{ lemma: string }[]>();

    const knownSet = new Set(knownLemmas.map(l => l.lemma.toLowerCase()));

    for (const t of translationsToInsert) {
        if (!t.translation) continue;
        const words = splitTranslation(t.translation, translationLang);
        if (words.some(w => !knownSet.has(w))) {
            t.containsUnknownTranslations = true;
        }
    }
}
