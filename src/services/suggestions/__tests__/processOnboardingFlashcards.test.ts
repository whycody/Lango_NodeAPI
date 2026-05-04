import { Types } from 'mongoose';

import Suggestion from '../../../models/core/Suggestion';
import Word from '../../../models/core/Word';
import Lemma from '../../../models/lemmas/Lemma';
import LemmaTranslation from '../../../models/lemmas/LemmaTranslation';
import { generateSuggestionsInBackground } from '../generateSuggestions';
import { processOnboardingFlashcards } from '../processOnboardingFlashcards';

jest.mock('../../../models/lemmas/LemmaTranslation');
jest.mock('../../../models/lemmas/Lemma');
jest.mock('../../../models/core/Suggestion');
jest.mock('../../../models/core/Word');
jest.mock('../generateSuggestions');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

const ltIdSelected = new Types.ObjectId();
const ltIdSkipped = new Types.ObjectId();
const lemmaIdSelected = new Types.ObjectId();
const lemmaIdSkipped = new Types.ObjectId();

const mockLemmaTranslations = [
    {
        _id: ltIdSelected,
        lemmaId: lemmaIdSelected,
        translation: 'dom',
        example: { source: 'La casa è grande.', target: 'Dom jest duży.' },
    },
    {
        _id: ltIdSkipped,
        lemmaId: lemmaIdSkipped,
        translation: 'kot',
        example: null,
    },
];

const mockLemmas = [
    { _id: lemmaIdSelected, lemma: 'casa', prefix: 'la ' },
    { _id: lemmaIdSkipped, lemma: 'gatto', prefix: '' },
];

describe('processOnboardingFlashcards', () => {
    const userId = 'user123';
    const mainLang = 'it' as const;
    const translationLang = 'pl' as const;

    beforeEach(() => {
        jest.clearAllMocks();
        (generateSuggestionsInBackground as jest.Mock).mockResolvedValue(undefined);
        (Suggestion.insertMany as jest.Mock).mockResolvedValue([]);
        (Word.insertMany as jest.Mock).mockResolvedValue([]);
        (LemmaTranslation.updateMany as jest.Mock).mockResolvedValue({});
    });

    describe('when no flashcard IDs are provided', () => {
        it('calls generateSuggestionsInBackground and skips DB queries', async () => {
            await processOnboardingFlashcards(userId, mainLang, translationLang, [], []);

            expect(generateSuggestionsInBackground).toHaveBeenCalledWith(
                userId,
                mainLang,
                translationLang,
                true,
            );
            expect(LemmaTranslation.find).not.toHaveBeenCalled();
        });
    });

    describe('Suggestion creation', () => {
        beforeEach(() => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmaTranslations),
            });
            (Lemma.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmas),
            });
        });

        it('creates Suggestion with added:true for selected flashcards', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [],
            );

            const inserted = (Suggestion.insertMany as jest.Mock).mock.calls[0][0];
            expect(inserted).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ lemma: 'casa', added: true, skipped: false }),
                ]),
            );
        });

        it('creates Suggestion with skipped:true for skipped flashcards', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [],
                [ltIdSkipped.toString()],
            );

            const inserted = (Suggestion.insertMany as jest.Mock).mock.calls[0][0];
            expect(inserted).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ lemma: 'gatto', added: false, skipped: true }),
                ]),
            );
        });

        it('sets correct fields on each Suggestion', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [],
            );

            const inserted = (Suggestion.insertMany as jest.Mock).mock.calls[0][0];
            expect(inserted[0]).toMatchObject({
                userId,
                mainLang,
                translationLang,
                lemma: 'casa',
                word: 'la casa',
                translation: 'dom',
                example: { source: 'La casa è grande.', target: 'Dom jest duży.' },
            });
        });

        it('skips flashcards with null translation', async () => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest
                    .fn()
                    .mockResolvedValue([{ ...mockLemmaTranslations[0], translation: null }]),
            });

            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [],
            );

            expect(Suggestion.insertMany).not.toHaveBeenCalled();
        });
    });

    describe('Word creation', () => {
        beforeEach(() => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmaTranslations),
            });
            (Lemma.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmas),
            });
        });

        it('creates Word only for selected flashcards, not skipped', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [ltIdSkipped.toString()],
            );

            const insertedWords = (Word.insertMany as jest.Mock).mock.calls[0][0];
            expect(insertedWords).toHaveLength(1);
            expect(insertedWords[0].text).toBe('la casa');
        });

        it('sets correct fields on each Word', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [],
            );

            const insertedWords = (Word.insertMany as jest.Mock).mock.calls[0][0];
            expect(insertedWords[0]).toMatchObject({
                _id: 'mock-uuid',
                text: 'la casa',
                translation: 'dom',
                source: 'onboarding',
                userId,
                mainLang,
                translationLang,
                lemmas: ['casa'],
            });
        });

        it('builds word text without prefix when lemma has no prefix', async () => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue([mockLemmaTranslations[1]]),
            });
            (Lemma.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue([mockLemmas[1]]),
            });

            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSkipped.toString()],
                [],
            );

            const insertedWords = (Word.insertMany as jest.Mock).mock.calls[0][0];
            expect(insertedWords[0].text).toBe('gatto');
        });

        it('does not call Word.insertMany when selected list is empty', async () => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue([mockLemmaTranslations[1]]),
            });

            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [],
                [ltIdSkipped.toString()],
            );

            expect(Word.insertMany).not.toHaveBeenCalled();
        });
    });

    describe('LemmaTranslation count updates', () => {
        beforeEach(() => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmaTranslations),
            });
            (Lemma.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmas),
            });
        });

        it('increments addCount for selected IDs', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [],
            );

            expect(LemmaTranslation.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ _id: { $in: expect.any(Array) } }),
                { $inc: { addCount: 1 } },
            );
        });

        it('increments skipCount for skipped IDs', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [],
                [ltIdSkipped.toString()],
            );

            expect(LemmaTranslation.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ _id: { $in: expect.any(Array) } }),
                { $inc: { skipCount: 1 } },
            );
        });

        it('does not call updateMany for addCount when selected list is empty', async () => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue([mockLemmaTranslations[1]]),
            });

            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [],
                [ltIdSkipped.toString()],
            );

            const calls = (LemmaTranslation.updateMany as jest.Mock).mock.calls;
            const addCountCall = calls.find(([, update]) => update.$inc?.addCount);
            expect(addCountCall).toBeUndefined();
        });

        it('does not call updateMany for skipCount when skipped list is empty', async () => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue([mockLemmaTranslations[0]]),
            });

            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [],
            );

            const calls = (LemmaTranslation.updateMany as jest.Mock).mock.calls;
            const skipCountCall = calls.find(([, update]) => update.$inc?.skipCount);
            expect(skipCountCall).toBeUndefined();
        });
    });

    describe('generateSuggestionsInBackground', () => {
        beforeEach(() => {
            (LemmaTranslation.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmaTranslations),
            });
            (Lemma.find as jest.Mock).mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockLemmas),
            });
        });

        it('calls generateSuggestionsInBackground with correct args after processing', async () => {
            await processOnboardingFlashcards(
                userId,
                mainLang,
                translationLang,
                [ltIdSelected.toString()],
                [ltIdSkipped.toString()],
            );

            expect(generateSuggestionsInBackground).toHaveBeenCalledWith(
                userId,
                mainLang,
                translationLang,
                true,
            );
        });
    });
});
