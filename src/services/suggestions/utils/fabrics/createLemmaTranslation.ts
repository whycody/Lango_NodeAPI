import { PartialBy } from '../../../../types/helpers/PartialBy';
import { LemmaTranslationAttr } from '../../../../types/models/LemmaTranslationAttr';

type LemmaTranslationDefaults = 'addCount' | 'skipCount';

export const createLemmaTranslation = (
    attrs: PartialBy<LemmaTranslationAttr, LemmaTranslationDefaults>,
): LemmaTranslationAttr => ({
    addCount: 0,
    skipCount: 0,
    ...attrs,
});
