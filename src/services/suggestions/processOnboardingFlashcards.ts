import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { LanguageCodeValue } from '../../constants/languageCodes';
import Suggestion from '../../models/core/Suggestion';
import Word from '../../models/core/Word';
import Lemma from '../../models/lemmas/Lemma';
import LemmaTranslation from '../../models/lemmas/LemmaTranslation';
import { generateSuggestionsInBackground } from './generateSuggestions';
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
        await generateSuggestionsInBackground(userId, mainLang, translationLang, true).catch(err =>
            console.error('Error generating suggestions in background', err),
        );
        return;
    }

    const selectedSet = new Set(selectedFlashcardsIds);

    const lemmaTranslations = await LemmaTranslation.find({
        _id: { $in: allIds.map(id => new Types.ObjectId(id)) },
    }).lean();

    const lemmaIds = lemmaTranslations.map(lt => lt.lemmaId);
    const lemmas = await Lemma.find({ _id: { $in: lemmaIds } }).lean();
    const lemmaMap = new Map(lemmas.map(l => [l._id.toString(), l]));

    const suggestions = lemmaTranslations
        .map(lt => {
            const lemma = lemmaMap.get(lt.lemmaId.toString());
            if (!lemma || !lt.translation) return null;

            const word = lemma.prefix ? `${lemma.prefix}${lemma.lemma}` : lemma.lemma;
            const isSelected = selectedSet.has(lt._id.toString());

            return createSuggestion({
                added: isSelected,
                example: lt.example ?? null,
                lemma: lemma.lemma,
                lemmaId: lt.lemmaId,
                mainLang,
                skipped: !isSelected,
                translation: lt.translation,
                translationLang,
                userId,
                word,
            });
        })
        .filter(s => s !== null);

    const words = lemmaTranslations
        .filter(lt => selectedSet.has(lt._id.toString()) && lt.translation)
        .map(lt => {
            const lemma = lemmaMap.get(lt.lemmaId.toString())!;
            const word = lemma.prefix ? `${lemma.prefix}${lemma.lemma}` : lemma.lemma;
            return {
                _id: uuidv4(),
                lemmas: [lemma.lemma],
                mainLang,
                source: 'onboarding',
                text: word,
                translation: lt.translation!,
                translationLang,
                userId,
            };
        });

    const selectedObjectIds = selectedFlashcardsIds.map(id => new Types.ObjectId(id));
    const skippedObjectIds = skippedFlashcardsIds.map(id => new Types.ObjectId(id));

    await Promise.all([
        suggestions.length > 0
            ? Suggestion.insertMany(suggestions, { ordered: false }).catch((err: any) => {
                  if (err?.code !== 11000) throw err;
              })
            : Promise.resolve(),
        words.length > 0 ? Word.insertMany(words, { ordered: false }) : Promise.resolve(),
        selectedObjectIds.length > 0
            ? LemmaTranslation.updateMany(
                  { _id: { $in: selectedObjectIds } },
                  { $inc: { addCount: 1 } },
              )
            : Promise.resolve(),
        skippedObjectIds.length > 0
            ? LemmaTranslation.updateMany(
                  { _id: { $in: skippedObjectIds } },
                  { $inc: { skipCount: 1 } },
              )
            : Promise.resolve(),
    ]);

    await generateSuggestionsInBackground(userId, mainLang, translationLang, true).catch(err =>
        console.error('Error generating suggestions in background', err),
    );
};
