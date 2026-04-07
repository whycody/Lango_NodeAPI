import { Types } from 'mongoose';

import { LemmaTranslation } from '../../../models/lemmas/LemmaTranslation';
import { LemmaTranslationAttr } from '../../../types/models/LemmaTranslationAttr';

export function mapToLemmaTranslation(doc: LemmaTranslationAttr): Partial<LemmaTranslation> {
    return {
        ...doc,
        lemmaId: typeof doc.lemmaId === 'string' ? new Types.ObjectId(doc.lemmaId) : doc.lemmaId,
    };
}

export function mapArrayToLemmaTranslations(
    docs: LemmaTranslationAttr[],
): Partial<LemmaTranslation>[] {
    return docs.map(mapToLemmaTranslation);
}
