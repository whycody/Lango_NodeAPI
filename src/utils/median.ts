import { LanguageCodeValue } from '../constants/languageCodes';
import { LanguageLevelValue, LEVEL_PERCENTILES } from '../constants/languageLevels';
import Lemma from '../models/lemmas/Lemma';

function getPercentileSkip(level: LanguageLevelValue, total: number): number {
    const percentile = 1 - LEVEL_PERCENTILES[level];
    return Math.min(Math.floor(percentile * total), total - 1);
}

export async function getMedianFreq(
    mainLang: LanguageCodeValue,
    level: LanguageLevelValue,
): Promise<number> {
    const total = await Lemma.countDocuments({ lang: mainLang });
    if (total === 0) return 0.5;
    const skip = getPercentileSkip(level, total);
    const [doc] = await Lemma.find({ lang: mainLang })
        .sort({ freqZ: 1 })
        .skip(skip)
        .limit(1)
        .lean();
    return doc?.freqZ ?? 0.5;
}
