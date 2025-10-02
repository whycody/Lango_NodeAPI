import { LanguageCodeValue } from "../../../constants/languageCodes";
import LemmaTranslation from "../../../models/lemmas/LemmaTranslation";
import Lemma from "../../../models/lemmas/Lemma";
import { Types } from "mongoose";

export async function getLemmasIdsToTranslate(
  lemmaIds: string[],
  mainLang: LanguageCodeValue,
  translationLang: LanguageCodeValue,
  medianFreq: number,
  limit: number = 30
): Promise<string[]> {
  const lemmaObjectIds = lemmaIds.map(id => new Types.ObjectId(id));

  const translatedDocs = await LemmaTranslation.find({
    lemmaId: { $in: lemmaObjectIds },
    translationLang,
  }).lean()

  const translatedIds = new Set(translatedDocs.filter((t) => !!t.translation).map((doc) => doc.lemmaId.toString()))
  const untranslatedIds = lemmaIds.filter((id) => !translatedDocs.some((doc) => doc.lemmaId.toString() === id))

  if (translatedIds.size === limit) return []

  const additionalNeeded = Math.max(limit - untranslatedIds.length, 0)

  let additionalIds: string[] = []
  if (additionalNeeded > 0) {
    const allTranslatedLemmas = await LemmaTranslation.find({
      translationLang
    }).lean();

    const allTranslatedLemmasIds = allTranslatedLemmas.map((l) => l.lemmaId)

    const additionalCandidates = await Lemma.find({
      lang: mainLang,
      _id: { $nin: allTranslatedLemmasIds },
    }).lean()

    additionalCandidates.sort(
      (a, b) =>
        Math.abs((a.freq_z ?? 0) - medianFreq) -
        Math.abs((b.freq_z ?? 0) - medianFreq)
    )

    additionalIds = additionalCandidates
      .slice(0, additionalNeeded)
      .map((l) => l._id.toString())
  }

  return [...untranslatedIds, ...additionalIds]
}
