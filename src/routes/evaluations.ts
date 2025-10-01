import { Request, Response, Router } from 'express';
import Evaluation from '../models/core/Evaluation';
import authenticate from '../middleware/auth';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/evaluations', authenticate, async (req: Request, res: Response) => {
  const { since } = req.query;
  const userId = req.userId ?? '';

  const query: { userId: string; updatedAt?: { $gt: Date } } = { userId };

  if (since) {
    query.updatedAt = { $gt: new Date(since as string) };
  }

  const evaluations = await Evaluation.find(query).lean();

  const mappedEvaluations = evaluations.map(evaluation => ({
    ...evaluation,
    id: evaluation._id,
    _id: undefined,
  }));

  res.json(mappedEvaluations);
});

router.post('/evaluations/sync', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId ?? '';
  const clientEvaluations = req.body;
  const syncedEvaluations = [];

  for (const evaluation of clientEvaluations) {
    try {
      const existingEvaluation = await Evaluation.findOne({ _id: evaluation.id, userId });

      if (existingEvaluation && new Date(evaluation.locallyUpdatedAt) < new Date(existingEvaluation.updatedAt)) {
        continue;
      }

      const updatedEvaluation = await Evaluation.findOneAndUpdate(
        { _id: evaluation.id, userId },
        { $set: { ...evaluation, updatedAt: nowUTC() } },
        { upsert: true, new: true }
      );

      syncedEvaluations.push({ id: updatedEvaluation._id, updatedAt: updatedEvaluation.updatedAt });
    } catch (error) {
      console.error(`Failed to sync evaluation ${evaluation.id}:`, error);
    }
  }

  res.json(syncedEvaluations);
});

export default router;