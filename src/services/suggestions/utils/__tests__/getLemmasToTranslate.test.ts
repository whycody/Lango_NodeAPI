import { Types } from 'mongoose';
import LemmaTranslation from '../../../../models/lemmas/LemmaTranslation';
import Lemma from '../../../../models/lemmas/Lemma';
import { getLemmasIdsToTranslate } from '../getLemmasToTranslate';

jest.mock('../../../../models/lemmas/LemmaTranslation');
jest.mock('../../../../models/lemmas/Lemma');

describe('getLemmasIdsToTranslate', () => {
    const mainLang = 'it';
    const translationLang = 'pl';
    const lemmaIds = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];
    const medianFreq = 50;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns all lemmaIds as untranslated when no locales exist', async () => {
        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
        });

        (LemmaTranslation.distinct as jest.Mock).mockResolvedValue([]);
        (Lemma.aggregate as jest.Mock).mockResolvedValue([]);

        const result = await getLemmasIdsToTranslate(
            lemmaIds,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toEqual(lemmaIds);
    });

    it('returns an empty array when the limit of translated lemmas is already reached', async () => {
        const docs = lemmaIds.map(id => ({
            lemmaId: new Types.ObjectId(id),
            translation: 'something',
        }));
        (LemmaTranslation.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(docs),
        });

        const result = await getLemmasIdsToTranslate(
            lemmaIds,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toEqual([]);
    });

    it('selects additional candidate lemmas when untranslated lemmas are fewer than the limit', async () => {
        (LemmaTranslation.find as jest.Mock).mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue([{ lemmaId: new Types.ObjectId(lemmaIds[0]) }]),
        });

        (LemmaTranslation.distinct as jest.Mock).mockResolvedValue([]);
        (Lemma.aggregate as jest.Mock).mockResolvedValue([
            { _id: new Types.ObjectId('507f1f77bcf86cd799439011'), freq_z: 1.2 },
        ]);

        const result = await getLemmasIdsToTranslate(
            lemmaIds,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toContain(lemmaIds[1]);
        expect(result.length).toBe(2);
    });

    it('never returns more lemmaIds than the given limit', async () => {
        (LemmaTranslation.find as jest.Mock).mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue([]),
        });

        (LemmaTranslation.distinct as jest.Mock).mockResolvedValue([]);
        (Lemma.aggregate as jest.Mock).mockResolvedValue(
            Array.from({ length: 10 }).map((_, i) => ({
                _id: new Types.ObjectId(),
                freq_z: i,
            })),
        );

        const result = await getLemmasIdsToTranslate(
            lemmaIds,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result.length).toBeLessThanOrEqual(2);
    });

    it('excludes input pool lemma ids from top-up candidates', async () => {
        (LemmaTranslation.find as jest.Mock).mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue([]),
        });

        const existingTranslatedId = new Types.ObjectId();
        (LemmaTranslation.distinct as jest.Mock).mockResolvedValue([existingTranslatedId]);
        (Lemma.aggregate as jest.Mock).mockResolvedValue([]);

        await getLemmasIdsToTranslate(lemmaIds, mainLang, translationLang, medianFreq, 5);

        const pipeline = (Lemma.aggregate as jest.Mock).mock.calls[0][0];
        const matchStage = pipeline.find((stage: { $match?: unknown }) => stage.$match);
        const ninIds: Types.ObjectId[] = matchStage.$match._id.$nin;

        const ninIdStrings = ninIds.map(id => id.toString());
        expect(ninIdStrings).toContain(existingTranslatedId.toString());
        for (const poolId of lemmaIds) {
            expect(ninIdStrings).toContain(poolId);
        }
    });

    it('caps untranslated lemmaIds to the given limit', async () => {
        const manyLemmaIds = Array.from({ length: 5 }).map(() => new Types.ObjectId().toString());

        (LemmaTranslation.find as jest.Mock).mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue([]),
        });

        const result = await getLemmasIdsToTranslate(
            manyLemmaIds,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toEqual(manyLemmaIds.slice(0, 2));
    });
});
