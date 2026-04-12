import { LanguageCodeValue } from '../../constants/languageCodes';
import { GPTReportAttr } from '../../types/models/GPTReportAttr';
import { TranslationItem } from '../../types/shared/TranslationItem';
import { buildTranslatingWordsPrompt } from '../../utils/promptBuilder';
import { GPTClient } from '../clients/GPTClient';

const gptClient = new GPTClient();

function isExample(value: unknown): value is TranslationItem['example'] {
    if (value === null) return true;
    if (typeof value !== 'object' || value === null) return false;

    const example = value as Record<string, unknown>;
    return typeof example.source === 'string' && typeof example.target === 'string';
}

function isTranslationItem(x: unknown): x is TranslationItem {
    if (typeof x !== 'object' || x === null) return false;
    const item = x as Record<string, unknown>;
    return (
        typeof item.source === 'string' &&
        (typeof item.sourceArticle === 'string' || item.sourceArticle === null) &&
        typeof item.isValid === 'boolean' &&
        Array.isArray(item.translations) &&
        item.translations.every(translation => typeof translation === 'string') &&
        isExample(item.example)
    );
}

function normalizeTranslationItem(x: unknown): TranslationItem | null {
    if (typeof x !== 'object' || x === null) return null;

    const item = x as Record<string, unknown>;
    if (typeof item.source !== 'string' || typeof item.isValid !== 'boolean') return null;

    if (item.isValid === false) {
        return {
            example: isExample(item.example) ? item.example : null,
            isValid: false,
            source: item.source,
            sourceArticle: typeof item.sourceArticle === 'string' ? item.sourceArticle : null,
            translations:
                Array.isArray(item.translations) &&
                item.translations.every(translation => typeof translation === 'string')
                    ? item.translations
                    : [],
        };
    }

    return isTranslationItem(item) ? item : null;
}

function stripCodeFence(data: string | null): string {
    if (!data) return '[]';
    let text = data.trim();

    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (fenceMatch?.[1]) {
        text = fenceMatch[1].trim();
    }

    return text;
}

function tryParse(data: string | null): TranslationItem[] | null {
    try {
        const parsed = JSON.parse(stripCodeFence(data));
        if (!Array.isArray(parsed)) return null;
        if (parsed.length === 0) return [];

        const validItems = parsed
            .map(normalizeTranslationItem)
            .filter((item): item is TranslationItem => item !== null);

        return validItems.length > 0 ? validItems : null;
    } catch {
        return null;
    }
}

export const translateWords = async (
    mainLangCode: LanguageCodeValue,
    translationLangCode: LanguageCodeValue,
    words: string[],
) => {
    const prompt = buildTranslatingWordsPrompt(mainLangCode, translationLangCode, words);

    let response = await gptClient.chat(prompt);
    let parsed = tryParse(response.data);

    if (!parsed) {
        console.error('Failed to parse GPT response, retrying...', response.data);
        response = await gptClient.chat(prompt);
        parsed = tryParse(response.data);
    }

    if (!parsed) {
        console.error('Retry failed, returning empty translations.', response.data);
        parsed = [];
    }

    const metadata: GPTReportAttr = {
        aiModel: 'gpt-4o-mini',
        costUSD: response.costUSD,
        mainLang: mainLangCode,
        prompt,
        response: response.data || '',
        tokensInput: response.tokensInput,
        tokensOutput: response.tokensOutput,
        totalWords: words.length,
        translationLang: translationLangCode,
        words: parsed,
    };

    return { fetchMetadata: metadata, translations: parsed };
};
