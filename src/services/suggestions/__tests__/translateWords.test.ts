import { translateWords } from '../translateWords';
import { buildTranslatingWordsPrompt } from '../../../utils/promptBuilder';
import { GPTClient } from '../../clients/GPTClient';

jest.mock('../../../utils/promptBuilder');

const mockChat = jest.fn();

jest.mock('../../clients/GPTClient', () => ({
    GPTClient: jest.fn().mockImplementation(() => ({
        chat: (...args: unknown[]) => mockChat(...args),
    })),
}));

describe('translateWords', () => {
    const mainLang = 'it';
    const translationLang = 'pl';

    beforeEach(() => {
        jest.clearAllMocks();
        (buildTranslatingWordsPrompt as jest.Mock).mockReturnValue('mocked-prompt');
    });

    it('parses GPT JSON response into TranslationItem array', async () => {
        const gptData = [
            {
                source: 'casa',
                sourceArticle: 'la',
                isValid: true,
                translations: ['dom'],
                example: { source: 'La casa è grande.', target: 'Dom jest duży.' },
            },
        ];

        mockChat.mockResolvedValue({
            data: JSON.stringify(gptData),
            tokensInput: 100,
            tokensOutput: 50,
            costUSD: 0.001,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual(gptData);
        expect(buildTranslatingWordsPrompt).toHaveBeenCalledWith(mainLang, translationLang, [
            'casa',
        ]);
    });

    it('returns empty array when GPT returns null', async () => {
        mockChat.mockResolvedValue({
            data: null,
            tokensInput: 10,
            tokensOutput: 0,
        });

        const result = await translateWords(mainLang, translationLang, ['xyz']);

        expect(result.translations).toEqual([]);
    });

    it('populates fetchMetadata correctly', async () => {
        const gptData = [
            {
                source: 'cane',
                sourceArticle: 'il',
                isValid: true,
                translations: ['pies'],
                example: null,
            },
        ];

        mockChat.mockResolvedValue({
            data: JSON.stringify(gptData),
            tokensInput: 200,
            tokensOutput: 80,
            costUSD: 0.002,
        });

        const result = await translateWords(mainLang, translationLang, ['cane', 'gatto']);

        expect(result.fetchMetadata).toEqual({
            prompt: 'mocked-prompt',
            response: JSON.stringify(gptData),
            words: gptData,
            mainLang,
            translationLang,
            totalWords: 2,
            tokensInput: 200,
            tokensOutput: 80,
            costUSD: 0.002,
            aiModel: 'gpt-4o-mini',
        });
    });

    it('retries once and returns empty array when GPT returns invalid JSON both times', async () => {
        mockChat.mockResolvedValue({
            data: 'not valid json',
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual([]);
        expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('retries when GPT returns a JSON object instead of an array', async () => {
        mockChat.mockResolvedValue({
            data: JSON.stringify({ results: [] }),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual([]);
        expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('retries when GPT returns an array containing items missing required fields', async () => {
        mockChat.mockResolvedValue({
            data: JSON.stringify([{ source: 'casa', translations: ['dom'] }]),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual([]);
        expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('retries when items have wrong field types', async () => {
        mockChat.mockResolvedValue({
            data: JSON.stringify([{ source: 'casa', isValid: 'yes', translations: ['dom'] }]),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual([]);
        expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('retries when translations field is not an array', async () => {
        mockChat.mockResolvedValue({
            data: JSON.stringify([{ source: 'casa', isValid: true, translations: 'dom' }]),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual([]);
        expect(mockChat).toHaveBeenCalledTimes(2);
    });

    it('filters out malformed item and keeps valid items', async () => {
        const validItem = {
            source: 'casa',
            sourceArticle: null,
            isValid: true,
            translations: ['dom'],
            example: null,
        };

        mockChat.mockResolvedValue({
            data: JSON.stringify([validItem, { source: 'gatto', isValid: true }]),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa', 'gatto']);

        expect(result.translations).toEqual([validItem]);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('accepts isValid=false items with missing fields and fills defaults', async () => {
        mockChat.mockResolvedValue({
            data: JSON.stringify([
                {
                    source: 'gatto',
                    isValid: false,
                    translations: ['kot (niepewne)'],
                },
            ]),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['gatto']);

        expect(result.translations).toEqual([
            {
                source: 'gatto',
                sourceArticle: null,
                isValid: false,
                translations: ['kot (niepewne)'],
                example: null,
            },
        ]);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('accepts an empty array as a valid response', async () => {
        mockChat.mockResolvedValue({
            data: '[]',
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual([]);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('parses JSON wrapped in markdown code fences', async () => {
        const gptData = [
            {
                source: 'casa',
                sourceArticle: 'la',
                isValid: true,
                translations: ['dom'],
                example: { source: 'La casa e grande.', target: 'Dom jest duzy.' },
            },
        ];

        mockChat.mockResolvedValue({
            data: `\n\`\`\`json\n${JSON.stringify(gptData, null, 2)}\n\`\`\`\n`,
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual(gptData);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('parses JSON wrapped in markdown code fences without json keyword', async () => {
        const gptData = [
            {
                source: 'handicap',
                sourceArticle: null,
                isValid: true,
                translations: ['niepełnosprawność'],
                example: { source: 'He faced handicaps.', target: 'Napotkał niepełnosprawność.' },
            },
        ];

        mockChat.mockResolvedValue({
            data: `\`\`\`\n${JSON.stringify(gptData, null, 4)}\n\`\`\``,
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['handicap']);

        expect(result.translations).toEqual(gptData);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('filters out malformed records and returns only valid ones', async () => {
        const validData = [
            {
                source: 'bullfighter',
                sourceArticle: null,
                isValid: true,
                translations: ['torreador'],
                example: {
                    source: 'The bullfighter faced the bull.',
                    target: 'Toreador stawił czoła bykowi.',
                },
            },
        ];

        // Simulate GPT response with some malformed records (missing translations field, wrong types, etc.)
        const mixedData = [
            validData[0],
            { source: 'invalid1', sourceArticle: null, isValid: true }, // missing translations array
            { source: 'invalid2', isValid: 'yes', translations: ['test'] }, // isValid is string not boolean
        ];

        mockChat.mockResolvedValue({
            data: `\`\`\`json\n${JSON.stringify(mixedData)}\n\`\`\``,
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['test']);

        // Should return only the valid record, filtering out malformed ones
        expect(result.translations).toEqual(validData);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('filters out records with non-string sourceArticle', async () => {
        const gptData = [
            {
                source: 'casa',
                sourceArticle: 'la',
                isValid: true,
                translations: ['dom'],
                example: null,
            },
            {
                source: 'gatto',
                sourceArticle: 123,
                isValid: true,
                translations: ['kot'],
                example: null,
            },
        ];

        mockChat.mockResolvedValue({
            data: JSON.stringify(gptData),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa', 'gatto']);

        expect(result.translations).toEqual([gptData[0]]);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('filters out records when translations contains non-string values', async () => {
        const gptData = [
            {
                source: 'casa',
                sourceArticle: 'la',
                isValid: true,
                translations: ['dom'],
                example: null,
            },
            {
                source: 'gatto',
                sourceArticle: null,
                isValid: true,
                translations: ['kot', 123],
                example: null,
            },
        ];

        mockChat.mockResolvedValue({
            data: JSON.stringify(gptData),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa', 'gatto']);

        expect(result.translations).toEqual([gptData[0]]);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('filters out records with malformed example object', async () => {
        const gptData = [
            {
                source: 'casa',
                sourceArticle: 'la',
                isValid: true,
                translations: ['dom'],
                example: { source: 'La casa e grande.', target: 'Dom jest duzy.' },
            },
            {
                source: 'gatto',
                sourceArticle: null,
                isValid: true,
                translations: ['kot'],
                example: { source: 'Il gatto dorme.' },
            },
        ];

        mockChat.mockResolvedValue({
            data: JSON.stringify(gptData),
            tokensInput: 10,
            tokensOutput: 5,
        });

        const result = await translateWords(mainLang, translationLang, ['casa', 'gatto']);

        expect(result.translations).toEqual([gptData[0]]);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('returns parsed result on retry when first attempt fails', async () => {
        const gptData = [
            {
                source: 'casa',
                sourceArticle: 'la',
                isValid: true,
                translations: ['dom'],
                example: null,
            },
        ];

        mockChat
            .mockResolvedValueOnce({
                data: 'bad json',
                tokensInput: 10,
                tokensOutput: 5,
            })
            .mockResolvedValueOnce({
                data: JSON.stringify(gptData),
                tokensInput: 100,
                tokensOutput: 50,
                costUSD: 0.001,
            });

        const result = await translateWords(mainLang, translationLang, ['casa']);

        expect(result.translations).toEqual(gptData);
        expect(mockChat).toHaveBeenCalledTimes(2);
    });
});
