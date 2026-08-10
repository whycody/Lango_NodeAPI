import { Request, Response, Router } from 'express';
import { Types } from 'mongoose';

import authenticate from '../middleware/auth';
import BundleMember from '../models/core/BundleMember';
import WordsBundle from '../models/core/WordsBundle';

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

    const mappedMembers = members.map(member => ({
        ...member,
        _id: undefined,
        id: member._id,
    }));

    res.json(mappedMembers);
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
            ...member,
            _id: undefined,
            id: member._id,
            userId: user._id,
            userSummary: { id: user._id, name: user.name, picture: user.picture },
        };
    });

    res.json(mappedMembers);
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;
    const clientMembers = req.body;
    const syncedMembers = [];
    const unauthorizedMembers = [];
    const rejectedMemberIds = [];

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
                    unauthorizedMembers.push(existingMember.toObject());
                } else {
                    rejectedMemberIds.push(member.id);
                }
                continue;
            }

            const isOwner = bundle.ownerId.toString() === userId;
            const targetUserId = existingMember ? existingMember.userId.toString() : member.userId;

            if (!isOwner && targetUserId !== userId) {
                if (existingMember) {
                    unauthorizedMembers.push(existingMember.toObject());
                } else {
                    rejectedMemberIds.push(member.id);
                }
                continue;
            }

            if (existingMember) {
                if (existingMember.role === 'owner' && targetUserId !== userId) {
                    unauthorizedMembers.push(existingMember.toObject());
                    continue;
                }

                if (member.role !== existingMember.role && (!isOwner || member.role === 'owner')) {
                    unauthorizedMembers.push(existingMember.toObject());
                    continue;
                }

                if (
                    member.removed !== existingMember.removed &&
                    member.removed === false &&
                    !isOwner &&
                    bundle.visibility !== 'public'
                ) {
                    unauthorizedMembers.push(existingMember.toObject());
                    continue;
                }
            } else {
                const duplicateMember = await BundleMember.findOne({
                    bundleId: bundle._id,
                    userId: new Types.ObjectId(targetUserId),
                });

                if (duplicateMember) {
                    rejectedMemberIds.push(member.id);
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

            syncedMembers.push({ id: updatedMember._id, updatedAt: updatedMember.updatedAt });
        } catch (error) {
            console.error(`Failed to sync bundle member ${member.id}:`, error);
        }
    }

    const mappedUnauthorizedMembers = unauthorizedMembers.map(member => ({
        ...member,
        _id: undefined,
        id: member._id,
    }));

    res.json({
        rejectedMemberIds,
        syncedMembers,
        unauthorizedMembers: mappedUnauthorizedMembers,
    });
});

export default router;
