import Lemma from '../../../models/lemmas/Lemma';
import LemmaTranslation from '../../../models/lemmas/LemmaTranslation';
import { SuggestionsRepository } from '../../../types/api/SuggestionsRepository';
import { populateLemmaTranslations } from '../populateLemmaTranslations';
import { translateWords } from '../translateWords';
import { getLemmasIdsToTranslate } from '../utils/getLemmasToTranslate';
import { matchTranslationsToLemmas } from '../utils/matchTranslationsToLemmas';
import { saveGPTReport } from '../utils/reports/saveGPTReport';

jest.mock('../../../models/lemmas/Lemma');
jest.mock('../../../models/lemmas/LemmaTranslation');
jest.mock('../utils/getLemmasToTranslate');
jest.mock('../utils/markUnknownTranslations');
jest.mock('../utils/matchTranslationsToLemmas');
jest.mock('../translateWords');
jest.mock('../utils/reports/saveGPTReport');

const lemmas = {
    casa: {
        _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        freq: 1,
        freq_z: 0,
        lang: 'it',
        lemma: 'casa',
        prefix: 'la ',
        type: 'subst',
    },
    cane: {
        _id: 'cccccccccccccccccccccccc',
        freq: 1,
        freq_z: 0,
        lang: 'it',
        lemma: 'cane',
        prefix: '',
        type: 'subst',
    },
    gatto: {
        _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        freq: 1,
        freq_z: 0,
        lang: 'it',
        lemma: 'gatto',
        prefix: '',
        type: 'subst',
    },
};

const emptyFastAPIResponse = { median_freq: 0, suggested_lemmas_ids: [] };

const makeRepo = (getUserSuggestions: jest.Mock): SuggestionsRepository => ({
    getUserSuggestions,
});

const isItPlLevel1 = (params: { mainLang: string; translationLang: string; level: number }) =>
    params.mainLang === 'it' && params.translationLang === 'pl' && params.level === 1;

describe('populateLemmaTranslations', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (Lemma.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue([]),
        }));
        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });
        (LemmaTranslation.insertMany as jest.Mock).mockResolvedValue([]);
        (Lemma.updateOne as jest.Mock).mockResolvedValue({});
        (saveGPTReport as jest.Mock).mockResolvedValue(undefined);
        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([]);
    });

    it('iterates every pair × level and skips same-language pairs', async () => {
        const getUserSuggestions = jest.fn().mockResolvedValue(emptyFastAPIResponse);

        await populateLemmaTranslations(10, makeRepo(getUserSuggestions));

        expect(getUserSuggestions).toHaveBeenCalledTimes(60);

        for (const [params] of getUserSuggestions.mock.calls) {
            expect(params.mainLang).not.toBe(params.translationLang);
        }
    });

    it('does not pass userId to FastAPI', async () => {
        const getUserSuggestions = jest.fn().mockResolvedValue(emptyFastAPIResponse);

        await populateLemmaTranslations(5, makeRepo(getUserSuggestions));

        for (const [params] of getUserSuggestions.mock.calls) {
            expect(params.userId).toBeUndefined();
        }
    });

    it('passes targetCount as FastAPI limit', async () => {
        const getUserSuggestions = jest.fn().mockResolvedValue(emptyFastAPIResponse);

        await populateLemmaTranslations(17, makeRepo(getUserSuggestions));

        for (const [params] of getUserSuggestions.mock.calls) {
            expect(params.limit).toBe(17);
        }
    });

    it('calls FastAPI with every level from 1 to 5 for each pair', async () => {
        const getUserSuggestions = jest.fn().mockResolvedValue(emptyFastAPIResponse);

        await populateLemmaTranslations(10, makeRepo(getUserSuggestions));

        const levelsForItPl = getUserSuggestions.mock.calls
            .filter(([p]) => p.mainLang === 'it' && p.translationLang === 'pl')
            .map(([p]) => p.level);

        expect(levelsForItPl.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('skips triple without GPT when all pool lemmas already have valid translations', async () => {
        const suggestedIds = [lemmas.casa._id, lemmas.gatto._id];
        const getUserSuggestions = jest.fn().mockResolvedValue({
            median_freq: 0,
            suggested_lemmas_ids: suggestedIds,
        });

        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                { lemmaId: lemmas.casa._id, translation: 'dom' },
                { lemmaId: lemmas.gatto._id, translation: 'kot' },
            ]),
        });

        const results = await populateLemmaTranslations(2, makeRepo(getUserSuggestions));

        expect(translateWords).not.toHaveBeenCalled();
        expect(LemmaTranslation.insertMany).not.toHaveBeenCalled();

        for (const entry of results) {
            expect(entry.validInPool).toBe(2);
            expect(entry.batches).toBe(0);
        }
    });

    it('translates untranslated pool lemmas and stops once all in pool have translations', async () => {
        const suggestedIds = [lemmas.casa._id, lemmas.cane._id];

        const getUserSuggestions = jest.fn().mockImplementation(params =>
            Promise.resolve(
                isItPlLevel1(params)
                    ? { median_freq: 0, suggested_lemmas_ids: suggestedIds }
                    : emptyFastAPIResponse,
            ),
        );

        const insertedTranslations: Array<{ lemmaId: unknown; translation: string | null }> = [];
        (LemmaTranslation.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue(insertedTranslations),
        }));
        (LemmaTranslation.insertMany as jest.Mock).mockImplementation(
            (docs: Array<{ lemmaId: unknown; translation: string | null }>) => {
                insertedTranslations.push(...docs);
                return Promise.resolve([]);
            },
        );
        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([
            lemmas.casa._id,
            lemmas.cane._id,
        ]);
        (Lemma.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue([lemmas.casa, lemmas.cane]),
        }));

        (translateWords as jest.Mock).mockResolvedValue({
            fetchMetadata: { prompt: 'x', response: 'y' },
            translations: [],
        });

        (matchTranslationsToLemmas as jest.Mock).mockReturnValue([
            {
                example: null,
                isValid: true,
                lemma: 'casa',
                lemmaId: lemmas.casa._id,
                prefix: 'la ',
                translation: 'dom',
                word: 'la casa',
            },
            {
                example: null,
                isValid: true,
                lemma: 'cane',
                lemmaId: lemmas.cane._id,
                prefix: null,
                translation: 'pies',
                word: 'cane',
            },
        ]);

        const results = await populateLemmaTranslations(2, makeRepo(getUserSuggestions));

        const target = results.find(
            r => r.mainLang === 'it' && r.translationLang === 'pl' && r.level === 1,
        );

        expect(translateWords).toHaveBeenCalledTimes(1);
        expect(translateWords).toHaveBeenCalledWith('it', 'pl', ['casa', 'cane']);
        expect(LemmaTranslation.insertMany).toHaveBeenCalledTimes(1);
        expect(saveGPTReport).toHaveBeenCalled();
        expect(target?.validInPool).toBe(2);
        expect(target?.batches).toBe(1);
    });

    it('delegates batch building (including top-up) to getLemmasIdsToTranslate', async () => {
        const suggestedIds = [lemmas.casa._id];

        const getUserSuggestions = jest.fn().mockImplementation(params =>
            Promise.resolve(
                isItPlLevel1(params)
                    ? { median_freq: 42, suggested_lemmas_ids: suggestedIds }
                    : emptyFastAPIResponse,
            ),
        );

        // Batch builder tops the single untranslated pool lemma up to 2 items
        const topUpIds = [lemmas.casa._id, lemmas.gatto._id];
        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue(topUpIds);

        const insertedTranslations: Array<{ lemmaId: unknown; translation: string | null }> = [];
        (LemmaTranslation.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue(insertedTranslations),
        }));
        (LemmaTranslation.insertMany as jest.Mock).mockImplementation(
            (docs: Array<{ lemmaId: unknown; translation: string | null }>) => {
                insertedTranslations.push(...docs);
                return Promise.resolve([]);
            },
        );
        (Lemma.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue([lemmas.casa, lemmas.gatto]),
        }));

        (translateWords as jest.Mock).mockResolvedValue({
            fetchMetadata: { prompt: 'x', response: 'y' },
            translations: [],
        });

        (matchTranslationsToLemmas as jest.Mock).mockReturnValue([
            {
                example: null,
                isValid: true,
                lemma: 'casa',
                lemmaId: lemmas.casa._id,
                prefix: null,
                translation: 'dom',
                word: 'casa',
            },
            {
                example: null,
                isValid: true,
                lemma: 'gatto',
                lemmaId: lemmas.gatto._id,
                prefix: null,
                translation: 'kot',
                word: 'gatto',
            },
        ]);

        await populateLemmaTranslations(1, makeRepo(getUserSuggestions));

        expect(getLemmasIdsToTranslate).toHaveBeenCalledWith(
            suggestedIds,
            'it',
            'pl',
            42,
            expect.any(Number),
        );
        expect(translateWords).toHaveBeenCalledWith('it', 'pl', ['casa', 'gatto']);
    });

    it('updates lemma prefix for valid translations', async () => {
        const suggestedIds = [lemmas.casa._id];

        const getUserSuggestions = jest.fn().mockImplementation(params =>
            Promise.resolve(
                isItPlLevel1(params)
                    ? { median_freq: 0, suggested_lemmas_ids: suggestedIds }
                    : emptyFastAPIResponse,
            ),
        );

        const insertedTranslations: Array<{ lemmaId: unknown; translation: string | null }> = [];
        (LemmaTranslation.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue(insertedTranslations),
        }));
        (LemmaTranslation.insertMany as jest.Mock).mockImplementation(
            (docs: Array<{ lemmaId: unknown; translation: string | null }>) => {
                insertedTranslations.push(...docs);
                return Promise.resolve([]);
            },
        );
        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([lemmas.casa._id]);
        (Lemma.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue([lemmas.casa]),
        }));

        (translateWords as jest.Mock).mockResolvedValue({
            fetchMetadata: { prompt: 'x', response: 'y' },
            translations: [],
        });

        (matchTranslationsToLemmas as jest.Mock).mockReturnValue([
            {
                example: null,
                isValid: true,
                lemma: 'casa',
                lemmaId: lemmas.casa._id,
                prefix: 'la ',
                translation: 'dom',
                word: 'la casa',
            },
        ]);

        await populateLemmaTranslations(1, makeRepo(getUserSuggestions));

        expect(Lemma.updateOne).toHaveBeenCalledWith(
            { _id: lemmas.casa._id },
            { $set: { prefix: 'la ' } },
        );
    });

    it('breaks out of triple loop when FastAPI returns no suggestions', async () => {
        const getUserSuggestions = jest.fn().mockResolvedValue(emptyFastAPIResponse);

        const results = await populateLemmaTranslations(10, makeRepo(getUserSuggestions));

        expect(translateWords).not.toHaveBeenCalled();
        expect(LemmaTranslation.find).not.toHaveBeenCalled();
        for (const entry of results) {
            expect(entry.validInPool).toBe(0);
            expect(entry.batches).toBe(0);
        }
    });

});
