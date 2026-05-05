import { Types } from 'mongoose';

import { LanguageCodeValue } from '../../constants/languageCodes';
import { LANGUAGE_LEVELS, LanguageLevelValue } from '../../constants/languageLevels';
import Lemma from '../../models/lemmas/Lemma';
import LemmaTranslation from '../../models/lemmas/LemmaTranslation';

export type ExampleFlashcard = {
    id: string;
    word: string;
    translation: string;
};

const LEVEL_PERCENTILES: Record<LanguageLevelValue, number> = {
    1: 0.001,
    2: 0.01,
    3: 0.1,
    4: 0.3,
    5: 0.7,
};

export function isLanguageLevelValue(value: any): value is LanguageLevelValue {
    return (LANGUAGE_LEVELS as readonly number[]).includes(Number(value));
}

async function getMedianFreq(
    mainLang: LanguageCodeValue,
    level: LanguageLevelValue,
): Promise<number> {
    const percentile = 1 - LEVEL_PERCENTILES[level];
    const total = await Lemma.countDocuments({ lang: mainLang });
    if (total === 0) return 0.5;
    const skip = Math.min(Math.floor(percentile * total), total - 1);
    const [doc] = await Lemma.find({ lang: mainLang })
        .sort({ freq_z: 1 })
        .skip(skip)
        .limit(1)
        .lean();
    return doc?.freq_z ?? 0.5;
}

async function getScoredLemmaIds(
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    medianFreq: number,
    untranslatedIds: Types.ObjectId[],
    count: number,
): Promise<Types.ObjectId[]> {
    const fetchLimit = count * 4;

    const lemmas = await Lemma.aggregate<{ _id: Types.ObjectId }>([
        { $match: { _id: { $nin: untranslatedIds }, lang: mainLang } },
        { $addFields: { freqDiff: { $abs: { $subtract: ['$freq_z', medianFreq] } } } },
        { $sort: { freqDiff: 1 } },
        { $limit: fetchLimit },
        { $project: { _id: 1 } },
    ]);

    if (lemmas.length === 0) return [];

    const lemmaIds = lemmas.map(l => l._id);

    const rawTranslations = await LemmaTranslation.find({
        lemmaId: { $in: lemmaIds },
        translationLang,
    })
        .select('lemmaId addCount skipCount')
        .lean();

    const translationMap = new Map(
        (
            rawTranslations as Array<{
                lemmaId: Types.ObjectId;
                addCount: number;
                skipCount: number;
            }>
        ).map(t => [t.lemmaId.toString(), t]),
    );

    const size = lemmas.length;
    const scored = lemmas.map((lemma, index) => {
        const lt = translationMap.get(lemma._id.toString());
        return {
            id: lemma._id,
            points: size - index + (lt?.addCount ?? 0) * 5 - (lt?.skipCount ?? 0) * 5,
        };
    });
    scored.sort((a, b) => b.points - a.points);

    return scored.slice(0, count).map(s => s.id);
}

export async function getExampleFlashcards(
    mainLang: LanguageCodeValue,
    translationLang: LanguageCodeValue,
    level: LanguageLevelValue,
    count: number,
): Promise<ExampleFlashcard[]> {
    const [medianFreq, untranslatedIds] = await Promise.all([
        getMedianFreq(mainLang, level),
        LemmaTranslation.distinct('lemmaId', {
            mainLang,
            translation: null,
            translationLang,
        }) as Promise<Types.ObjectId[]>,
    ]);

    const lemmaIds = await getScoredLemmaIds(
        mainLang,
        translationLang,
        medianFreq,
        untranslatedIds,
        count,
    );
    if (lemmaIds.length === 0) return [];

    const results = await LemmaTranslation.aggregate([
        {
            $match: {
                isValid: true,
                lemmaId: { $in: lemmaIds },
                translation: { $ne: null },
                translationLang,
            },
        },
        { $addFields: { sortOrder: { $indexOfArray: [lemmaIds, '$lemmaId'] } } },
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
