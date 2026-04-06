import { Types } from 'mongoose';

import { LemmaTranslation } from '../../../models/lemmas/LemmaTranslation';
import { LemmaTranslationAttr } from '../../../types/models/LemmaTranslationAttr';

export function mapToLemmaTranslation(doc: LemmaTranslationAttr): Partial<LemmaTranslation> {
    return {
        lemmaId: typeof doc.lemmaId === 'string' ? new Types.ObjectId(doc.lemmaId) : doc.lemmaId,
        translation: doc.translation ?? null,
        translationLang: doc.translationLang,
    };
}

export function mapArrayToLemmaTranslations(
    docs: LemmaTranslationAttr[],
): Partial<LemmaTranslation>[] {
    return docs.map(mapToLemmaTranslation);
}
