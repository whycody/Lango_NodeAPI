import LemmaTranslation from '../../../models/lemmas/LemmaTranslation';
import { updateLemmaTranslationCounts } from '../translationService';

jest.mock('../../../models/lemmas/LemmaTranslation');

describe('updateLemmaTranslationCounts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fills missing mainLang for legacy LemmaTranslation before save', async () => {
        const save = jest.fn().mockResolvedValue(undefined);

        const legacyLemmaTranslation = {
            addCount: 2,
            skipCount: 1,
            mainLang: undefined,
            save,
        };

        (LemmaTranslation.findOne as jest.Mock).mockResolvedValue(legacyLemmaTranslation);

        const existingSuggestion: any = {
            added: false,
            lemmaId: 'lemma-1',
            mainLang: 'it',
            skipped: false,
            translationLang: 'en',
        };

        const suggestion: any = {
            added: true,
            skipped: true,
        };

        await updateLemmaTranslationCounts(existingSuggestion, suggestion);

        expect(legacyLemmaTranslation.mainLang).toBe('it');
        expect(legacyLemmaTranslation.addCount).toBe(3);
        expect(legacyLemmaTranslation.skipCount).toBe(2);
        expect(save).toHaveBeenCalledTimes(1);
    });
});
