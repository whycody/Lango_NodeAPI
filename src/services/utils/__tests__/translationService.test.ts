import Lemma from '../../../models/lemmas/Lemma';
import LemmaTranslation from '../../../models/lemmas/LemmaTranslation';
import { updateLemmaTranslationCounts } from '../translationService';

jest.mock('../../../models/lemmas/Lemma');
jest.mock('../../../models/lemmas/LemmaTranslation');

describe('updateLemmaTranslationCounts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates counts correctly', async () => {
        (Lemma.updateOne as jest.Mock).mockResolvedValue(undefined);
        (LemmaTranslation.updateOne as jest.Mock).mockResolvedValue(undefined);

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

        expect(LemmaTranslation.updateOne).toHaveBeenCalledWith(
            {
                lemmaId: 'lemma-1',
                translationLang: 'en',
            },
            {
                $inc: { addCount: 1, skipCount: 1 },
                $set: { mainLang: 'it' },
            },
        );

        expect(Lemma.updateOne).toHaveBeenCalledWith(
            { _id: 'lemma-1' },
            { $inc: { addCount: 1, skipCount: 1 } },
        );
    });
});
