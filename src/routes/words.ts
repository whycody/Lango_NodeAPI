import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import authenticate from '../middleware/auth';
import BundleMember from '../models/core/BundleMember';
import Word from '../models/core/Word';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/words', authenticate, async (req: Request, res: Response) => {
    const { bundleId, since } = req.query;
    const userId = req.userId ?? '';

    const memberBundleIds = await BundleMember.find({
        removed: false,
        userId: new Types.ObjectId(userId),
    }).distinct('bundleId');

    const memberBundleIdStrings = memberBundleIds.map(id => id.toString());

    const query: {
        $or: Array<{ bundleId?: { $in: string[] }; userId?: string }>;
        updatedAt?: { $gt: Date };
    } = {
        $or: [{ userId }, { bundleId: { $in: memberBundleIdStrings } }],
    };

    if (since) {
        query.updatedAt = { $gt: new Date(since as string) };
    }

    if (bundleId) {
        const requestedBundleId = bundleId as string;
        const allowedBundleIds = memberBundleIdStrings.includes(requestedBundleId)
            ? [requestedBundleId]
            : [];

        query.$or = [
            { bundleId: { $in: [requestedBundleId] }, userId },
            { bundleId: { $in: allowedBundleIds } },
        ];
    }

    const words = await Word.find(query).lean();

    const mappedWords = words.map(word => ({
        ...word,
        _id: undefined,
        id: word._id,
    }));

    res.json(mappedWords);
});

router.post('/words/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;
    const clientWords = req.body;
    const syncedWords = [];
    const unauthorizedWords = [];
    const rejectedWordIds = [];

    for (const word of clientWords) {
        try {
            const existingWord = await Word.findOne({ _id: word.id });

            if (
                existingWord &&
                new Date(word.locallyUpdatedAt) < new Date(existingWord.updatedAt)
            ) {
                continue;
            }

            const targetBundleId = existingWord ? existingWord.bundleId : word.bundleId;

            if (targetBundleId) {
                const membership = await BundleMember.findOne({
                    bundleId: targetBundleId,
                    removed: false,
                    role: { $in: ['owner', 'editor'] },
                    userId: new Types.ObjectId(userId),
                });

                if (!membership) {
                    if (existingWord) {
                        unauthorizedWords.push(existingWord.toObject());
                    } else {
                        rejectedWordIds.push(word.id);
                    }
                    continue;
                }
            } else if (existingWord && existingWord.userId !== userId) {
                unauthorizedWords.push(existingWord.toObject());
                continue;
            } else if (!existingWord && word.userId !== userId) {
                rejectedWordIds.push(word.id);
                continue;
            }

            const updatedWord = await Word.findOneAndUpdate(
                { _id: word.id },
                { $set: { ...word, updatedAt: nowUTC() } },
                { new: true, upsert: true },
            );

            syncedWords.push({ id: updatedWord._id, updatedAt: updatedWord.updatedAt });
        } catch (error) {
            console.error(`Failed to sync word ${word.id}:`, error);
        }
    }

    const mappedUnauthorizedWords = unauthorizedWords.map(word => ({
        ...word,
        _id: undefined,
        id: word._id,
    }));

    res.json({ rejectedWordIds, syncedWords, unauthorizedWords: mappedUnauthorizedWords });
});

export default router;
