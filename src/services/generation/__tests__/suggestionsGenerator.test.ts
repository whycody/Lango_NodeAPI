import * as suggestionsGenerator from '../suggestionsGenerator';
import Word from '../../../models/Word';
import WordSuggestion from '../../../models/Suggestion';
import DefaultSuggestion from '../../../models/DefaultSuggestion';
import { fetchNewWordsSuggestions } from '../gptClient';
import { logPromptReport } from '../promptLogger';
import { isGenerationInProgress, startGeneration, endGeneration } from '../generationLock';
import { generateSuggestionsInBackground } from "../suggestionsGenerator";

jest.mock('../../../models/Word');
jest.mock('../../../models/Suggestion');
jest.mock('../../../models/DefaultSuggestion');
jest.mock('../gptClient');
jest.mock('../promptLogger');
jest.mock('../generationLock');

describe('generateSuggestionsInBackground', () => {
  const userId = 'user1';
  const mainLang = 'en';
  const translationLang = 'pl';

  beforeEach(() => {
    jest.clearAllMocks();
    (WordSuggestion.insertMany as jest.Mock) = jest.fn().mockResolvedValue(null);
    (DefaultSuggestion.insertMany as jest.Mock) = jest.fn().mockResolvedValue(null);
  });

  it('should not start generation if it is already in progress', async () => {
    (isGenerationInProgress as jest.Mock).mockReturnValue(true);

    await suggestionsGenerator.generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(isGenerationInProgress).toHaveBeenCalledWith(`${userId}_${mainLang}_${translationLang}`);
    expect(startGeneration).not.toHaveBeenCalled();
    expect(endGeneration).not.toHaveBeenCalled();
  });

  it('should call startGeneration and endGeneration', async () => {
    (isGenerationInProgress as jest.Mock).mockReturnValue(false);
    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (DefaultSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    (WordSuggestion.insertMany as jest.Mock).mockResolvedValue(undefined);
    (DefaultSuggestion.insertMany as jest.Mock).mockResolvedValue(undefined);
    (fetchNewWordsSuggestions as jest.Mock).mockResolvedValue({
      words: [],
      metadata: {}
    });
    (logPromptReport as jest.Mock).mockResolvedValue(undefined);

    await suggestionsGenerator.generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(startGeneration).toHaveBeenCalledWith(`${userId}_${mainLang}_${translationLang}`);
    expect(endGeneration).toHaveBeenCalledWith(`${userId}_${mainLang}_${translationLang}`);
  });

  it('should generate suggestions without user words - use defaults when unseen defaults exist', async () => {
    (isGenerationInProgress as jest.Mock).mockReturnValue(false);
    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (DefaultSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { word: 'banana', translation: 'banan' },
      ]),
    });

    (WordSuggestion.insertMany as jest.Mock).mockImplementation((args) => {
      return Promise.resolve();
    });

    (fetchNewWordsSuggestions as jest.Mock).mockResolvedValue({ words: [], metadata: {} });
    (logPromptReport as jest.Mock).mockResolvedValue(undefined);

    await suggestionsGenerator.generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(Word.find).toHaveBeenCalledWith({ mainLang, translationLang, userId });
    expect(DefaultSuggestion.find).toHaveBeenCalled();
    expect(WordSuggestion.insertMany).toHaveBeenCalled();
  });

  it('should generate suggestions using GPT when no user words and no unseen defaults exist', async () => {
    (isGenerationInProgress as jest.Mock).mockReturnValue(false);
    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (DefaultSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const mockGptResponse = {
      words: [{ word: 'mela', translation: 'jabłko' }],
      metadata: {
        prompt: '...',
        words: ['mela'],
        excludedWords: [],
        totalWords: 1,
        hasExcludedWords: false,
        model: 'gpt-4o-mini',
        success: true
      },
    };

    (fetchNewWordsSuggestions as jest.Mock).mockResolvedValue(mockGptResponse);
    (WordSuggestion.insertMany as jest.Mock).mockResolvedValue(undefined);
    (logPromptReport as jest.Mock).mockResolvedValue(undefined);

    await suggestionsGenerator.generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(fetchNewWordsSuggestions).toHaveBeenCalledWith(
      mainLang,
      translationLang,
      [],
      true
    );

    expect(WordSuggestion.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        word: 'mela',
        translation: 'jabłko',
        mainLang,
        translationLang,
        userId,
      }),
    ]);
  });

  it('should generate GPT suggestions using recent user words as context', async () => {
    const mockWords = [
      { text: 'cat', addDate: new Date('2025-06-01') },
      { text: 'dog', addDate: new Date('2025-06-05') },
      { text: 'apple', addDate: new Date('2025-06-10') },
    ];

    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValueOnce(mockWords).mockResolvedValueOnce([]),
    });

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (fetchNewWordsSuggestions as jest.Mock).mockResolvedValueOnce({
      words: [],
      metadata: {},
    });

    await generateSuggestionsInBackground('user1', 'en', 'pl');

    expect(fetchNewWordsSuggestions).toHaveBeenCalledWith('en', 'pl', ['apple', 'dog', 'cat']);
  });

  it('should store only unique suggestions not present in words or suggestions', async () => {
    const userId = 'user1';
    const mainLang = 'in';
    const translationLang = 'pl';

    const existingDefaults = [
      { word: 'hello', translation: 'cześć' },
    ];

    const existingUserWords = [
      { text: 'world' },
    ];

    const existingUserSuggestions = [
      { word: 'test' },
    ];

    const generated = {
      words: [
        { word: 'hello', translation: 'cześć' },
        { word: 'newword', translation: 'nowe słowo' },
        { word: 'test', translation: 'testowe' },
      ],
      metadata: {},
    };

    (DefaultSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(existingDefaults),
    });

    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnValue(existingUserWords),
    });

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValueOnce(existingUserSuggestions),
    });

    (fetchNewWordsSuggestions as jest.Mock).mockResolvedValue(generated);
    (WordSuggestion.insertMany as jest.Mock).mockResolvedValueOnce(null);
    (DefaultSuggestion.insertMany as jest.Mock).mockResolvedValueOnce(null);

    await generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(WordSuggestion.insertMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ word: 'newword', translation: 'nowe słowo' }),
    ]));
  });

  it('should call generateSuggestionsWithoutUserWords when user has no words', async () => {
    const userId = 'user1';
    const mainLang = 'en';
    const translationLang = 'pl';

    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValueOnce([]),
    });
    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValueOnce([]),
    });
    (DefaultSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValueOnce([{ word: 'default', translation: 'domyślne' }]),
    });
    (WordSuggestion.insertMany as jest.Mock).mockResolvedValueOnce(null);

    await generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(WordSuggestion.insertMany).toHaveBeenCalled();
  });

  it('should call generateSuggestionsWithUserWords when user has words', async () => {
    const userId = 'user1';
    const mainLang = 'en';
    const translationLang = 'pl';

    const userWords = [
      { text: 'cat', addDate: new Date('2025-06-01') },
      { text: 'dog', addDate: new Date('2025-06-05') },
      { text: 'apple', addDate: new Date('2025-06-10') },
    ];

    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(userWords),
    });
    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    (DefaultSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    (fetchNewWordsSuggestions as jest.Mock).mockResolvedValueOnce({
      words: [],
      metadata: {},
    });

    await generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(fetchNewWordsSuggestions).toHaveBeenCalledWith(mainLang, translationLang, ['apple', 'dog', 'cat']);
  });

  it('should store prompt metadata in logPromptReport', async () => {
    const userId = 'user1';
    const mainLang = 'en';
    const translationLang = 'pl';

    (Word.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    (DefaultSuggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const generated = {
      words: [{ word: 'newword', translation: 'nowe słowo' }],
      metadata: { promptTokens: 100, completionTokens: 50 },
    };
    (fetchNewWordsSuggestions as jest.Mock).mockResolvedValueOnce(generated);
    (WordSuggestion.insertMany as jest.Mock).mockResolvedValueOnce(null);
    (DefaultSuggestion.insertMany as jest.Mock).mockResolvedValueOnce(null);
    (logPromptReport as jest.Mock).mockResolvedValueOnce(null);

    await generateSuggestionsInBackground(userId, mainLang, translationLang);

    expect(logPromptReport).toHaveBeenCalledWith(expect.objectContaining({
      promptTokens: 100,
      completionTokens: 50,
      addedWords: ['newword'],
      userId,
      mainLang,
      translationLang,
    }));
  });
});
