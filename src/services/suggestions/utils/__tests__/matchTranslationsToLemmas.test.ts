import { LemmaAttrWithId } from '../../../../types/models/LemmaAttr';
import { TranslationItem } from '../../../../types/shared/TranslationItem';
import { matchTranslationsToLemmas } from '../matchTranslationsToLemmas';

describe('matchTranslationsToLemmas', () => {
    const lemmas: LemmaAttrWithId[] = [
        {
            _id: '1',
            lemma: 'amico',
            type: 'subst',
            lang: 'it',
            prefix: '',
            freq: 1,
            freq_z: 0,
        },
        {
            _id: '2',
            lemma: 'cane',
            type: 'subst',
            lang: 'it',
            prefix: '',
            freq: 1,
            freq_z: 0,
        },
        {
            _id: '3',
            lemma: 'gatto',
            type: 'subst',
            lang: 'it',
            prefix: '',
            freq: 1,
            freq_z: 0,
        },
        {
            _id: '4',
            lemma: 'cantare',
            type: 'verb',
            lang: 'it',
            prefix: '',
            freq: 1,
            freq_z: 0,
        },
    ];

    it('matches word with apostrophe article', () => {
        const translations: TranslationItem[] = [
            {
                source: 'amico',
                sourceArticle: "l'",
                isValid: true,
                translations: ['przyjaciel'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '1',
                lemma: 'amico',
                isValid: true,
                word: "l'amico",
                translation: 'przyjaciel',
                example: null,
                prefix: "l'",
            },
        ]);
    });

    it('matches word with standard article', () => {
        const translations: TranslationItem[] = [
            {
                source: 'cane',
                sourceArticle: 'il ',
                isValid: true,
                translations: ['pies'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '2',
                lemma: 'cane',
                isValid: true,
                word: 'il cane',
                translation: 'pies',
                example: null,
                prefix: 'il ',
            },
        ]);
    });

    it('matches word without article', () => {
        const translations: TranslationItem[] = [
            {
                source: 'gatto',
                sourceArticle: null,
                isValid: true,
                translations: ['kot'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '3',
                lemma: 'gatto',
                isValid: true,
                word: 'gatto',
                translation: 'kot',
                example: null,
                prefix: null,
            },
        ]);
    });

    it('matches verbs without article', () => {
        const translations: TranslationItem[] = [
            {
                source: 'cantare',
                sourceArticle: null,
                isValid: true,
                translations: ['śpiewać'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '4',
                lemma: 'cantare',
                isValid: true,
                word: 'cantare',
                translation: 'śpiewać',
                example: null,
                prefix: null,
            },
        ]);
    });

    it('ignores words that do not match any lemma', () => {
        const translations: TranslationItem[] = [
            {
                source: 'nonmatching',
                sourceArticle: null,
                isValid: true,
                translations: ['brak'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([]);
    });

    it('is case-insensitive', () => {
        const translations: TranslationItem[] = [
            {
                source: 'Amico',
                sourceArticle: "L'",
                isValid: true,
                translations: ['przyjaciel'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '1',
                lemma: 'amico',
                isValid: true,
                word: "L'Amico",
                translation: 'przyjaciel',
                example: null,
                prefix: "L'",
            },
        ]);
    });

    it('skips invalid translations', () => {
        const translations: TranslationItem[] = [
            {
                source: 'amico',
                sourceArticle: null,
                isValid: false,
                translations: [],
                example: null,
            },
            {
                source: 'cane',
                sourceArticle: 'il ',
                isValid: true,
                translations: ['pies'],
                example: { source: 'Il cane corre.', target: 'Pies biega.' },
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '1',
                lemma: 'amico',
                isValid: false,
                word: 'amico',
                translation: null,
                example: null,
                prefix: null,
            },
            {
                lemmaId: '2',
                lemma: 'cane',
                isValid: true,
                word: 'il cane',
                translation: 'pies',
                example: { source: 'Il cane corre.', target: 'Pies biega.' },
                prefix: 'il ',
            },
        ]);
    });

    it('normalizes article without space by adding space', () => {
        const translations: TranslationItem[] = [
            {
                source: 'cane',
                sourceArticle: 'il',
                isValid: true,
                translations: ['pies'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '2',
                lemma: 'cane',
                isValid: true,
                word: 'il cane',
                translation: 'pies',
                example: null,
                prefix: 'il ',
            },
        ]);
    });

    it('does not add space after apostrophe article', () => {
        const translations: TranslationItem[] = [
            {
                source: 'amico',
                sourceArticle: "l'",
                isValid: true,
                translations: ['przyjaciel'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '1',
                lemma: 'amico',
                isValid: true,
                word: "l'amico",
                translation: 'przyjaciel',
                example: null,
                prefix: "l'",
            },
        ]);
    });

    it('joins multiple translations', () => {
        const translations: TranslationItem[] = [
            {
                source: 'amico',
                sourceArticle: "l'",
                isValid: true,
                translations: ['przyjaciel', 'kumpel'],
                example: null,
            },
        ];

        const result = matchTranslationsToLemmas(translations, lemmas);

        expect(result).toEqual([
            {
                lemmaId: '1',
                lemma: 'amico',
                isValid: true,
                word: "l'amico",
                translation: 'przyjaciel, kumpel',
                example: null,
                prefix: "l'",
            },
        ]);
    });
});
