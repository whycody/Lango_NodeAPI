import express, { Request, Response } from 'express';
import authenticate from "../middleware/auth";
import { updateUserData } from "../services/utils/updateUserData";
import User from "../models/core/User";

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
      userId: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      provider: user.provider,
      sessionModel: user.sessionModel,
      notificationsEnabled: user.notifications.enabled,
      mainLang: user.mainLang,
      translationLang: user.translationLang,
      stats: user.stats,
      languageLevels: user.languageLevels
    });
  } catch (err) {
    console.error("Error fetching user data", err);
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
        (l: any) => l.language === incoming.language
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

router.put('/languages', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId;
  const { mainLang, translationLang, level } = req.body;

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
      userId: user._id,
      mainLang: user.mainLang,
      translationLang: user.translationLang,
    });
  } catch (err) {
    console.error("Error updating user languages", err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;