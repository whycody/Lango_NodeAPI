import { Types } from 'mongoose';

import { LanguageCodeValue } from '../../constants/languageCodes';
import { LANGUAGE_LEVELS, LanguageLevelValue } from '../../constants/languageLevels';
import LemmaTranslation from '../../models/lemmas/LemmaTranslation';
import { FastAPISuggestionsRepository } from './repositories/FastAPISuggestionRepository';

export type ExampleFlashcard = {
    id: string;
    word: string;
    translation: string;
};

export function isLanguageLevelValue(value: any): value is LanguageLevelValue {
    return (LANGUAGE_LEVELS as readonly number[]).includes(Number(value));
}

export async function getExampleFlashcards(
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    level: LanguageLevelValue,
    count: number,
): Promise<ExampleFlashcard[]> {
    const repo = new FastAPISuggestionsRepository();
    const { suggested_lemmas_ids } = await repo.getUserSuggestions({
        level,
        limit: count,
        mainLang,
        translationLang,
    });
    if (suggested_lemmas_ids.length === 0) return [];

    const lemmaObjectIds = suggested_lemmas_ids.map(id => new Types.ObjectId(id));

    const results = await LemmaTranslation.aggregate([
        {
            $match: {
                isValid: true,
                lemmaId: { $in: lemmaObjectIds },
                translation: { $ne: null },
                translationLang,
            },
        },
        {
            $addFields: {
                sortOrder: { $indexOfArray: [lemmaObjectIds, '$lemmaId'] },
            },
        },
        { $sort: { sortOrder: 1 } },
        { $limit: count },
        {
            $lookup: {
                as: 'lemma',
                foreignField: '_id',
                from: 'lemmas',
                localField: 'lemmaId',
            },
        },
        { $unwind: '$lemma' },
        {
            $project: {
                _id: 1,
                translation: 1,
                word: {
                    $cond: {
                        else: '$lemma.lemma',
                        if: { $gt: ['$lemma.prefix', ''] },
                        then: { $concat: ['$lemma.prefix', '$lemma.lemma'] },
                    },
                },
            },
        },
    ]);

    return results.map(r => ({
        id: (r._id as { toString(): string }).toString(),
        translation: r.translation as string,
        word: r.word as string,
    }));
}
