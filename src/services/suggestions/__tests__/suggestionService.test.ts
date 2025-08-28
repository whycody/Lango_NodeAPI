import { getSuggestionsForUser } from '../suggestionService';
import WordSuggestion from '../../../models/Suggestion';
import * as generationModule from '../../generation/suggestionsGenerator';

jest.mock('../../../models/Suggestion');
jest.mock('../../generation/suggestionsGenerator');

const MAX_MIN_DISPLAYED = 20;

describe('getSuggestionsForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return cleaned suggestions when suggestions count >= MAX_MIN_DISPLAYED and displayedLessThan3 <= MAX_MIN_DISPLAYED', async () => {
    const fakeSuggestions = Array(MAX_MIN_DISPLAYED).fill(null).map((_, i) => ({
      _id: `id${i}`,
      displayCount: 3,
      userId: 'user1',
      mainLang: 'en',
      translationLang: 'pl',
      skipped: false,
      updatedAt: new Date(),
    }));

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: () => Promise.resolve(fakeSuggestions),
    });
    const generateSpy = jest.spyOn(generationModule, 'generateSuggestionsInBackground');

    const result = await getSuggestionsForUser('user1', 'en', 'pl');

    expect(WordSuggestion.find).toHaveBeenCalledWith({
      userId: 'user1',
      skipped: false,
      mainLang: 'en',
      translationLang: 'pl',
    });
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(MAX_MIN_DISPLAYED);
    expect(result[0]).toHaveProperty('id', 'id0');
    expect(result[0]._id).toBeUndefined();
  });

  it('should call generateSuggestionsInBackground and fetch updated suggestions when suggestions count < MAX_MIN_DISPLAYED', async () => {
    const fewSuggestions = Array(10).fill(null).map((_, i) => ({
      _id: `id${i}`,
      displayCount: 5,
      userId: 'user1',
      mainLang: 'en',
      translationLang: 'pl',
      skipped: false,
      updatedAt: new Date(),
    }));

    (WordSuggestion.find as jest.Mock)
      .mockReturnValueOnce({ lean: () => Promise.resolve(fewSuggestions) })
      .mockReturnValueOnce({ lean: () => Promise.resolve(fewSuggestions) });

    const generateSpy = jest.spyOn(generationModule, 'generateSuggestionsInBackground');

    const result = await getSuggestionsForUser('user1', 'en', 'pl');

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(fewSuggestions.length);
    expect(result[0]).toHaveProperty('id', 'id0');
    expect(result[0]._id).toBeUndefined();
  });

  it('should add updatedAt filter if since parameter is provided', async () => {
    const sinceDate = '2025-06-17T00:00:00Z';

    const suggestions = Array(MAX_MIN_DISPLAYED).fill(null).map((_, i) => ({
      _id: `id${i}`,
      displayCount: 3,
      userId: 'user1',
      mainLang: 'en',
      translationLang: 'pl',
      skipped: false,
      updatedAt: new Date(),
    }));

    (WordSuggestion.find as jest.Mock).mockReturnValue({
      lean: () => Promise.resolve(suggestions),
    });

    await getSuggestionsForUser('user1', 'en', 'pl', sinceDate);

    expect(WordSuggestion.find).toHaveBeenCalledWith({
      userId: 'user1',
      skipped: false,
      mainLang: 'en',
      translationLang: 'pl',
      updatedAt: { $gt: new Date(sinceDate) },
    });
  });
});