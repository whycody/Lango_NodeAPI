import { endGeneration, isGenerationInProgress, startGeneration } from '../generationLock';

describe('generationLock', () => {
  const testKey = 'user1_en_pl';

  beforeEach(() => {
    if (isGenerationInProgress(testKey)) {
      endGeneration(testKey);
    }
  });

  test('startGeneration adds the key to the set', () => {
    expect(isGenerationInProgress(testKey)).toBe(false);
    startGeneration(testKey);
    expect(isGenerationInProgress(testKey)).toBe(true);
  });

  test('isGenerationInProgress returns false if the key is not in the set', () => {
    expect(isGenerationInProgress('non_existing_key')).toBe(false);
  });

  test('endGeneration removes the key from the set', () => {
    startGeneration(testKey);
    expect(isGenerationInProgress(testKey)).toBe(true);
    endGeneration(testKey);
    expect(isGenerationInProgress(testKey)).toBe(false);
  });

  test('endGeneration does not throw if the key does not exist', () => {
    expect(() => endGeneration('non_existing_key')).not.toThrow();
  });
});
