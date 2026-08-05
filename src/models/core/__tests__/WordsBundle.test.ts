import { applySearchTextToUpdate, buildSearchText } from '../WordsBundle';

describe('buildSearchText', () => {
    it('combines normalized title and description', () => {
        expect(buildSearchText('Chrobąszcz', 'Chrobąszcz opis')).toBe('chrobaszcz chrobaszcz opis');
    });

    it('uses only the normalized title when no description is provided', () => {
        expect(buildSearchText('Bundle 1')).toBe('bundle 1');
    });

    it('uses only the normalized title when description is an empty string', () => {
        expect(buildSearchText('Bundle 1', '')).toBe('bundle 1');
    });
});

describe('applySearchTextToUpdate', () => {
    it('sets searchText on a $set update when title is present', () => {
        const update = {
            $set: { description: 'Chrobąszcz opis', title: 'Chrobąszcz' } as {
                description?: string;
                searchText?: string;
                title?: string;
            },
        };

        applySearchTextToUpdate(update);

        expect(update.$set.searchText).toBe('chrobaszcz chrobaszcz opis');
    });

    it('sets searchText directly on the update when there is no $set wrapper', () => {
        const update = { title: 'Bundle 1' } as { searchText?: string; title?: string };

        applySearchTextToUpdate(update);

        expect(update.searchText).toBe('bundle 1');
    });

    it('does nothing when title is not present in the update', () => {
        const update = { $set: { description: 'Nowy opis' } } as {
            $set: { description?: string; searchText?: string };
        };

        applySearchTextToUpdate(update);

        expect(update.$set.searchText).toBeUndefined();
    });

    it('does nothing when the update is null', () => {
        expect(() => applySearchTextToUpdate(null)).not.toThrow();
    });
});
