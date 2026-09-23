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

    const bundle = await WordsBundle.findOne({ _id: bundleId, removed: false });

    if (!bundle) {
        res.json([]);
        return;
    }

    const members = await BundleMember.find({ bundleId, removed: false })
        .populate('userId', 'name picture')
        .lean();

    const mappedMembers = members
        .filter(member => member.userId)
        .map(member => {
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

router.patch('/:id/role', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { id } = req.params;
    const { role } = req.body as { role?: 'editor' | 'viewer' | 'owner' };

    if (role !== 'editor' && role !== 'viewer' && role !== 'owner') {
        res.status(400).json({ message: 'Invalid role' });
        return;
    }

    const member = await BundleMember.findOne({ _id: id, removed: false });

    if (!member) {
        res.status(404).json({ message: 'Member not found' });
        return;
    }

    const bundle = await WordsBundle.findOne({ _id: member.bundleId, removed: false });

    if (!bundle) {
        res.status(404).json({ message: 'Bundle not found' });
        return;
    }

    if (bundle.ownerId.toString() !== userId) {
        res.status(403).json({ message: 'Only the owner can change member roles' });
        return;
    }

    if (member.userId.toString() === userId) {
        res.status(400).json({ message: 'Owner cannot change their own role directly' });
        return;
    }

    if (member.role === 'owner') {
        res.status(400).json({ message: 'Cannot change the role of the owner' });
        return;
    }

    const now = nowUTC();

    if (role === 'owner') {
        const currentOwnerMembership = await BundleMember.findOne({
            bundleId: bundle._id,
            removed: false,
            userId,
        });

        member.role = 'owner';
        await member.save();

        if (currentOwnerMembership) {
            currentOwnerMembership.role = 'editor';
            currentOwnerMembership.updatedAt = new Date(now);
            await currentOwnerMembership.save();
        }

        bundle.ownerId = member.userId;
        await bundle.save();

        res.json(withIdField(member.toObject()));
        return;
    }

    member.role = role;
    member.updatedAt = new Date(now);
    await member.save();

    res.json(withIdField(member.toObject()));
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId ?? '';
    const { id } = req.params;

    const member = await BundleMember.findOne({ _id: id, removed: false });

    if (!member) {
        res.status(404).json({ message: 'Member not found' });
        return;
    }

    const bundle = await WordsBundle.findOne({ _id: member.bundleId, removed: false });

    if (!bundle) {
        res.status(404).json({ message: 'Bundle not found' });
        return;
    }

    if (bundle.ownerId.toString() !== userId) {
        res.status(403).json({ message: 'Only the owner can remove members' });
        return;
    }

    if (member.role === 'owner') {
        res.status(400).json({ message: 'Cannot remove the owner' });
        return;
    }

    member.removed = true;
    member.updatedAt = new Date(nowUTC());
    await member.save();

    res.json(withIdField(member.toObject()));
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

                const isRejoin =
                    existingMember.removed === true &&
                    member.removed === false &&
                    targetUserId === userId;

                if (
                    member.role !== existingMember.role &&
                    (!isOwner || member.role === 'owner') &&
                    !(isRejoin && member.role === 'viewer')
                ) {
                    unauthorized.push(existingMember.toObject());
                    continue;
                }

                if (
                    member.removed !== existingMember.removed &&
                    member.removed === false &&
                    !isOwner &&
                    bundle.visibility !== 'public' &&
                    !isRejoin
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
