import { MicrosoftTranslatorClient } from '../clients/MicrosoftTranslatorClient';

type CacheEntry = {
    value: string;
    expiresAt: number;
    lastAccessAt: number;
};

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_MAX_CACHE_SIZE = 10_000;

const CACHE_TTL_MS = Number(process.env.TRANSLATION_CACHE_TTL_MS ?? DEFAULT_TTL_MS);
const MAX_CACHE_SIZE = Number(process.env.TRANSLATION_CACHE_MAX_SIZE ?? DEFAULT_MAX_CACHE_SIZE);

const translationCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<string>>();
let translatorClient: MicrosoftTranslatorClient | null = null;

function getTranslatorClient(): MicrosoftTranslatorClient {
    if (!translatorClient) {
        translatorClient = new MicrosoftTranslatorClient();
    }
    return translatorClient;
}

function normalizeTextForKey(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildKey(text: string, from: string, to: string): string {
    return `${from}:${to}:${normalizeTextForKey(text)}`;
}

function deleteExpiredEntries(now: number) {
    for (const [key, entry] of translationCache.entries()) {
        if (entry.expiresAt <= now) {
            translationCache.delete(key);
        }
    }
}

function evictLeastRecentlyUsed() {
    while (translationCache.size > MAX_CACHE_SIZE) {
        let oldestKey: string | null = null;
        let oldestAccess = Number.POSITIVE_INFINITY;

        for (const [key, entry] of translationCache.entries()) {
            if (entry.lastAccessAt < oldestAccess) {
                oldestAccess = entry.lastAccessAt;
                oldestKey = key;
            }
        }

        if (!oldestKey) return;
        translationCache.delete(oldestKey);
    }
}

export async function translateTextWithCache(
    text: string,
    from: string,
    to: string,
): Promise<{ translation: string; cacheHit: boolean }> {
    const key = buildKey(text, from, to);
    const now = Date.now();

    deleteExpiredEntries(now);

    const cached = translationCache.get(key);
    if (cached) {
        cached.lastAccessAt = now;
        return { cacheHit: true, translation: cached.value };
    }

    const inFlight = inFlightRequests.get(key);
    if (inFlight) {
        const translation = await inFlight;
        return { cacheHit: true, translation };
    }

    const requestPromise = getTranslatorClient().translateText(text, from, to);
    inFlightRequests.set(key, requestPromise);

    try {
        const translation = await requestPromise;
        translationCache.set(key, {
            expiresAt: now + CACHE_TTL_MS,
            lastAccessAt: now,
            value: translation,
        });
        evictLeastRecentlyUsed();
        return { cacheHit: false, translation };
    } finally {
        inFlightRequests.delete(key);
    }
}

export function clearTranslationCacheForTests() {
    translationCache.clear();
    inFlightRequests.clear();
    translatorClient = null;
}
