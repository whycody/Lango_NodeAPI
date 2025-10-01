import { Types } from 'mongoose';
import { LemmaTranslationAttr } from "../../../types/models/LemmaTranslationAttr";
import { LemmaTranslation } from "../../../models/lemmas/LemmaTranslation";

export function mapToLemmaTranslation(doc: LemmaTranslationAttr): Partial<LemmaTranslation> {
  return {
    lemmaId: typeof doc.lemmaId === 'string' ? new Types.ObjectId(doc.lemmaId) : doc.lemmaId,
    translationLang: doc.translationLang,
    translation: doc.translation ?? null,
  };
}

export function mapArrayToLemmaTranslations(docs: LemmaTranslationAttr[]): Partial<LemmaTranslation>[] {
  return docs.map(mapToLemmaTranslation);
}
