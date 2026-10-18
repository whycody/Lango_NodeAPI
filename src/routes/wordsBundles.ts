import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import { CEFR_LEVEL_BY_LANGUAGE_LEVEL } from '../constants/cefrLevels';
import { isLanguageCodeValue, LanguageCodeValue } from '../constants/languageCodes';
import authenticate from '../middleware/auth';
import requireAdmin from '../middleware/requireAdmin';
import BundleJoinCode from '../models/core/BundleJoinCode';
import BundleMember from '../models/core/BundleMember';
import BundleTheme from '../models/core/BundleTheme';
import BundleThemeInstance from '../models/core/BundleThemeInstance';
import User from '../models/core/User';
import Word from '../models/core/Word';
import WordsBundle from '../models/core/WordsBundle';
import { getAdminUserId } from '../services/utils/getAdminUserId';
import { isBundleOwner } from '../services/utils/isBundleOwner';
import { parsePagination } from '../services/utils/pagination';
import { buildSearchTextFilters } from '../services/utils/searchTextFilters';
import { withIdField } from '../services/utils/withIdField';
import { canViewBundle } from '../services/wordsBundles/canViewBundle';
import { ensureBundleWordsGenerated } from '../services/wordsBundles/ensureBundleWordsGenerated';
import { getFlashcardsCountByBundleId } from '../services/wordsBundles/getFlashcardsCounts';
import { pickRecommendedBundles } from '../services/wordsBundles/pickRecommendedBundles';
import { toBundleResponse } from '../services/wordsBundles/toBundleResponse';

const router = Router();

const nowUTC = () => new Date().toISOString();

const JOIN_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const JOIN_CODE_LENGTH = 6;

const generateJoinCode = () => {
    const bytes = crypto.randomBytes(JOIN_CODE_LENGTH);
    let code = '';

    for (const byte of bytes) {
        code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
    }

    return code;
};

/** Fields that only the server (admin theme-bundle flow, model hooks) may set. */
const SERVER_MANAGED_BUNDLE_FIELDS = [
    'category',
    'level',
    'ownerId',
    'premiumOnly',
    'searchText',
    'themeInstanceId',
    'wordsGenerated',
];

const omitServerManagedFields = (bundle: Record<string, unknown>) =>
    Object.fromEntries(
        Object.entries(bundle).filter(([key]) => !SERVER_MANAGED_BUNDLE_FIELDS.includes(key)),
    );

router.get('/', authenticate, async (req: Request, res: Response) => {
    const { since } = req.query;
    const userId = req.userId ?? '';

    const memberBundleIds = await BundleMember.find({ removed: false, userId }).distinct(
        'bundleId',
    );

    const query: { _id: { $in: unknown[] }; updatedAt?: { $gt: Date } } = {
        _id: { $in: memberBundleIds },
    };

    if (since) {
        query.updatedAt = { $gt: new Date(since as string) };
    }

    const bundles = await WordsBundle.find(query).lean();

    res.json(bundles.map(toBundleResponse));
});

router.get('/by-ids', authenticate, async (req: Request, res: Response) => {
    const { ids } = req.query;
    const userId = req.userId ?? '';

    const bundleIds =
        typeof ids === 'string' ? ids.split(',').filter(id => Types.ObjectId.isValid(id)) : [];

    if (bundleIds.length === 0) {
        return res.json([]);
    }

    const memberBundleIds = await BundleMember.find({
        bundleId: { $in: bundleIds },
        removed: false,
        userId,
    }).distinct('bundleId');

    const bundles = await WordsBundle.find({
        $or: [{ visibility: 'public' }, { _id: { $in: memberBundleIds } }],
        _id: { $in: bundleIds },
        removed: false,
    }).lean();

    const ownerIds = [...new Set(bundles.map(bundle => bundle.ownerId.toString()))];

    const [owners, flashcardsCountByBundleId] = await Promise.all([
        User.find({ _id: { $in: ownerIds } }, { name: 1, picture: 1 }).lean(),
        getFlashcardsCountByBundleId(bundles),
    ]);

    const ownerNameById = new Map(owners.map(owner => [owner._id.toString(), owner.name]));
    const ownerPictureById = new Map(owners.map(owner => [owner._id.toString(), owner.picture]));

    const mappedBundles = bundles.map(bundle => ({
        ...toBundleResponse(bundle),
        flashcardsCount: flashcardsCountByBundleId.get(bundle._id.toString()) ?? 0,
        ownerName: ownerNameById.get(bundle.ownerId.toString()),
        ownerPicture: ownerPictureById.get(bundle.ownerId.toString()),
    }));

    res.json(mappedBundles);
});

router.get('/search', authenticate, async (req: Request, res: Response) => {
    const { limit, mainLang, offset, q, translationLang } = req.query;
    const userId = req.userId ?? '';

    const searchTerm = typeof q === 'string' ? q.trim() : '';

    if (!searchTerm) {
        return res.json({ data: [], total: 0 });
    }

    const { resultLimit, resultOffset } = parsePagination(limit, offset);

    const wordFilters = buildSearchTextFilters(searchTerm);

    const memberBundleIds = await BundleMember.find({ removed: false, userId }).distinct(
        'bundleId',
    );

    const query: {
        $and: Array<{ searchText: RegExp }>;
        $or: Array<{ _id: { $in: unknown[] } } | { visibility: string }>;
        mainLang?: LanguageCodeValue;
        removed: boolean;
        translationLang?: LanguageCodeValue;
    } = {
        $and: wordFilters,
        $or: [{ visibility: 'public' }, { _id: { $in: memberBundleIds } }],
        removed: false,
    };

    if (isLanguageCodeValue(mainLang)) {
        query.mainLang = mainLang;
    }

    if (isLanguageCodeValue(translationLang)) {
        query.translationLang = translationLang;
    }

    const nonEmptyMatchStage = {
        $lookup: {
            as: 'firstWord',
            from: Word.collection.name,
            let: { bundleId: '$_id' },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ['$bundleId', '$$bundleId'] },
                                { $eq: ['$removed', false] },
                            ],
                        },
                    },
                },
                { $limit: 1 },
                { $project: { _id: 1 } },
            ],
        },
    };

    const adminOwnerId = getAdminUserId();

    const [facetResult] = await WordsBundle.aggregate<{
        data: Array<{ _id: Types.ObjectId; ownerId: Types.ObjectId; [key: string]: unknown }>;
        totalCount: Array<{ total: number }>;
    }>([
        { $match: query },
        nonEmptyMatchStage,
        {
            $match: {
                $or: [
                    { firstWord: { $ne: [] } },
                    ...(adminOwnerId ? [{ ownerId: adminOwnerId }] : []),
                ],
            },
        },
        { $project: { firstWord: 0 } },
        {
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: resultOffset },
                    { $limit: resultLimit },
                ],
                totalCount: [{ $count: 'total' }],
            },
        },
    ]);

    const bundles = facetResult?.data ?? [];
    const total = facetResult?.totalCount[0]?.total ?? 0;
    const ownerIds = [...new Set(bundles.map(bundle => bundle.ownerId.toString()))];

    const [owners, flashcardsCountByBundleId] = await Promise.all([
        User.find({ _id: { $in: ownerIds } }, { name: 1, picture: 1 }).lean(),
        getFlashcardsCountByBundleId(
            bundles.map(bundle => ({
                _id: bundle._id,
                themeInstanceId: bundle.themeInstanceId as { toString(): string } | undefined,
                wordsGenerated: bundle.wordsGenerated as boolean | undefined,
            })),
        ),
    ]);

    const ownerNameById = new Map(owners.map(owner => [owner._id.toString(), owner.name]));
    const ownerPictureById = new Map(owners.map(owner => [owner._id.toString(), owner.picture]));

    const mappedBundles = bundles.map(bundle => ({
        ...toBundleResponse(bundle),
        flashcardsCount: flashcardsCountByBundleId.get(bundle._id.toString()) ?? 0,
        ownerName: ownerNameById.get(bundle.ownerId.toString()),
        ownerPicture: ownerPictureById.get(bundle.ownerId.toString()),
    }));

    res.json({ data: mappedBundles, total });
});

router.get('/recommended', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';

    const user = await User.findById(userId, {
        languageLevels: 1,
        mainLang: 1,
        translationLang: 1,
    }).lean();

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const mainLang = req.query.mainLang ?? user.mainLang;
    const translationLang = req.query.translationLang ?? user.translationLang;

    if (!isLanguageCodeValue(mainLang) || !isLanguageCodeValue(translationLang)) {
        return res
            .status(400)
            .json({ message: 'mainLang and translationLang must be valid language codes' });
    }

    const languageLevel = user.languageLevels?.find(entry => entry.language === mainLang);

    if (!languageLevel) {
        return res.status(400).json({ message: `No language level set for ${mainLang}` });
    }

    const bundles = await pickRecommendedBundles({
        level: CEFR_LEVEL_BY_LANGUAGE_LEVEL[languageLevel.level],
        mainLang,
        translationLang,
    });

    // Fire-and-forget: pending theme bundles get their words generated in parallel so they are
    // likely ready by the time the user opens one. Locking inside ensureBundleWordsGenerated
    // prevents duplicate GPT calls across concurrent requests.
    for (const bundle of bundles.filter(bundle => !bundle.wordsGenerated)) {
        ensureBundleWordsGenerated(bundle)
            .then(result => {
                if (result.status !== 'ready' && result.status !== 'locked') {
                    console.error(
                        `Background word generation for bundle ${bundle._id} ended with status ${result.status}`,
                    );
                }
            })
            .catch(error =>
                console.error(`Background word generation for bundle ${bundle._id} failed:`, error),
            );
    }

    const ownerIds = [...new Set(bundles.map(bundle => bundle.ownerId.toString()))];

    const [owners, flashcardsCountByBundleId] = await Promise.all([
        User.find({ _id: { $in: ownerIds } }, { name: 1, picture: 1 }).lean(),
        getFlashcardsCountByBundleId(bundles),
    ]);

    const ownerById = new Map(owners.map(owner => [owner._id.toString(), owner]));

    res.json(
        bundles.map(bundle => ({
            ...toBundleResponse(bundle),
            flashcardsCount: flashcardsCountByBundleId.get(bundle._id.toString()) ?? 0,
            ownerName: ownerById.get(bundle.ownerId.toString())?.name,
            ownerPicture: ownerById.get(bundle.ownerId.toString())?.picture,
        })),
    );
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;
    const clientBundles = req.body;
    const synced = [];
    const unauthorized: unknown[] = [];
    const rejectedIds: string[] = [];

    for (const bundle of clientBundles) {
        try {
            const existingBundle = await WordsBundle.findOne({ _id: bundle.id, ownerId: userId });

            if (
                existingBundle &&
                new Date(bundle.locallyUpdatedAt) < new Date(existingBundle.updatedAt)
            ) {
                continue;
            }

            const updatedBundle = await WordsBundle.findOneAndUpdate(
                { _id: bundle.id, ownerId: new Types.ObjectId(userId) },
                {
                    $set: {
                        ...omitServerManagedFields(bundle),
                        updatedAt: nowUTC(),
                        ...(existingBundle ? {} : { wordsGenerated: true }),
                    },
                },
                { new: true, upsert: true },
            );

            if (
                existingBundle &&
                existingBundle.visibility === 'public' &&
                updatedBundle.visibility !== 'public'
            ) {
                await BundleMember.updateMany(
                    {
                        bundleId: updatedBundle._id,
                        joinedViaCodeId: { $eq: null },
                        role: { $ne: 'owner' },
                    },
                    { $set: { removed: true, updatedAt: nowUTC() } },
                );
            }

            synced.push({ id: updatedBundle._id, updatedAt: updatedBundle.updatedAt });
        } catch (error) {
            console.error(`Failed to sync words bundle ${bundle.id}:`, error);
        }
    }

    res.json({ rejectedIds, synced, unauthorized });
});

router.post(
    '/from-theme-instance',
    authenticate,
    requireAdmin,
    async (req: Request, res: Response) => {
        const { description, premiumOnly, themeInstanceId, title, translationLang } = req.body as {
            themeInstanceId?: string;
            translationLang?: string;
            title?: string;
            description?: string;
            premiumOnly?: boolean;
        };

        if (typeof themeInstanceId !== 'string' || !themeInstanceId.trim()) {
            return res.status(400).json({ error: 'themeInstanceId is required' });
        }

        if (!isLanguageCodeValue(translationLang)) {
            return res.status(400).json({ error: 'translationLang must be a valid language code' });
        }

        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: 'title is required' });
        }

        const instance = await BundleThemeInstance.findById(themeInstanceId).lean();

        if (!instance) {
            return res.status(404).json({ error: 'Bundle theme instance not found' });
        }

        const theme = await BundleTheme.findById(instance.themeId).lean();

        if (!theme) {
            console.error(`Theme ${instance.themeId} missing for instance ${instance._id}`);
            return res.status(500).json({ error: 'Failed to create theme bundle' });
        }

        if (theme.status !== 'active') {
            return res.status(400).json({ error: 'Theme must be active to create a bundle' });
        }

        const adminUserId = getAdminUserId();

        if (!adminUserId) {
            console.error('ADMIN_USER_ID is not configured or is not a valid ObjectId');
            return res.status(500).json({ error: 'Failed to create theme bundle' });
        }

        try {
            const bundle = await WordsBundle.create({
                category: theme.category,
                description,
                level: theme.level,
                mainLang: instance.mainLang,
                ownerId: adminUserId,
                premiumOnly: premiumOnly ?? false,
                themeInstanceId: instance._id,
                title,
                translationLang,
                visibility: 'public',
                wordsGenerated: false,
            });

            res.status(201).json(withIdField(bundle.toObject()));
        } catch (error) {
            if ((error as { code?: number }).code === 11000) {
                return res.status(409).json({
                    error: 'A bundle for this theme instance and translationLang already exists',
                });
            }

            console.error('Failed to create theme bundle:', error);
            res.status(500).json({ error: 'Failed to create theme bundle' });
        }
    },
);

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { id } = req.params;

    const bundle = await WordsBundle.findById(id);

    if (!bundle) {
        return res.status(404).json({ message: 'Bundle not found' });
    }

    if (!isBundleOwner(bundle, userId)) {
        return res.status(403).json({ message: 'Only the owner can delete the bundle' });
    }

    const now = nowUTC();

    await BundleMember.updateMany(
        { bundleId: bundle._id },
        { $set: { removed: true, updatedAt: now } },
    );

    await Word.updateMany({ bundleId: bundle._id }, { $set: { removed: true, updatedAt: now } });

    bundle.removed = true;

    await bundle.save();

    res.json({ id: bundle._id, removed: true });
});

router.post('/:id/generate-invitation-code', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { id } = req.params;
    const { role } = req.body as { role?: 'editor' | 'viewer' };

    const bundle = await WordsBundle.findById(id);

    if (!bundle) {
        return res.status(404).json({ message: 'Bundle not found' });
    }

    if (!isBundleOwner(bundle, userId)) {
        return res.status(403).json({ message: 'Only the owner can generate join codes' });
    }

    let joinCode;
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            joinCode = await BundleJoinCode.create({
                bundleId: bundle._id,
                code: generateJoinCode(),
                creatorId: userId,
                expireAt: new Date(Date.now() + JOIN_CODE_TTL_MS),
                role: role ?? 'viewer',
            });
            break;
        } catch (error) {
            const isDuplicateCode = (error as { code?: number }).code === 11000;

            if (!isDuplicateCode || attempt === maxAttempts - 1) {
                throw error;
            }
        }
    }

    if (!joinCode) {
        return res.status(500).json({ message: 'Failed to generate a unique join code' });
    }

    res.status(201).json({
        bundleId: joinCode.bundleId,
        code: joinCode.code,
        expireAt: joinCode.expireAt,
        id: joinCode._id,
        role: joinCode.role,
    });
});

router.post('/:id/ensure-words', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
        return res.status(404).json({ message: 'Bundle not found' });
    }

    const bundle = await WordsBundle.findOne({ _id: id, removed: false });

    if (!bundle) {
        return res.status(404).json({ message: 'Bundle not found' });
    }

    if (!(await canViewBundle(bundle, userId))) {
        return res.status(403).json({ message: 'You do not have access to this bundle' });
    }

    const result = await ensureBundleWordsGenerated(bundle);

    switch (result.status) {
        case 'not-a-theme-bundle':
            return res.status(400).json({ message: 'Bundle is not a theme bundle' });
        case 'misconfigured':
            return res.status(500).json({ message: 'Failed to generate bundle words' });
        case 'locked':
            return res
                .status(409)
                .json({ message: 'Words are already being generated for this bundle' });
        case 'failed':
            return res
                .status(502)
                .json({ message: 'Failed to generate bundle words, please retry' });
        case 'ready':
            return res.json(result.words.map(withIdField));
    }
});

router.post('/join/:code', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { code } = req.params;
    const { bundleId } = req.query;

    const joinCode = await BundleJoinCode.findOne({ code });

    if (!joinCode || joinCode.expireAt < new Date()) {
        return res.status(404).json({ message: 'Invalid or expired join code' });
    }

    if (typeof bundleId === 'string' && joinCode.bundleId.toString() !== bundleId) {
        return res.status(400).json({ message: 'Join code does not match the specified bundle' });
    }

    const existingMember = await BundleMember.findOne({
        bundleId: joinCode.bundleId,
        userId,
    });

    const bundle = await WordsBundle.findById(joinCode.bundleId).lean();

    if (!bundle) {
        return res.status(404).json({ message: 'Bundle no longer exists' });
    }

    if (existingMember && !existingMember.removed) {
        return res.status(409).json({ message: 'Already a member of this bundle' });
    }

    if (existingMember && existingMember.removed) {
        existingMember.removed = false;
        existingMember.role = joinCode.role;
        existingMember.joinedViaCodeId = joinCode._id as Types.ObjectId;
        await existingMember.save();

        return res.json({
            bundle: toBundleResponse(bundle),
            member: withIdField(existingMember.toObject()),
        });
    }

    const member = await BundleMember.create({
        bundleId: joinCode.bundleId,
        joinedViaCodeId: joinCode._id,
        role: joinCode.role,
        userId,
    });

    res.status(201).json({
        bundle: toBundleResponse(bundle),
        member: withIdField(member.toObject()),
    });
});

export default router;
