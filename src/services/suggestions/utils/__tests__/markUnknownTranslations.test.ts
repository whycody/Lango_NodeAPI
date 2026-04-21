import { Types } from 'mongoose';

import Lemma from '../../../../models/lemmas/Lemma';
import { LemmaTranslationAttr } from '../../../../types/models/LemmaTranslationAttr';
import { markUnknownTranslations } from '../markUnknownTranslations';

jest.mock('../../../../models/lemmas/Lemma');

const makeTranslation = (
    translation: string | null,
    overrides: Partial<LemmaTranslationAttr> = {},
): LemmaTranslationAttr => ({
    addCount: 0,
    containsUnknownTranslations: false,
    example: null,
    isValid: translation !== null,
    lemmaId: new Types.ObjectId(),
    mainLang: 'pl',
    skipCount: 0,
    translation,
    translationLang: 'en',
    validated: false,
    ...overrides,
});

const mockKnownLemmas = (knownLemmaStrings: string[]) => {
    (Lemma.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(knownLemmaStrings.map(lemma => ({ lemma }))),
        }),
    });
};

describe('markUnknownTranslations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sets containsUnknownTranslations=true when any word is not in Lemma collection', async () => {
        const translations = [makeTranslation('dom, gibberish')];
        mockKnownLemmas(['dom']);

        await markUnknownTranslations(translations, 'en');

        expect(translations[0].containsUnknownTranslations).toBe(true);
    });

    it('keeps containsUnknownTranslations=false when all words are known', async () => {
        const translations = [makeTranslation('dom, mieszkanie')];
        mockKnownLemmas(['dom', 'mieszkanie']);

        await markUnknownTranslations(translations, 'en');

        expect(translations[0].containsUnknownTranslations).toBe(false);
    });

    it('is case-insensitive', async () => {
        const translations = [makeTranslation('Dom, MIESZKANIE')];
        mockKnownLemmas(['dom', 'mieszkanie']);

        await markUnknownTranslations(translations, 'en');

        expect(translations[0].containsUnknownTranslations).toBe(false);
    });

    it('skips translations with null translation (failed)', async () => {
        const translations = [makeTranslation(null)];
        mockKnownLemmas([]);

        await markUnknownTranslations(translations, 'en');

        expect(translations[0].containsUnknownTranslations).toBe(false);
        expect(Lemma.find).not.toHaveBeenCalled();
    });

    it('handles multi-word phrases by checking as single lemma', async () => {
        const translations = [makeTranslation('wake up')];
        mockKnownLemmas([]);

        await markUnknownTranslations(translations, 'en');

        expect(translations[0].containsUnknownTranslations).toBe(true);
    });

    it('processes multiple translations in one batch query', async () => {
        const translations = [
            makeTranslation('house'),
            makeTranslation('cat, dog'),
            makeTranslation('xyzunknown'),
        ];
        mockKnownLemmas(['house', 'cat', 'dog']);

        await markUnknownTranslations(translations, 'en');

        expect(translations[0].containsUnknownTranslations).toBe(false);
        expect(translations[1].containsUnknownTranslations).toBe(false);
        expect(translations[2].containsUnknownTranslations).toBe(true);
        expect(Lemma.find).toHaveBeenCalledTimes(1);
    });

    it('strips "to " prefix for English translations before lookup', async () => {
        const translations = [makeTranslation('to sign, to wake')];
        mockKnownLemmas(['sign', 'wake']);

        await markUnknownTranslations(translations, 'en');

        expect(translations[0].containsUnknownTranslations).toBe(false);
        expect(Lemma.find).toHaveBeenCalledWith({
            lang: 'en',
            lemma: { $in: ['sign', 'wake'] },
        });
    });

    it('does not strip "to " prefix for non-English translations', async () => {
        const translations = [makeTranslation('to robi')];
        mockKnownLemmas(['robi']);

        await markUnknownTranslations(translations, 'pl');

        expect(translations[0].containsUnknownTranslations).toBe(true);
    });

    it('queries Lemma with translationLang filter', async () => {
        const translations = [makeTranslation('house')];
        mockKnownLemmas(['house']);

        await markUnknownTranslations(translations, 'en');

        expect(Lemma.find).toHaveBeenCalledWith({
            lang: 'en',
            lemma: { $in: ['house'] },
        });
    });
});
