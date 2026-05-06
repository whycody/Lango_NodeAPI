import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { LanguageCodeValue } from '../../constants/languageCodes';
import Suggestion from '../../models/core/Suggestion';
import Word from '../../models/core/Word';
import Lemma from '../../models/lemmas/Lemma';
import LemmaTranslation from '../../models/lemmas/LemmaTranslation';
import { SuggestionAttr } from '../../types/models/SuggestionAttr';
import { insertInitialSuggestions } from './insertInitialSuggestions';
import { createSuggestion } from './utils/fabrics/createSuggestion';

export const processOnboardingFlashcards = async (
    userId: string,
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    selectedFlashcardsIds: string[],
    skippedFlashcardsIds: string[],
) => {
    const allIds = [...selectedFlashcardsIds, ...skippedFlashcardsIds];

    if (allIds.length === 0) {
        await insertInitialSuggestions(userId, mainLang, translationLang, []).catch((err: any) =>
            console.error('Error inserting initial suggestions', err),
        );
        return;
    }

    const selectedSet = new Set(selectedFlashcardsIds);
    const allObjectIds = allIds.map(id => new Types.ObjectId(id));

    const [lemmas, lemmaTranslations] = await Promise.all([
        Lemma.find({ _id: { $in: allObjectIds } }).lean(),
        LemmaTranslation.find({
            isValid: true,
            lemmaId: { $in: allObjectIds },
            translation: { $ne: null },
            translationLang,
        }).lean(),
    ]);

    const lemmaMap = new Map(lemmas.map(l => [l._id.toString(), l]));
    const ltMap = new Map(lemmaTranslations.map(lt => [lt.lemmaId.toString(), lt]));

    const suggestions: SuggestionAttr[] = [];
    const words: object[] = [];
    const selectedObjectIds: Types.ObjectId[] = [];
    const skippedObjectIds: Types.ObjectId[] = [];

    for (const id of allIds) {
        const isSelected = selectedSet.has(id);
        const lemmaObjectId = new Types.ObjectId(id);

        if (isSelected) {
            selectedObjectIds.push(lemmaObjectId);
        } else {
            skippedObjectIds.push(lemmaObjectId);
        }

        const lemma = lemmaMap.get(id);
        const lt = ltMap.get(id);
        if (!lemma || !lt?.translation) continue;

        const word = lemma.prefix ? `${lemma.prefix}${lemma.lemma}` : lemma.lemma;

        suggestions.push(
            createSuggestion({
                added: isSelected,
                example: lt.example ?? null,
                lemma: lemma.lemma,
                lemmaId: lemmaObjectId,
                mainLang,
                skipped: !isSelected,
                translation: lt.translation,
                translationLang,
                userId,
                word,
            }),
        );

        if (isSelected) {
            words.push({
                _id: uuidv4(),
                lemmas: [lemma.lemma],
                mainLang,
                source: 'onboarding',
                text: word,
                translation: lt.translation,
                translationLang,
                userId,
            });
        }
    }

    await Promise.all([
        suggestions.length > 0
            ? Suggestion.insertMany(suggestions, { ordered: false }).catch((err: any) => {
                  if (err?.code !== 11000) throw err;
              })
            : Promise.resolve(),
        words.length > 0 ? Word.insertMany(words, { ordered: false }) : Promise.resolve(),
        selectedObjectIds.length > 0
            ? LemmaTranslation.updateMany(
                  { lemmaId: { $in: selectedObjectIds }, translationLang },
                  { $inc: { addCount: 1 } },
              )
            : Promise.resolve(),
        skippedObjectIds.length > 0
            ? LemmaTranslation.updateMany(
                  { lemmaId: { $in: skippedObjectIds }, translationLang },
                  { $inc: { skipCount: 1 } },
              )
            : Promise.resolve(),
        selectedObjectIds.length > 0
            ? Lemma.updateMany({ _id: { $in: selectedObjectIds } }, { $inc: { addCount: 1 } })
            : Promise.resolve(),
        skippedObjectIds.length > 0
            ? Lemma.updateMany({ _id: { $in: skippedObjectIds } }, { $inc: { skipCount: 1 } })
            : Promise.resolve(),
    ]);

    await insertInitialSuggestions(userId, mainLang, translationLang, [
        ...selectedObjectIds,
        ...skippedObjectIds,
    ]).catch((err: any) => console.error('Error inserting initial suggestions', err));
};
