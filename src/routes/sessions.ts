import { Request, Response, Router } from 'express';
import Session from '../models/core/Session';
import authenticate from '../middleware/auth';
import { updateUserData } from "../services/utils/updateUserData";

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

  const mappedSessions = sessions.map(session => ({
    ...session,
    id: session._id,
    _id: undefined,
  }));

  res.json(mappedSessions);
});

router.post('/sessions/sync', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId ?? '';
  const clientSessions = req.body;
  const syncedSessions = [];

  for (const session of clientSessions) {
    try {
      const existingSession = await Session.findOne({ _id: session.id, userId });

      if (existingSession && new Date(session.locallyUpdatedAt) < new Date(existingSession.updatedAt)) {
        continue;
      }

      const updatedSession = await Session.findOneAndUpdate(
        { _id: session.id, userId },
        { $set: { ...session, updatedAt: nowUTC() } },
        { upsert: true, new: true }
      );

      syncedSessions.push({ id: updatedSession._id, updatedAt: updatedSession.updatedAt });
    } catch (error) {
      console.error(`Failed to sync session ${session.id}:`, error);
    }
  }

  await updateUserData(userId);

  res.json(syncedSessions);
});

export default router;