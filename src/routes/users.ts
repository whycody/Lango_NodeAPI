import express, { Request, Response } from 'express';

import authenticate from '../middleware/auth';
import User from '../models/core/User';
import { updateUserData } from '../services/utils/updateUserData';

const router = express.Router();

router.get('/users', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) {
        return res.status(400).json({ message: 'User not found' });
    }

    try {
        const user = await updateUserData(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            email: user.email,
            languageLevels: user.languageLevels,
            mainLang: user.mainLang,
            name: user.name,
            notificationsEnabled: user.notifications.enabled,
            picture: user.picture,
            provider: user.provider,
            sessionModel: user.sessionModel,
            stats: user.stats,
            suggestionsInSession: user.suggestionsInSession,
            translationLang: user.translationLang,
            userId: user._id,
        });
    } catch (err) {
        console.error('Error fetching user data', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/language-levels', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;
    const { languageLevels } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User not found' });
    }

    if (!Array.isArray(languageLevels)) {
        return res.status(400).json({ message: 'languageLevels must be an array' });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.languageLevels = user.languageLevels || [];

        for (const incoming of languageLevels) {
            const existingIndex = user.languageLevels.findIndex(
                (l: any) => l.language === incoming.language,
            );

            if (existingIndex >= 0) {
                user.languageLevels[existingIndex].level = incoming.level;
            } else {
                user.languageLevels.push({
                    language: incoming.language,
                    level: incoming.level,
                });
            }
        }

        await user.save();

        res.json({
            languageLevels: user.languageLevels,
        });
    } catch (err) {
        console.error('Error updating language levels', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.patch('/suggestions-in-session', authenticate, async (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (enabled === undefined) return res.status(400).json({ message: 'enabled is required' });

    try {
        const user = await User.findByIdAndUpdate(
            req.userId,
            { suggestionsInSession: enabled },
            { new: true, select: 'suggestionsInSession' },
        );
        res.json({ enabled: user?.suggestionsInSession });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update suggestions in session' });
    }
});

router.put('/languages', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId;
    const { level, mainLang, translationLang } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User not found' });
    }

    if (!mainLang || !translationLang) {
        return res.status(400).json({ message: 'Both mainLang and translationLang are required' });
    }

    try {
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.mainLang = mainLang;
        user.translationLang = translationLang;
        user.languageLevels = [{ language: mainLang, level }];

        await user.save();

        res.json({
            mainLang: user.mainLang,
            translationLang: user.translationLang,
            userId: user._id,
        });
    } catch (err) {
        console.error('Error updating user languages', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
