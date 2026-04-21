import { PartialBy } from '../../../../types/helpers/PartialBy';
import { LemmaTranslationAttr } from '../../../../types/models/LemmaTranslationAttr';

type LemmaTranslationDefaults =
    | 'addCount'
    | 'containsNotKnownTranslations'
    | 'skipCount'
    | 'validated';

export const createLemmaTranslation = (
    attrs: PartialBy<LemmaTranslationAttr, LemmaTranslationDefaults>,
): LemmaTranslationAttr => ({
    addCount: 0,
    containsNotKnownTranslations: false,
    skipCount: 0,
    validated: false,
    ...attrs,
});
