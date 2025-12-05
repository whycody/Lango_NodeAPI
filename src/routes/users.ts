import express, { Request, Response } from 'express';
import authenticate from "../middleware/auth";
import { updateUserData } from "../services/utils/updateUserData";

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
    });
  } catch (err) {
    console.error("Error fetching user data", err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;