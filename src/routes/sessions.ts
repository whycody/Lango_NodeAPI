import { Request, Response, Router } from 'express';

import authenticate from '../middleware/auth';
import Session from '../models/core/Session';
import { updateUserData } from '../services/utils/updateUserData';
import { withIdField } from '../services/utils/withIdField';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/sessions', authenticate, async (req: Request, res: Response) => {
    const { since } = req.query;
    const userId = req.userId ?? '';

    const query: { userId: string; updatedAt?: { $gt: Date } } = { userId };

    if (since) {
        query.updatedAt = { $gt: new Date(since as string) };
    }

    const sessions = await Session.find(query).lean();

    res.json(sessions.map(withIdField));
});

router.post('/sessions/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const clientSessions = req.body;
    const synced = [];
    const unauthorized: unknown[] = [];
    const rejectedIds: string[] = [];

    for (const session of clientSessions) {
        try {
            const existingSession = await Session.findOne({ _id: session.id, userId });

            if (
                existingSession &&
                new Date(session.locallyUpdatedAt) < new Date(existingSession.updatedAt)
            ) {
                continue;
            }

            const updatedSession = await Session.findOneAndUpdate(
                { _id: session.id, userId },
                { $set: { ...session, updatedAt: nowUTC() } },
                { new: true, upsert: true },
            );

            synced.push({ id: updatedSession._id, updatedAt: updatedSession.updatedAt });
        } catch (error) {
            console.error(`Failed to sync session ${session.id}:`, error);
        }
    }

    await updateUserData(userId);

    res.json({ rejectedIds, synced, unauthorized });
});

export default router;
