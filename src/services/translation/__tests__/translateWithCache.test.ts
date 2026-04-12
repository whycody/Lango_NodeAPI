import { MicrosoftTranslatorClient } from '../../clients/MicrosoftTranslatorClient';
import { clearTranslationCacheForTests, translateTextWithCache } from '../translateWithCache';

const mockTranslateText = jest.fn();

jest.mock('../../clients/MicrosoftTranslatorClient', () => ({
    MicrosoftTranslatorClient: jest.fn().mockImplementation(() => ({
        translateText: (...args: unknown[]) => mockTranslateText(...args),
    })),
}));

describe('translateTextWithCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearTranslationCacheForTests();
    });

    it('returns cacheHit false for first request and true for second request', async () => {
        mockTranslateText.mockResolvedValue('dom');

        const first = await translateTextWithCache('casa', 'it', 'pl');
        const second = await translateTextWithCache('casa', 'it', 'pl');

        expect(first).toEqual({ cacheHit: false, translation: 'dom' });
        expect(second).toEqual({ cacheHit: true, translation: 'dom' });
        expect(mockTranslateText).toHaveBeenCalledTimes(1);
    });

    it('deduplicates in-flight requests for the same key', async () => {
        let release!: (value: string) => void;
        const pending = new Promise<string>(resolve => {
            release = resolve;
        });

        mockTranslateText.mockReturnValue(pending);

        const firstPromise = translateTextWithCache('casa', 'it', 'pl');
        const secondPromise = translateTextWithCache('casa', 'it', 'pl');

        release('dom');

        const [first, second] = await Promise.all([firstPromise, secondPromise]);

        expect(first).toEqual({ cacheHit: false, translation: 'dom' });
        expect(second).toEqual({ cacheHit: true, translation: 'dom' });
        expect(mockTranslateText).toHaveBeenCalledTimes(1);
    });

    it('builds separate cache keys for different language pairs', async () => {
        mockTranslateText
            .mockResolvedValueOnce('dom')
            .mockResolvedValueOnce('house')
            .mockResolvedValueOnce('casa');

        const itToPl = await translateTextWithCache('casa', 'it', 'pl');
        const itToEn = await translateTextWithCache('casa', 'it', 'en');
        const plToIt = await translateTextWithCache('dom', 'pl', 'it');

        expect(itToPl.translation).toBe('dom');
        expect(itToEn.translation).toBe('house');
        expect(plToIt.translation).toBe('casa');
        expect(mockTranslateText).toHaveBeenCalledTimes(3);
    });

    it('normalizes text for cache key comparison', async () => {
        mockTranslateText.mockResolvedValue('dom');

        const first = await translateTextWithCache('Casa', 'it', 'pl');
        const second = await translateTextWithCache('  casa   ', 'it', 'pl');

        expect(first).toEqual({ cacheHit: false, translation: 'dom' });
        expect(second).toEqual({ cacheHit: true, translation: 'dom' });
        expect(mockTranslateText).toHaveBeenCalledTimes(1);
    });

    it('constructs MicrosoftTranslatorClient lazily on first use', async () => {
        expect(MicrosoftTranslatorClient).toHaveBeenCalledTimes(0);

        mockTranslateText.mockResolvedValue('dom');
        await translateTextWithCache('casa', 'it', 'pl');

        expect(MicrosoftTranslatorClient).toHaveBeenCalledTimes(1);
    });
});
