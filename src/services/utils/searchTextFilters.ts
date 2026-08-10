import { stripDiacritics } from './stripDiacritics';

export const normalizeForSearch = (text: string): string => stripDiacritics(text).toLowerCase();

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildSearchTextFilters = (searchTerm: string): Array<{ searchText: RegExp }> =>
    normalizeForSearch(searchTerm)
        .split(/\s+/)
        .filter(Boolean)
        .map(word => ({ searchText: new RegExp(escapeRegExp(word), 'i') }));
