import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import authenticate from '../middleware/auth';
import BundleMember from '../models/core/BundleMember';
import Word from '../models/core/Word';
import WordsBundle from '../models/core/WordsBundle';
import { withIdField } from '../services/utils/withIdField';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/words', authenticate, async (req: Request, res: Response) => {
    const { bundleId, since } = req.query;
    const userId = req.userId ?? '';

    const sinceFilter = since ? { $gt: new Date(since as string) } : undefined;

    if (bundleId) {
        const requestedBundleId = bundleId as string;

        const bundle = await WordsBundle.findOne({ _id: requestedBundleId, removed: false });

        if (!bundle) {
            return res.status(404).json({ message: 'Bundle not found' });
        }

        if (bundle.visibility !== 'public') {
            const membership = await BundleMember.findOne({
                bundleId: requestedBundleId,
                removed: false,
                userId: new Types.ObjectId(userId),
            });

            if (!membership) {
                return res.status(403).json({ message: 'You do not have access to this bundle' });
            }
        }

        const words = await Word.find({
            bundleId: requestedBundleId,
            ...(bundleId && { removed: false }),
            ...(sinceFilter && { updatedAt: sinceFilter }),
        }).lean();

        return res.json(words.map(withIdField));
    }

    const memberBundleIds = await BundleMember.find({
        removed: false,
        userId: new Types.ObjectId(userId),
    }).distinct('bundleId');

    const words = await Word.find({
        $or: [{ bundleId: null, userId }, { bundleId: { $in: memberBundleIds } }],
        ...(sinceFilter && { updatedAt: sinceFilter }),
    }).lean();

    res.json(words.map(withIdField));
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
            } else if (existingWord && existingWord.userId.toString() !== userId) {
                unauthorizedWords.push(existingWord.toObject());
                continue;
            }

            const ownerUserId = existingWord ? existingWord.userId : new Types.ObjectId(userId);

            const updatedWord = await Word.findOneAndUpdate(
                { _id: word.id },
                { $set: { ...word, updatedAt: nowUTC(), userId: ownerUserId } },
                { new: true, upsert: true },
            );

            syncedWords.push({ id: updatedWord._id, updatedAt: updatedWord.updatedAt });
        } catch (error) {
            console.error(`Failed to sync word ${word.id}:`, error);
        }
    }

    res.json({
        rejectedWordIds,
        syncedWords,
        unauthorizedWords: unauthorizedWords.map(withIdField),
    });
});

export default router;
