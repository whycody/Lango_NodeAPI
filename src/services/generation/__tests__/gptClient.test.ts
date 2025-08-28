import { buildPrompt, parseResponseText, detectExcludedWords, fetchNewWordsSuggestions } from '../gptClient';

describe('buildPrompt', () => {
  test('generates prompt with defaults=false', () => {
    const prompt = buildPrompt({
      mainLang: 'es',
      translationLang: 'pl',
      contextWords: ['libro', 'amigo'],
      defaults: false,
    });
    expect(prompt).toContain('Generate exactly 40 words in Spanish');
    expect(prompt).toContain('libro');
    expect(prompt).toContain('amigo');
  });

  test('generates prompt with defaults=true and contextWords length >= 100', () => {
    const prompt = buildPrompt({
      mainLang: 'en',
      translationLang: 'fr',
      contextWords: new Array(100).fill('word'),
      defaults: true,
    });
    expect(prompt).toContain('40 medium-level words in English');
  });

  test('generates prompt with defaults=true and contextWords length < 100', () => {
    const prompt = buildPrompt({
      mainLang: 'en',
      translationLang: 'fr',
      contextWords: new Array(10).fill('word'),
      defaults: true,
    });
    expect(prompt).toContain('40 basic-level words in English');
  });
});

describe('parseResponseText', () => {
  test('parses correct word pairs', () => {
    const input = 'el libro - the book; la mochila - the backpack; el amigo - the friend;';
    const result = parseResponseText(input);
    expect(result).toEqual([
      { word: 'el libro', translation: 'the book' },
      { word: 'la mochila', translation: 'the backpack' },
      { word: 'el amigo', translation: 'the friend' },
    ]);
  });

  test('ignores empty entries and trims dots', () => {
    const input = 'casa - house.; perro - dog;;';
    const result = parseResponseText(input);
    expect(result).toEqual([
      { word: 'casa', translation: 'house' },
      { word: 'perro', translation: 'dog' },
    ]);
  });
});

describe('detectExcludedWords', () => {
  test('detects excluded word if included', () => {
    const words = ['el libro', 'la mochila'];
    const excluded = ['libro'];
    expect(detectExcludedWords(words, excluded)).toBe(true);
  });

  test('returns false if no excluded words found', () => {
    const words = ['el gato', 'la silla'];
    const excluded = ['libro'];
    expect(detectExcludedWords(words, excluded)).toBe(false);
  });
});

// fetch mock setup for fetchNewWordsSuggestions
import fetch from 'node-fetch';
jest.mock('node-fetch', () => jest.fn());

describe('fetchNewWordsSuggestions', () => {
  beforeEach(() => {
    (fetch as unknown as jest.Mock).mockClear();
    process.env.OPENAI_API_KEY = 'testkey';
  });

  test('throws error if API key missing', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(fetchNewWordsSuggestions('en', 'pl', [], true)).rejects.toThrow('Missing OpenAI API key');
  });

  test('calls fetch and processes response correctly', async () => {
    (fetch as unknown as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        choices: [{ message: { content: 'el libro - the book; la mochila - the backpack;' } }],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      }),
    });

    const result = await fetchNewWordsSuggestions('es', 'en', ['test'], false, 'gpt-4o-mini');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.words).toEqual([
      { word: 'el libro', translation: 'the book' },
      { word: 'la mochila', translation: 'the backpack' },
    ]);
    expect(result.metadata.hasExcludedWords).toBe(false);
    expect(result.metadata.tokensInput).toBe(1000);
    expect(result.metadata.tokensOutput).toBe(500);
    expect(result.metadata.costUSD).toBeCloseTo((1000 / 1_000_000) * 0.60 + (500 / 1_000_000) * 2.40);
  });
});