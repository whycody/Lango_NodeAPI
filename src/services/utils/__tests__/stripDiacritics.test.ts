import { stripDiacritics } from '../stripDiacritics';

describe('stripDiacritics', () => {
    it('removes Polish diacritics', () => {
        expect(stripDiacritics('Chrobąszcz')).toBe('Chrobaszcz');
    });

    it('removes diacritics from all Polish special characters, including ł', () => {
        expect(stripDiacritics('ąćęłńóśźż')).toBe('acelnoszz');
    });

    it('removes Italian diacritics', () => {
        expect(stripDiacritics('città')).toBe('citta');
    });

    it('leaves plain ASCII text unchanged', () => {
        expect(stripDiacritics('hello world')).toBe('hello world');
    });

    it('replaces uppercase Ł, Ø, Đ and their lowercase counterparts', () => {
        expect(stripDiacritics('ŁØĐ łøđ')).toBe('LOD lod');
    });
});
