import { LemmaTranslationAttr } from "../../../../types/models/LemmaTranslationAttr";
import { PartialBy } from "../../../../types/helpers/PartialBy";

type LemmaTranslationDefaults = "translation" | "addCount" | "skipCount";

export const createLemmaTranslation = (attrs: PartialBy<LemmaTranslationAttr, LemmaTranslationDefaults>): LemmaTranslationAttr => ({
  translation: null,
  addCount: 0,
  skipCount: 0,
  ...attrs,
});