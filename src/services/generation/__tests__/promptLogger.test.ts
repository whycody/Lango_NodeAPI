jest.mock('../../../models/PromptReport', () => ({
  PromptReport: {
    create: jest.fn(),
  },
}));

import { logPromptReport } from '../promptLogger';
import { PromptReport } from '../../../models/PromptReport';

describe('logPromptReport', () => {
  const mockData = {
    prompt: 'test prompt',
    words: ['word1', 'word2'],
    excludedWords: [],
    totalWords: 2,
    hasExcludedWords: false,
    addedWords: ['word1'],
    model: 'gpt-4',
    success: true,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('calls PromptReport.create with correct data and returns the result', async () => {
    (PromptReport.create as jest.Mock).mockResolvedValue('createdRecord');

    const result = await logPromptReport(mockData);

    expect(PromptReport.create).toHaveBeenCalledWith(mockData);
    expect(result).toBe('createdRecord');
  });

  test('logs error and rethrows if PromptReport.create throws', async () => {
    const error = new Error('DB error');
    (PromptReport.create as jest.Mock).mockRejectedValue(error);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(logPromptReport(mockData)).rejects.toThrow(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error logging prompt report:', error);

    consoleErrorSpy.mockRestore();
  });
});