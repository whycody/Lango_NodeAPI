import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import authenticate from '../middleware/auth';
import Word from '../models/core/Word';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/words', authenticate, async (req: Request, res: Response) => {
    const { since } = req.query;
    const userId = req.userId ?? '';

    const query: { userId: string; updatedAt?: { $gt: Date } } = { userId };

    if (since) {
        query.updatedAt = { $gt: new Date(since as string) };
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

    for (const word of clientWords) {
        try {
            const existingWord = await Word.findOne({ _id: word.id, userId });

            if (
                existingWord &&
                new Date(word.locallyUpdatedAt) < new Date(existingWord.updatedAt)
            ) {
                continue;
            }

            const updatedWord = await Word.findOneAndUpdate(
                { _id: word.id, userId: new Types.ObjectId(userId) },
                { $set: { ...word, updatedAt: nowUTC() } },
                { new: true, upsert: true },
            );

            syncedWords.push({ id: updatedWord._id, updatedAt: updatedWord.updatedAt });
        } catch (error) {
            console.error(`Failed to sync word ${word.id}:`, error);
        }
    }

    res.json(syncedWords);
});

export default router;
