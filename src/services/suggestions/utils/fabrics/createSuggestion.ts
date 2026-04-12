import { PartialBy } from '../../../../types/helpers/PartialBy';
import { SuggestionAttr } from '../../../../types/models/SuggestionAttr';

type SuggestionDefaults = 'skipped' | 'added' | 'displayCount';

export const createSuggestion = (
    attrs: PartialBy<SuggestionAttr, SuggestionDefaults>,
): SuggestionAttr => ({
    added: false,
    displayCount: 0,
    skipped: false,
    ...attrs,
});
