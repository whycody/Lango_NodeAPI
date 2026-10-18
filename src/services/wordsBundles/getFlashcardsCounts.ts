import { Types } from 'mongoose';

import BundleThemeInstance from '../../models/core/BundleThemeInstance';
import Word from '../../models/core/Word';

interface BundleForFlashcardsCount {
    _id: { toString(): string };
    themeInstanceId?: { toString(): string };
    wordsGenerated?: boolean;
}

/**
 * A pending theme bundle (themeInstanceId set, wordsGenerated false) has no Word documents yet,
 * so a plain Word aggregate would report 0 even though its word count is already known from the
 * linked BundleThemeInstance. This reports that pending count instead, so clients can show it
 * before the lazy-generation endpoint has run.
 */
export async function getFlashcardsCountByBundleId(
    bundles: BundleForFlashcardsCount[],
): Promise<Map<string, number>> {
    const generatedBundleIds = bundles
        .filter(bundle => !(bundle.themeInstanceId && !bundle.wordsGenerated))
        .map(bundle => bundle._id);

    const pendingBundles = bundles.filter(
        (
            bundle,
        ): bundle is BundleForFlashcardsCount & { themeInstanceId: { toString(): string } } =>
            Boolean(bundle.themeInstanceId) && !bundle.wordsGenerated,
    );

    const pendingInstanceIds = pendingBundles.map(bundle => bundle.themeInstanceId);

    const [generatedCounts, instances] = await Promise.all([
        Word.aggregate<{ _id: Types.ObjectId; count: number }>([
            { $match: { bundleId: { $in: generatedBundleIds }, removed: false } },
            { $group: { _id: '$bundleId', count: { $sum: 1 } } },
        ]),
        pendingInstanceIds.length > 0
            ? BundleThemeInstance.find({ _id: { $in: pendingInstanceIds } }, { words: 1 }).lean()
            : Promise.resolve([]),
    ]);

    const wordsCountByInstanceId = new Map(
        instances.map(instance => [instance._id.toString(), instance.words.length]),
    );

    const flashcardsCountByBundleId = new Map(
        generatedCounts.map(entry => [entry._id.toString(), entry.count]),
    );

    for (const bundle of pendingBundles) {
        flashcardsCountByBundleId.set(
            bundle._id.toString(),
            wordsCountByInstanceId.get(bundle.themeInstanceId.toString()) ?? 0,
        );
    }

    return flashcardsCountByBundleId;
}
