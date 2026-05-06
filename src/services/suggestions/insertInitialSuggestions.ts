import { Types } from 'mongoose';

import { LanguageCodeValue } from '../../constants/languageCodes';
import { SUGGESTIONS_TO_INSERT } from '../../constants/suggestions';
import Suggestion from '../../models/core/Suggestion';
import User from '../../models/core/User';
import Lemma from '../../models/lemmas/Lemma';
import { SuggestionAttr } from '../../types/models/SuggestionAttr';
import { getMedianFreq } from '../../utils/median';
import { createSuggestion } from './utils/fabrics/createSuggestion';

export async function insertInitialSuggestions(
    userId: string,
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    excludedLemmaIds: Types.ObjectId[],
): Promise<void> {
    const user = await User.findOne({ _id: userId });
    const level = user?.languageLevels.find(l => l.language === mainLang)?.level ?? 1;
    const medianFreq = await getMedianFreq(mainLang, level);

    const results = await Lemma.aggregate<{
        _id: string;
        example: { source: string; target: string } | null;
        lemma: string;
        translation: string;
        word: string;
    }>([
        {
            $match: {
                _id: { $nin: excludedLemmaIds },
                lang: mainLang,
                validTranslationsLanguages: translationLang,
            },
        },
        { $addFields: { freqDiff: { $abs: { $subtract: ['$freqZ', medianFreq] } } } },
        { $sort: { freqDiff: 1 } },
        { $setWindowFields: { output: { pos: { $documentNumber: {} } }, sortBy: { freqDiff: 1 } } },
        {
            $addFields: {
                points: {
                    $add: [
                        { $multiply: ['$pos', -1] },
                        { $multiply: ['$addCount', 5] },
                        { $multiply: ['$skipCount', -5] },
                    ],
                },
            },
        },

        { $sort: { points: -1 } },
        { $limit: SUGGESTIONS_TO_INSERT },
        {
            $lookup: {
                as: 'lt',
                from: 'lemmas_translations',
                let: { id: '$_id', tl: translationLang },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$lemmaId', '$$id'] },
                                    { $eq: ['$translationLang', '$$tl'] },
                                    { $eq: ['$isValid', true] },
                                    { $ne: ['$translation', null] },
                                ],
                            },
                        },
                    },
                    { $project: { _id: 0, example: 1, translation: 1 } },
                    { $limit: 1 },
                ],
            },
        },
        { $unwind: '$lt' },
        {
            $project: {
                _id: 1,
                example: '$lt.example',
                lemma: 1,
                translation: '$lt.translation',
                word: {
                    $cond: {
                        else: '$lemma',
                        if: { $gt: ['$prefix', ''] },
                        then: { $concat: ['$prefix', '$lemma'] },
                    },
                },
            },
        },
    ]);

    if (results.length === 0) return;

    const suggestions: SuggestionAttr[] = results.map(r =>
        createSuggestion({
            example: r.example ?? null,
            lemma: r.lemma,
            lemmaId: r._id,
            mainLang,
            translation: r.translation,
            translationLang,
            userId,
            word: r.word,
        }),
    );

    await Suggestion.insertMany(suggestions, { ordered: false });
}
