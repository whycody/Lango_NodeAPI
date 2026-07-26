import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import authenticate from '../middleware/auth';
import BundleJoinCode from '../models/core/BundleJoinCode';
import BundleMember from '../models/core/BundleMember';
import WordsBundle from '../models/core/WordsBundle';

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

    const mappedBundles = bundles.map(bundle => ({
        ...bundle,
        _id: undefined,
        id: bundle._id,
    }));

    res.json(mappedBundles);
});

router.get('/by-ids', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { ids } = req.query;

    const bundleIds = typeof ids === 'string' ? ids.split(',').filter(Boolean) : [];

    if (bundleIds.length === 0) {
        return res.json([]);
    }

    const memberBundleIds = await BundleMember.find({
        bundleId: { $in: bundleIds },
        removed: false,
        userId,
    }).distinct('bundleId');

    const bundles = await WordsBundle.find({ _id: { $in: memberBundleIds } }).lean();

    const mappedBundles = bundles.map(bundle => ({
        ...bundle,
        _id: undefined,
        id: bundle._id,
    }));

    res.json(mappedBundles);
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;
    const clientBundles = req.body;
    const syncedBundles = [];

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
                        joinedViaCodeId: { $exists: false },
                        role: { $ne: 'owner' },
                    },
                    { $set: { removed: true, updatedAt: nowUTC() } },
                );
            }

            syncedBundles.push({ id: updatedBundle._id, updatedAt: updatedBundle.updatedAt });
        } catch (error) {
            console.error(`Failed to sync words bundle ${bundle.id}:`, error);
        }
    }

    res.json(syncedBundles);
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

    await BundleMember.updateMany(
        { bundleId: bundle._id },
        { $set: { removed: true, updatedAt: nowUTC() } },
    );

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

    const joinCode = await BundleJoinCode.findOne({ code });

    if (!joinCode || joinCode.expireAt < new Date()) {
        return res.status(404).json({ message: 'Invalid or expired join code' });
    }

    const existingMember = await BundleMember.findOne({
        bundleId: joinCode.bundleId,
        userId,
    });

    if (existingMember && !existingMember.removed) {
        return res.json({
            bundleId: existingMember.bundleId,
            id: existingMember._id,
            role: existingMember.role,
        });
    }

    if (existingMember && existingMember.removed) {
        existingMember.removed = false;
        existingMember.role = joinCode.role;
        existingMember.joinedViaCodeId = joinCode._id as Types.ObjectId;
        await existingMember.save();

        return res.json({
            bundleId: existingMember.bundleId,
            id: existingMember._id,
            role: existingMember.role,
        });
    }

    const member = await BundleMember.create({
        bundleId: joinCode.bundleId,
        joinedViaCodeId: joinCode._id,
        role: joinCode.role,
        userId,
    });

    res.status(201).json({
        bundleId: member.bundleId,
        id: member._id,
        role: member.role,
    });
});

export default router;
