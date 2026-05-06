import Lemma from '../../../models/lemmas/Lemma';
import * as medianUtils from '../../../utils/median';
import { getExampleFlashcards } from '../getExampleFlashcards';

jest.mock('../../../models/lemmas/Lemma');
jest.mock('../../../utils/median');

const LEMMA_ID_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const LEMMA_ID_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

describe('getExampleFlashcards', () => {
    const mainLang = 'it';
    const translationLang = 'pl';
    const level = 2;
    const count = 5;

    beforeEach(() => {
        jest.clearAllMocks();
        (medianUtils.getMedianFreq as jest.Mock).mockResolvedValue(0.5);
        (Lemma.aggregate as jest.Mock).mockResolvedValue([]);
    });

    it('returns empty array when aggregate returns no results', async () => {
        const result = await getExampleFlashcards(mainLang, translationLang, level, count);
        expect(result).toEqual([]);
    });

    it('maps aggregate results to ExampleFlashcard shape with Lemma id', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([
            { _id: LEMMA_ID_A, word: 'la casa', translation: 'dom' },
            { _id: LEMMA_ID_B, word: 'gatto', translation: 'kot' },
        ]);

        const result = await getExampleFlashcards(mainLang, translationLang, level, count);

        expect(result).toEqual([
            { id: LEMMA_ID_A, word: 'la casa', translation: 'dom' },
            { id: LEMMA_ID_B, word: 'gatto', translation: 'kot' },
        ]);
    });

    it('returns results in the order returned by aggregate', async () => {
        (Lemma.aggregate as jest.Mock).mockResolvedValue([
            { _id: LEMMA_ID_B, word: 'gatto', translation: 'kot' },
            { _id: LEMMA_ID_A, word: 'la casa', translation: 'dom' },
        ]);

        const result = await getExampleFlashcards(mainLang, translationLang, level, count);

        expect(result[0].word).toBe('gatto');
        expect(result[1].word).toBe('la casa');
    });

    it('respects the count limit in the pipeline', async () => {
        await getExampleFlashcards(mainLang, translationLang, level, 3);

        const pipeline = (Lemma.aggregate as jest.Mock).mock.calls[0][0];
        const limitStage = pipeline.find((s: any) => s.$limit);
        expect(limitStage).toEqual({ $limit: 3 });
    });
});
