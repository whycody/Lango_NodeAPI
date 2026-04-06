import { generateSuggestionsInBackground } from '../generateSuggestions';
import { FastAPISuggestionsRepository } from '../repositories/FastAPISuggestionRepository';
import Lemma from '../../../models/lemmas/Lemma';
import Suggestion from '../../../models/core/Suggestion';
import LemmaTranslation from '../../../models/lemmas/LemmaTranslation';
import User from '../../../models/core/User';
import { getLemmasIdsToTranslate } from '../utils/getLemmasToTranslate';
import { matchTranslationsToLemmas } from '../utils/matchTranslationsToLemmas';
import { translateWords } from '../translateWords';
import { saveGPTReport } from '../utils/reports/saveGPTReport';
import { saveSuggestionsReport } from '../utils/reports/saveSuggestionsReport';
import { withGenerationLock } from '../utils/withGenerationLock';

jest.mock('../repositories/FastAPISuggestionRepository');
jest.mock('../../../models/lemmas/Lemma');
jest.mock('../../../models/core/Suggestion');
jest.mock('../../../models/lemmas/LemmaTranslation');
jest.mock('../../../models/core/User');
jest.mock('../utils/getLemmasToTranslate');
jest.mock('../utils/matchTranslationsToLemmas');
jest.mock('../translateWords');
jest.mock('../utils/reports/saveGPTReport');
jest.mock('../utils/reports/saveSuggestionsReport');
jest.mock('../utils/withGenerationLock');

const lemmas = {
    casa: {
        _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        lemma: 'casa',
        prefix: 'la ',
        type: 'subst',
        lang: 'it',
        freq: 1,
        freq_z: 0,
    },
    gatto: {
        _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        lemma: 'gatto',
        prefix: '',
        type: 'subst',
        lang: 'it',
        freq: 1,
        freq_z: 0,
    },
    cane: {
        _id: 'cccccccccccccccccccccccc',
        lemma: 'cane',
        prefix: '',
        type: 'subst',
        lang: 'it',
        freq: 1,
        freq_z: 0,
    },
};

describe('generateSuggestionsInBackground', () => {
    const userId = 'user123';
    const mainLang = 'it';
    const translationLang = 'pl';

    beforeEach(() => {
        jest.clearAllMocks();

        (withGenerationLock as jest.Mock).mockImplementation(
            async (_key: string, fn: () => Promise<void>) => fn(),
        );

        (User.findOne as jest.Mock).mockResolvedValue({
            languageLevels: [{ language: 'it', level: 2 }],
        });

        (Suggestion.insertMany as jest.Mock).mockResolvedValue([]);
        (LemmaTranslation.insertMany as jest.Mock).mockResolvedValue([]);
        (Lemma.updateOne as jest.Mock).mockResolvedValue({});
        (saveGPTReport as jest.Mock).mockResolvedValue(undefined);
        (saveSuggestionsReport as jest.Mock).mockResolvedValue(undefined);
    });

    it('creates suggestions from already translated lemmas without calling GPT', async () => {
        const suggestedLemmasIds = [lemmas.casa._id, lemmas.gatto._id];

        FastAPISuggestionsRepository.prototype.getUserSuggestions = jest.fn().mockResolvedValue({
            suggested_lemmas_ids: suggestedLemmasIds,
            median_freq: 50,
        });

        (Lemma.find as jest.Mock).mockImplementation(query => {
            if (query._id.$in === suggestedLemmasIds) {
                return {
                    lean: jest.fn().mockResolvedValue([lemmas.casa, lemmas.gatto]),
                };
            }
            return { lean: jest.fn().mockResolvedValue([]) };
        });

        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([]);

        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                {
                    lemmaId: lemmas.casa._id,
                    translation: 'dom',
                    example: { source: 'La casa è grande.', target: 'Dom jest duży.' },
                },
                {
                    lemmaId: lemmas.gatto._id,
                    translation: 'kot',
                    example: null,
                },
            ]),
        });

        await generateSuggestionsInBackground(userId, mainLang, translationLang);

        expect(translateWords).not.toHaveBeenCalled();
        expect(Suggestion.insertMany).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    lemma: 'casa',
                    translation: 'dom',
                    example: { source: 'La casa è grande.', target: 'Dom jest duży.' },
                }),
                expect.objectContaining({
                    lemma: 'gatto',
                    translation: 'kot',
                    example: null,
                }),
            ]),
        );
    });

    it('calls GPT for untranslated lemmas and saves translations', async () => {
        const suggestedLemmasIds = [lemmas.casa._id, lemmas.cane._id];

        FastAPISuggestionsRepository.prototype.getUserSuggestions = jest.fn().mockResolvedValue({
            suggested_lemmas_ids: suggestedLemmasIds,
            median_freq: 50,
        });

        (Lemma.find as jest.Mock).mockImplementation(query => {
            const ids = query._id.$in;
            if (ids === suggestedLemmasIds) {
                return {
                    lean: jest.fn().mockResolvedValue([lemmas.casa, lemmas.cane]),
                };
            }
            if (ids.includes(lemmas.cane._id)) {
                return { lean: jest.fn().mockResolvedValue([lemmas.cane]) };
            }
            return { lean: jest.fn().mockResolvedValue([]) };
        });

        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([lemmas.cane._id]);

        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                {
                    lemmaId: lemmas.casa._id,
                    translation: 'dom',
                    example: null,
                },
            ]),
        });

        (translateWords as jest.Mock).mockResolvedValue({
            translations: [
                {
                    source: 'cane',
                    sourceArticle: 'il ',
                    isValid: true,
                    translations: ['pies'],
                    example: { source: 'Il cane corre.', target: 'Pies biega.' },
                },
            ],
            fetchMetadata: { prompt: 'test', response: 'test' },
        });

        (matchTranslationsToLemmas as jest.Mock).mockReturnValue([
            {
                lemmaId: lemmas.cane._id,
                lemma: 'cane',
                isValid: true,
                word: 'il cane',
                translation: 'pies',
                example: { source: 'Il cane corre.', target: 'Pies biega.' },
                prefix: 'il ',
            },
        ]);

        await generateSuggestionsInBackground(userId, mainLang, translationLang);

        expect(translateWords).toHaveBeenCalledWith(mainLang, translationLang, ['cane']);
        expect(saveGPTReport).toHaveBeenCalled();
        expect(LemmaTranslation.insertMany).toHaveBeenCalled();
        expect(Lemma.updateOne).toHaveBeenCalledWith(
            { _id: lemmas.cane._id },
            { $set: { prefix: 'il ' } },
        );
    });

    it('does not create suggestions for invalid translations', async () => {
        const suggestedLemmasIds = [lemmas.gatto._id];

        FastAPISuggestionsRepository.prototype.getUserSuggestions = jest.fn().mockResolvedValue({
            suggested_lemmas_ids: suggestedLemmasIds,
            median_freq: 50,
        });

        (Lemma.find as jest.Mock).mockImplementation(query => {
            const ids = query._id.$in;
            if (ids === suggestedLemmasIds || ids.includes(lemmas.gatto._id)) {
                return { lean: jest.fn().mockResolvedValue([lemmas.gatto]) };
            }
            return { lean: jest.fn().mockResolvedValue([]) };
        });

        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([lemmas.gatto._id]);

        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        (translateWords as jest.Mock).mockResolvedValue({
            translations: [
                {
                    source: 'gatto',
                    sourceArticle: null,
                    isValid: false,
                    translations: [],
                    example: null,
                },
            ],
            fetchMetadata: { prompt: 'test', response: 'test' },
        });

        (matchTranslationsToLemmas as jest.Mock).mockReturnValue([
            {
                lemmaId: lemmas.gatto._id,
                lemma: 'gatto',
                isValid: false,
                word: 'gatto',
                translation: '',
                example: null,
                prefix: null,
            },
        ]);

        await generateSuggestionsInBackground(userId, mainLang, translationLang);

        const insertedTranslations = (LemmaTranslation.insertMany as jest.Mock).mock.calls[0]?.[0];

        expect(insertedTranslations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    translation: null,
                }),
            ]),
        );

        expect(Suggestion.insertMany).not.toHaveBeenCalled();
    });

    it('does not insert LemmaTranslations when all lemmas are already translated', async () => {
        const suggestedLemmasIds = [lemmas.casa._id];

        FastAPISuggestionsRepository.prototype.getUserSuggestions = jest.fn().mockResolvedValue({
            suggested_lemmas_ids: suggestedLemmasIds,
            median_freq: 50,
        });

        (Lemma.find as jest.Mock).mockImplementation(query => {
            const ids = query._id.$in;
            if (ids.length === 0) {
                return { lean: jest.fn().mockResolvedValue([]) };
            }
            return { lean: jest.fn().mockResolvedValue([lemmas.casa]) };
        });

        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([]);

        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                {
                    lemmaId: lemmas.casa._id,
                    translation: 'dom',
                    example: null,
                },
            ]),
        });

        await generateSuggestionsInBackground(userId, mainLang, translationLang);

        expect(LemmaTranslation.insertMany).not.toHaveBeenCalled();
    });

    it('acquires generation lock with correct key', async () => {
        FastAPISuggestionsRepository.prototype.getUserSuggestions = jest.fn().mockResolvedValue({
            suggested_lemmas_ids: [],
            median_freq: 50,
        });

        (Lemma.find as jest.Mock).mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue([]),
        }));

        (getLemmasIdsToTranslate as jest.Mock).mockResolvedValue([]);

        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        await generateSuggestionsInBackground(userId, mainLang, translationLang);

        expect(withGenerationLock).toHaveBeenCalledWith(
            `${userId}_${mainLang}_${translationLang}`,
            expect.any(Function),
        );
    });
});
