import { Request, Response, Router } from 'express';

import authenticate from '../middleware/auth';
import BundleInteraction from '../models/core/BundleInteraction';
import BundleMember from '../models/core/BundleMember';
import { withIdField } from '../services/utils/withIdField';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/', authenticate, async (req: Request, res: Response) => {
    const { since } = req.query;
    const userId = req.userId ?? '';

    const query: { userId: string; updatedAt?: { $gt: Date } } = { userId };

    if (since) {
        query.updatedAt = { $gt: new Date(since as string) };
    }

    const interactions = await BundleInteraction.find(query).lean();

    res.json(interactions.map(withIdField));
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const clientInteractions = req.body;
    const synced = [];
    const rejectedIds = [];

    for (const interaction of clientInteractions) {
        try {
            const member = await BundleMember.findOne({
                bundleId: interaction.bundleId,
                removed: false,
                userId,
            });

            if (!member) {
                rejectedIds.push(interaction.id);
                continue;
            }

            const existingInteraction = await BundleInteraction.findOne({
                bundleId: interaction.bundleId,
                userId,
            });

            if (
                existingInteraction &&
                new Date(interaction.locallyUpdatedAt) < new Date(existingInteraction.updatedAt)
            ) {
                continue;
            }

            const updatedInteraction = await BundleInteraction.findOneAndUpdate(
                { bundleId: interaction.bundleId, userId },
                { $set: { interactedAt: interaction.interactedAt, updatedAt: nowUTC() } },
                { new: true, upsert: true },
            );

            synced.push({ id: interaction.id, updatedAt: updatedInteraction.updatedAt });
        } catch (error) {
            console.error(`Failed to sync bundle interaction ${interaction.id}:`, error);
        }
    }

    res.json({ rejectedIds, synced, unauthorized: [] });
});

export default router;
