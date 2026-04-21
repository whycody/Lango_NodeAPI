import { PartialBy } from '../../../../types/helpers/PartialBy';
import { LemmaTranslationAttr } from '../../../../types/models/LemmaTranslationAttr';

type LemmaTranslationDefaults =
    | 'addCount'
    | 'containsUnknownTranslations'
    | 'skipCount'
    | 'validated';

export const createLemmaTranslation = (
    attrs: PartialBy<LemmaTranslationAttr, LemmaTranslationDefaults>,
): LemmaTranslationAttr => ({
    addCount: 0,
    containsUnknownTranslations: false,
    skipCount: 0,
    validated: false,
    ...attrs,
});
