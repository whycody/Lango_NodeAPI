import Lemma from '../../../../models/lemmas/Lemma';
import { SUGGESTIONS_TO_INSERT } from '../../../../constants/suggestions';
import { LanguageCodeValue } from '../../../../constants/languageCodes';
import { LemmaAttrWithId } from '../../../../types/models/LemmaAttr';
import { getLemmasIdsToTranslate } from '../getLemmasToTranslate';

jest.mock('../../../../models/lemmas/Lemma');

const makeLemma = (
    id: string,
    opts: {
        invalidTranslationsLanguages?: LanguageCodeValue[];
        validTranslationsLanguages?: LanguageCodeValue[];
    } = {},
): LemmaAttrWithId => ({
    _id: id,
    addCount: 0,
    freq: 1,
    freqZ: 0,
    invalidTranslationsLanguages: opts.invalidTranslationsLanguages ?? [],
    lang: 'it',
    lemma: 'word',
    prefix: '',
    skipCount: 0,
    type: 'subst',
    validTranslationsLanguages: opts.validTranslationsLanguages ?? [],
});

describe('getLemmasIdsToTranslate', () => {
    const mainLang: LanguageCodeValue = 'it';
    const translationLang: LanguageCodeValue = 'pl';
    const medianFreq = 50;

    beforeEach(() => {
        jest.clearAllMocks();
        (Lemma.aggregate as jest.Mock).mockResolvedValue([]);
    });

    it('returns all lemmas as untranslated when none have translations', async () => {
        const lemmas = [makeLemma('1'), makeLemma('2')];

        const result = await getLemmasIdsToTranslate(
            lemmas,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toEqual(lemmas);
        expect(Lemma.aggregate).not.toHaveBeenCalled();
    });

    it('returns empty array when valid translation count reaches SUGGESTIONS_TO_INSERT', async () => {
        const lemmas = Array.from({ length: SUGGESTIONS_TO_INSERT }, (_, i) =>
            makeLemma(`${i}`, { validTranslationsLanguages: [translationLang] }),
        );

        const result = await getLemmasIdsToTranslate(
            lemmas,
            mainLang,
            translationLang,
            medianFreq,
            5,
        );

        expect(result).toEqual([]);
        expect(Lemma.aggregate).not.toHaveBeenCalled();
    });

    it('fetches additional candidate lemmas when untranslated are fewer than the limit', async () => {
        const lemmas = [
            makeLemma('1', { validTranslationsLanguages: [translationLang] }),
            makeLemma('2'),
        ];
        const additionalLemma = makeLemma('extra');
        (Lemma.aggregate as jest.Mock).mockResolvedValue([additionalLemma]);

        const result = await getLemmasIdsToTranslate(
            lemmas,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toContainEqual(expect.objectContaining({ _id: '2' }));
        expect(result).toContainEqual(additionalLemma);
        expect(result).toHaveLength(2);
    });

    it('never returns more lemmas than the given limit', async () => {
        const lemmas = Array.from({ length: 5 }, (_, i) => makeLemma(`${i}`));

        const result = await getLemmasIdsToTranslate(
            lemmas,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toHaveLength(2);
        expect(Lemma.aggregate).not.toHaveBeenCalled();
    });

    it('excludes suggested lemma ids from additional candidate query', async () => {
        const lemmas = [makeLemma('1', { validTranslationsLanguages: [translationLang] })];

        await getLemmasIdsToTranslate(lemmas, mainLang, translationLang, medianFreq, 2);

        type MatchStage = { $match: { _id: { $nin: Array<{ toString(): string }> } } };
        const pipeline = (Lemma.aggregate as jest.Mock).mock.calls[0][0] as MatchStage[];
        const matchStage = pipeline.find(stage => stage.$match !== undefined);
        if (!matchStage) throw new Error('expected a $match stage in the pipeline');

        const ninIds = matchStage.$match._id.$nin.map(id => id.toString());
        expect(ninIds).toContain('1');
    });

    it('excludes lemmas with invalid translations from the untranslated list', async () => {
        const lemmas = [
            makeLemma('1', { invalidTranslationsLanguages: [translationLang] }),
            makeLemma('2'),
        ];

        const result = await getLemmasIdsToTranslate(
            lemmas,
            mainLang,
            translationLang,
            medianFreq,
            5,
        );

        expect(result).not.toContainEqual(expect.objectContaining({ _id: '1' }));
        expect(result).toContainEqual(expect.objectContaining({ _id: '2' }));
    });

    it('caps untranslated lemmas to the given limit', async () => {
        const lemmas = Array.from({ length: 5 }, (_, i) => makeLemma(`${i}`));

        const result = await getLemmasIdsToTranslate(
            lemmas,
            mainLang,
            translationLang,
            medianFreq,
            2,
        );

        expect(result).toEqual(lemmas.slice(0, 2));
    });
});
