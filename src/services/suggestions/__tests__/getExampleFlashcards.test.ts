import { Types } from 'mongoose';

import LemmaTranslation from '../../../models/lemmas/LemmaTranslation';
import Lemma from '../../../models/lemmas/Lemma';
import * as medianUtils from '../../../utils/median';
import { getExampleFlashcards } from '../getExampleFlashcards';

jest.mock('../../../models/lemmas/LemmaTranslation');
jest.mock('../../../models/lemmas/Lemma');
jest.mock('../../../utils/median');

const LEMMA_ID_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const LEMMA_ID_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const LT_ID_A = 'cccccccccccccccccccccccc';
const LT_ID_B = 'dddddddddddddddddddddddd';

describe('getExampleFlashcards', () => {
    const mainLang = 'it';
    const translationLang = 'pl';
    const level = 2;
    const count = 5;

    beforeEach(() => {
        jest.clearAllMocks();
        (medianUtils.getMedianFreq as jest.Mock).mockResolvedValue(0.5);
        (LemmaTranslation.distinct as jest.Mock).mockResolvedValue([]);
        // Chainable mock for LemmaTranslation.find().select().lean() on prototype
        jest.spyOn(LemmaTranslation, 'find').mockImplementation((() => ({
            select: () => ({
                lean: async () => [],
            }),
        })) as any);
    });

    it('returns empty array when no lemmaIds found', async () => {
        // getScoredLemmaIds zwraca pustą tablicę
        (Lemma.aggregate as jest.Mock).mockResolvedValue([]);
        const result = await getExampleFlashcards(mainLang, translationLang, level, count);
        expect(result).toEqual([]);
    });

    it('maps aggregate results to ExampleFlashcard shape', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([
            { _id: new Types.ObjectId(LEMMA_ID_A) },
            { _id: new Types.ObjectId(LEMMA_ID_B) },
        ]);
        (LemmaTranslation.aggregate as jest.Mock).mockResolvedValue([
            { _id: new Types.ObjectId(LT_ID_A), word: 'la casa', translation: 'dom' },
            { _id: new Types.ObjectId(LT_ID_B), word: 'gatto', translation: 'kot' },
        ]);
        const result = await getExampleFlashcards(mainLang, translationLang, level, count);
        expect(result).toEqual([
            { id: LT_ID_A, word: 'la casa', translation: 'dom' },
            { id: LT_ID_B, word: 'gatto', translation: 'kot' },
        ]);
    });

    it('returns results in the order returned by aggregate', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([
            { _id: new Types.ObjectId(LEMMA_ID_A) },
            { _id: new Types.ObjectId(LEMMA_ID_B) },
        ]);
        (LemmaTranslation.aggregate as jest.Mock).mockResolvedValue([
            { _id: new Types.ObjectId(LT_ID_B), word: 'gatto', translation: 'kot' },
            { _id: new Types.ObjectId(LT_ID_A), word: 'la casa', translation: 'dom' },
        ]);
        const result = await getExampleFlashcards(mainLang, translationLang, level, count);
        expect(result[0].word).toBe('gatto');
        expect(result[1].word).toBe('la casa');
    });

    it('pipeline $match filters by isValid, translationLang and non-null translation', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([{ _id: new Types.ObjectId(LEMMA_ID_A) }]);
        (LemmaTranslation.aggregate as jest.Mock).mockResolvedValue([]);
        await getExampleFlashcards(mainLang, translationLang, level, count);
        const pipeline = (LemmaTranslation.aggregate as jest.Mock).mock.calls[0][0];
        expect(pipeline[0].$match).toMatchObject({
            isValid: true,
            translationLang,
            translation: { $ne: null },
        });
    });

    it('pipeline includes $addFields sortOrder and $sort stages before $limit', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([{ _id: new Types.ObjectId(LEMMA_ID_A) }]);
        (LemmaTranslation.aggregate as jest.Mock).mockResolvedValue([]);
        await getExampleFlashcards(mainLang, translationLang, level, count);
        const pipeline = (LemmaTranslation.aggregate as jest.Mock).mock.calls[0][0];
        const addFieldsIndex = pipeline.findIndex((s: any) => s.$addFields?.sortOrder);
        const sortIndex = pipeline.findIndex((s: any) => s.$sort?.sortOrder === 1);
        const limitIndex = pipeline.findIndex((s: any) => s.$limit);
        expect(addFieldsIndex).toBeGreaterThanOrEqual(0);
        expect(sortIndex).toBeGreaterThan(addFieldsIndex);
        expect(limitIndex).toBeGreaterThan(sortIndex);
    });

    it('respects the count limit in the pipeline', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([{ _id: new Types.ObjectId(LEMMA_ID_A) }]);
        (LemmaTranslation.aggregate as jest.Mock).mockResolvedValue([]);
        await getExampleFlashcards(mainLang, translationLang, level, 3);
        const pipeline = (LemmaTranslation.aggregate as jest.Mock).mock.calls[0][0];
        const limitStage = pipeline.find((s: any) => s.$limit);
        expect(limitStage).toEqual({ $limit: 3 });
    });

    it('returns empty array when aggregate returns no results', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([{ _id: new Types.ObjectId(LEMMA_ID_A) }]);
        (LemmaTranslation.aggregate as jest.Mock).mockResolvedValue([]);
        const result = await getExampleFlashcards(mainLang, translationLang, level, count);
        expect(result).toEqual([]);
    });
});
