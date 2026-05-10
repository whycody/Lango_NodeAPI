import { LanguageCodeValue } from '../../../../constants/languageCodes';
import { LemmaAttrWithId } from '../../../../types/models/LemmaAttr';
import { TranslationItem } from '../../../../types/shared/TranslationItem';
import { matchTranslationsToLemmas } from '../matchTranslationsToLemmas';

describe('matchTranslationsToLemmas', () => {
    const lemmas: LemmaAttrWithId[] = [
        {
            _id: '1',
            addCount: 0,
            freq: 1,
            freqZ: 0,
            invalidTranslationsLanguages: [],
            lang: 'it',
            lemma: 'amico',
            prefix: '',
            skipCount: 0,
            type: 'subst',
            validTranslationsLanguages: [],
        },
        {
            _id: '2',
            addCount: 0,
            freq: 1,
            freqZ: 0,
            invalidTranslationsLanguages: [],
            lang: 'it',
            lemma: 'cane',
            prefix: '',
            skipCount: 0,
            type: 'subst',
            validTranslationsLanguages: [],
        },
        {
            _id: '3',
            addCount: 0,
            freq: 1,
            freqZ: 0,
            invalidTranslationsLanguages: [],
            lang: 'it',
            lemma: 'gatto',
            prefix: '',
            skipCount: 0,
            type: 'subst',
            validTranslationsLanguages: [],
        },
        {
            _id: '4',
            addCount: 0,
            freq: 1,
            freqZ: 0,
            invalidTranslationsLanguages: [],
            lang: 'it',
            lemma: 'cantare',
            prefix: '',
            skipCount: 0,
            type: 'verb',
            validTranslationsLanguages: [],
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

    describe('allowedPrefixes', () => {
        const baseLemma = {
            addCount: 0,
            freq: 1,
            freqZ: 0,
            invalidTranslationsLanguages: [] as LanguageCodeValue[],
            prefix: '',
            skipCount: 0,
            validTranslationsLanguages: [] as LanguageCodeValue[],
        };

        describe('English verbs', () => {
            const enVerb: LemmaAttrWithId = { ...baseLemma, _id: 'en1', lang: 'en', lemma: 'run', type: 'verb' };

            it("adds 'to' to word but sets prefix to null for verbs", () => {
                const translations: TranslationItem[] = [
                    { source: 'run', sourceArticle: 'to', isValid: true, translations: ['biegać'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [enVerb]);

                expect(result).toEqual([
                    { lemmaId: 'en1', lemma: 'run', isValid: true, word: 'to run', translation: 'biegać', example: null, prefix: null },
                ]);
            });

            it("ignores disallowed prefix for English verbs", () => {
                const translations: TranslationItem[] = [
                    { source: 'run', sourceArticle: 'the', isValid: true, translations: ['biegać'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [enVerb]);

                expect(result).toEqual([
                    { lemmaId: 'en1', lemma: 'run', isValid: true, word: 'run', translation: 'biegać', example: null, prefix: null },
                ]);
            });

            it("ignores article for English noun (no allowed prefixes for en subst)", () => {
                const enNoun: LemmaAttrWithId = { ...baseLemma, _id: 'en2', lang: 'en', lemma: 'dog', type: 'subst' };
                const translations: TranslationItem[] = [
                    { source: 'dog', sourceArticle: 'the', isValid: true, translations: ['pies'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [enNoun]);

                expect(result).toEqual([
                    { lemmaId: 'en2', lemma: 'dog', isValid: true, word: 'dog', translation: 'pies', example: null, prefix: null },
                ]);
            });
        });

        describe('Spanish nouns', () => {
            const esNoun: LemmaAttrWithId = { ...baseLemma, _id: 'es1', lang: 'es', lemma: 'libro', type: 'subst' };

            it.each([
                ['el', 'el libro', 'el '],
                ['la', 'la libro', 'la '],
                ['los', 'los libro', 'los '],
                ['las', 'las libro', 'las '],
                ['un', 'un libro', 'un '],
                ['una', 'una libro', 'una '],
                ['unos', 'unos libro', 'unos '],
                ['unas', 'unas libro', 'unas '],
            ])("allows article '%s'", (article, expectedWord, expectedPrefix) => {
                const translations: TranslationItem[] = [
                    { source: 'libro', sourceArticle: article, isValid: true, translations: ['książka'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [esNoun]);

                expect(result[0]).toMatchObject({ word: expectedWord, prefix: expectedPrefix });
            });

            it("ignores disallowed prefix for Spanish nouns", () => {
                const translations: TranslationItem[] = [
                    { source: 'libro', sourceArticle: 'il', isValid: true, translations: ['książka'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [esNoun]);

                expect(result).toEqual([
                    { lemmaId: 'es1', lemma: 'libro', isValid: true, word: 'libro', translation: 'książka', example: null, prefix: null },
                ]);
            });
        });

        describe('Italian nouns — all allowed prefixes', () => {
            const itNoun: LemmaAttrWithId = { ...baseLemma, _id: 'it5', lang: 'it', lemma: 'zaino', type: 'subst' };

            it.each([
                ['lo', 'lo zaino', 'lo '],
                ['la', 'la zaino', 'la '],
                ['i', 'i zaino', 'i '],
                ['gli', 'gli zaino', 'gli '],
                ['le', 'le zaino', 'le '],
                ['un', 'un zaino', 'un '],
                ['uno', 'uno zaino', 'uno '],
                ['una', 'una zaino', 'una '],
                ["un'", "un'zaino", "un'"],
                ["un’", "un’zaino", "un’"],
            ])("allows Italian article '%s'", (article, expectedWord, expectedPrefix) => {
                const translations: TranslationItem[] = [
                    { source: 'zaino', sourceArticle: article, isValid: true, translations: ['plecak'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [itNoun]);

                expect(result[0]).toMatchObject({ word: expectedWord, prefix: expectedPrefix });
            });
        });

        describe('Italian verbs', () => {
            it("ignores article for Italian verb (verbs have no allowed prefixes in 'it')", () => {
                const itVerb: LemmaAttrWithId = { ...baseLemma, _id: 'it6', lang: 'it', lemma: 'cantare', type: 'verb' };
                const translations: TranslationItem[] = [
                    { source: 'cantare', sourceArticle: 'il', isValid: true, translations: ['śpiewać'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [itVerb]);

                expect(result).toEqual([
                    { lemmaId: 'it6', lemma: 'cantare', isValid: true, word: 'cantare', translation: 'śpiewać', example: null, prefix: null },
                ]);
            });
        });

        describe('Polish', () => {
            it("ignores any article for Polish nouns (no allowed prefixes for 'pl')", () => {
                const plNoun: LemmaAttrWithId = { ...baseLemma, _id: 'pl1', lang: 'pl', lemma: 'pies', type: 'subst' };
                const translations: TranslationItem[] = [
                    { source: 'pies', sourceArticle: 'ten', isValid: true, translations: ['dog'], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [plNoun]);

                expect(result).toEqual([
                    { lemmaId: 'pl1', lemma: 'pies', isValid: true, word: 'pies', translation: 'dog', example: null, prefix: null },
                ]);
            });
        });

        describe('isValid edge cases', () => {
            it("treats isValid=true with empty translations as invalid", () => {
                const itNoun: LemmaAttrWithId = { ...baseLemma, _id: 'it7', lang: 'it', lemma: 'amico', type: 'subst' };
                const translations: TranslationItem[] = [
                    { source: 'amico', sourceArticle: "l'", isValid: true, translations: [], example: null },
                ];

                const result = matchTranslationsToLemmas(translations, [itNoun]);

                expect(result).toEqual([
                    { lemmaId: 'it7', lemma: 'amico', isValid: false, word: "l'amico", translation: null, example: null, prefix: "l'" },
                ]);
            });
        });
    });
});
