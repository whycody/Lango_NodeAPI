import { Types } from 'mongoose';

import { CefrLevel } from '../../constants/cefrLevels';
import { LanguageCodeValue } from '../../constants/languageCodes';
import WordsBundle from '../../models/core/WordsBundle';

export const RECOMMENDED_BUNDLES_COUNT = 3;
const RECOMMENDED_PREMIUM_COUNT = 1;

export interface RecommendedBundle {
    _id: Types.ObjectId;
    ownerId: Types.ObjectId;
    premiumOnly: boolean;
    themeInstanceId: Types.ObjectId;
    translationLang: LanguageCodeValue;
    wordsGenerated: boolean;
    [key: string]: unknown;
}

const shuffle = <T>(items: T[]): T[] => {
    const result = [...items];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
};

/**
 * Picks random Lango-generated (theme) bundles for the given level, preferring a mix of
 * RECOMMENDED_PREMIUM_COUNT premium and the rest non-premium. When one pool is too small,
 * the remaining slots are filled from the other one.
 */
export async function pickRecommendedBundles(filters: {
    level: CefrLevel;
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
}): Promise<RecommendedBundle[]> {
    const sampleBundles = (premiumOnly: boolean) =>
        WordsBundle.aggregate<RecommendedBundle>([
            {
                $match: {
                    ...filters,
                    premiumOnly: premiumOnly ? true : { $ne: true },
                    removed: false,
                    themeInstanceId: { $type: 'objectId' },
                    visibility: 'public',
                },
            },
            { $sample: { size: RECOMMENDED_BUNDLES_COUNT } },
            { $project: { searchText: 0 } },
        ]);

    const [premium, free] = await Promise.all([sampleBundles(true), sampleBundles(false)]);

    const premiumCount = Math.min(
        premium.length,
        Math.max(RECOMMENDED_PREMIUM_COUNT, RECOMMENDED_BUNDLES_COUNT - free.length),
    );
    const freeCount = Math.min(free.length, RECOMMENDED_BUNDLES_COUNT - premiumCount);

    return shuffle([...premium.slice(0, premiumCount), ...free.slice(0, freeCount)]);
}
