import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import { LanguageCode, LanguageCodeValue } from '../constants/languageCodes';
import authenticate from '../middleware/auth';
import BundleJoinCode from '../models/core/BundleJoinCode';
import BundleMember from '../models/core/BundleMember';
import User from '../models/core/User';
import Word from '../models/core/Word';
import WordsBundle from '../models/core/WordsBundle';
import { parsePagination } from '../services/utils/pagination';
import { buildSearchTextFilters } from '../services/utils/searchTextFilters';
import { withIdField } from '../services/utils/withIdField';

const languageCodes: string[] = Object.values(LanguageCode);
const isLanguageCode = (value: unknown): value is LanguageCodeValue =>
    typeof value === 'string' && languageCodes.includes(value);

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

    res.json(bundles.map(withIdField));
});

router.get('/by-ids', async (req: Request, res: Response) => {
    const { ids } = req.query;

    const bundleIds =
        typeof ids === 'string' ? ids.split(',').filter(id => Types.ObjectId.isValid(id)) : [];

    if (bundleIds.length === 0) {
        return res.json([]);
    }

    const bundles = await WordsBundle.find({
        _id: { $in: bundleIds },
        removed: false,
    }).lean();

    const ownerIds = [...new Set(bundles.map(bundle => bundle.ownerId.toString()))];
    const bundleObjectIds = bundles.map(bundle => bundle._id);

    const [owners, flashcardsCounts] = await Promise.all([
        User.find({ _id: { $in: ownerIds } }, { name: 1, picture: 1 }).lean(),
        Word.aggregate([
            { $match: { bundleId: { $in: bundleObjectIds }, removed: false } },
            { $group: { _id: '$bundleId', count: { $sum: 1 } } },
        ]),
    ]);

    const ownerNameById = new Map(owners.map(owner => [owner._id.toString(), owner.name]));
    const ownerPictureById = new Map(owners.map(owner => [owner._id.toString(), owner.picture]));
    const flashcardsCountByBundleId = new Map(
        flashcardsCounts.map(entry => [entry._id.toString(), entry.count]),
    );

    const mappedBundles = bundles.map(bundle => ({
        ...withIdField(bundle),
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

    if (isLanguageCode(mainLang)) {
        query.mainLang = mainLang;
    }

    if (isLanguageCode(translationLang)) {
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

    const [facetResult] = await WordsBundle.aggregate<{
        data: Array<{ _id: Types.ObjectId; ownerId: Types.ObjectId; [key: string]: unknown }>;
        totalCount: Array<{ total: number }>;
    }>([
        { $match: query },
        nonEmptyMatchStage,
        { $match: { firstWord: { $ne: [] } } },
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
    const bundleIds = bundles.map(bundle => bundle._id);

    const [owners, flashcardsCounts] = await Promise.all([
        User.find({ _id: { $in: ownerIds } }, { name: 1, picture: 1 }).lean(),
        Word.aggregate([
            { $match: { bundleId: { $in: bundleIds }, removed: false } },
            { $group: { _id: '$bundleId', count: { $sum: 1 } } },
        ]),
    ]);

    const ownerNameById = new Map(owners.map(owner => [owner._id.toString(), owner.name]));
    const ownerPictureById = new Map(owners.map(owner => [owner._id.toString(), owner.picture]));
    const flashcardsCountByBundleId = new Map(
        flashcardsCounts.map(entry => [entry._id.toString(), entry.count]),
    );

    const mappedBundles = bundles.map(bundle => ({
        ...withIdField(bundle),
        flashcardsCount: flashcardsCountByBundleId.get(bundle._id.toString()) ?? 0,
        ownerName: ownerNameById.get(bundle.ownerId.toString()),
        ownerPicture: ownerPictureById.get(bundle.ownerId.toString()),
    }));

    res.json({ data: mappedBundles, total });
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
                { $set: { ...bundle, updatedAt: nowUTC() } },
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

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { id } = req.params;

    const bundle = await WordsBundle.findById(id);

    if (!bundle) {
        return res.status(404).json({ message: 'Bundle not found' });
    }

    if (bundle.ownerId.toString() !== userId) {
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

    if (bundle.ownerId.toString() !== userId) {
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

router.post('/join/:code', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { code } = req.params;
    const { bundleId } = req.query;

    console.log(bundleId, code);

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
            bundle: withIdField(bundle),
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
        bundle: withIdField(bundle),
        member: withIdField(member.toObject()),
    });
});

export default router;
