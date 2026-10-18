import { hasDuplicateWords } from '../hasDuplicateWords';

describe('hasDuplicateWords', () => {
    it('returns false for a list with no duplicates', () => {
        expect(hasDuplicateWords(['pillow', 'knife'])).toBe(false);
    });

    it('returns true when the same word appears twice', () => {
        expect(hasDuplicateWords(['pillow', 'pillow'])).toBe(true);
    });

    it('returns false for an empty list', () => {
        expect(hasDuplicateWords([])).toBe(false);
    });
});
