import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import authenticate from '../middleware/auth';
import BundleMember from '../models/core/BundleMember';
import WordsBundle from '../models/core/WordsBundle';
import { withIdField } from '../services/utils/withIdField';

const router = Router();

const nowUTC = () => new Date().toISOString();

router.get('/', authenticate, async (req: Request, res: Response) => {
    const { since } = req.query;
    const userId = req.userId ?? '';

    const query: {
        userId: string;
        updatedAt?: { $gt: Date };
    } = { userId };

    if (since) {
        query.updatedAt = { $gt: new Date(since as string) };
    }

    const members = await BundleMember.find(query).lean();

    res.json(members.map(withIdField));
});

router.get('/bundle/:bundleId', authenticate, async (req: Request, res: Response) => {
    const { bundleId } = req.params;
    const userId = req.userId ?? '';

    const bundle = await WordsBundle.findOne({ _id: bundleId, removed: false });

    if (!bundle) {
        res.json([]);
        return;
    }

    const requesterMembership = await BundleMember.findOne({
        bundleId,
        removed: false,
        userId,
    });

    if (bundle.visibility !== 'public' && !requesterMembership) {
        res.json([]);
        return;
    }

    const members = await BundleMember.find({ bundleId }).populate('userId', 'name picture').lean();

    const mappedMembers = members.map(member => {
        const user = member.userId as unknown as {
            _id: Types.ObjectId;
            name: string;
            picture?: string;
        };

        return {
            ...withIdField(member),
            userId: user._id,
            userSummary: { id: user._id, name: user.name, picture: user.picture },
        };
    });

    res.json(mappedMembers);
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;
    const clientMembers = req.body;
    const synced = [];
    const unauthorized = [];
    const rejectedIds = [];

    for (const member of clientMembers) {
        try {
            const existingMember = await BundleMember.findOne({ _id: member.id });

            if (
                existingMember &&
                new Date(member.locallyUpdatedAt) < new Date(existingMember.updatedAt)
            ) {
                continue;
            }

            const bundle = await WordsBundle.findById(member.bundleId);

            if (!bundle) {
                if (existingMember) {
                    unauthorized.push(existingMember.toObject());
                } else {
                    rejectedIds.push(member.id);
                }
                continue;
            }

            const isOwner = bundle.ownerId.toString() === userId;
            const targetUserId = existingMember ? existingMember.userId.toString() : member.userId;

            if (!isOwner && targetUserId !== userId) {
                if (existingMember) {
                    unauthorized.push(existingMember.toObject());
                } else {
                    rejectedIds.push(member.id);
                }
                continue;
            }

            if (existingMember) {
                if (existingMember.role === 'owner' && targetUserId !== userId) {
                    unauthorized.push(existingMember.toObject());
                    continue;
                }

                if (member.role !== existingMember.role && (!isOwner || member.role === 'owner')) {
                    unauthorized.push(existingMember.toObject());
                    continue;
                }

                if (
                    member.removed !== existingMember.removed &&
                    member.removed === false &&
                    !isOwner &&
                    bundle.visibility !== 'public'
                ) {
                    unauthorized.push(existingMember.toObject());
                    continue;
                }
            } else {
                const duplicateMember = await BundleMember.findOne({
                    bundleId: bundle._id,
                    userId: new Types.ObjectId(targetUserId),
                });

                if (duplicateMember) {
                    rejectedIds.push(member.id);
                    continue;
                }

                if (!isOwner && member.role !== 'viewer') {
                    member.role = 'viewer';
                }
            }

            const updatedMember = await BundleMember.findOneAndUpdate(
                { _id: member.id, userId: new Types.ObjectId(targetUserId) },
                {
                    $set: {
                        ...member,
                        removed: existingMember ? member.removed : false,
                        updatedAt: nowUTC(),
                    },
                },
                { new: true, upsert: true },
            );

            synced.push({ id: updatedMember._id, updatedAt: updatedMember.updatedAt });
        } catch (error) {
            console.error(`Failed to sync bundle member ${member.id}:`, error);
        }
    }

    res.json({
        rejectedIds,
        synced,
        unauthorized: unauthorized.map(withIdField),
    });
});

export default router;
