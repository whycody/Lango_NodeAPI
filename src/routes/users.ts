import express, { Request, Response } from 'express';
import User from '../models/core/User';
import Session from '../models/core/Session';
import Evaluation from '../models/core/Evaluation';
import authenticate from "../middleware/auth";
import Word from "../models/core/Word";

const router = express.Router();

router.get('/users', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({ message: 'User not found' });
  }

  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sessions = await Session.find({ userId });
    const sessionCount = sessions.filter((s) => s.finished).length;
    const averageScore = sessionCount > 0
      ? sessions.reduce((sum, s) => sum + s.averageScore, 0) / sessionCount
      : 0;

    const studyDays = Array.from(new Set(sessions.map(s => s.localDay)));

    const evaluationCount = await Evaluation.countDocuments({ userId });

    const latestEvaluation = await Evaluation.findOne({ userId }).sort({ date: -1 });

    let translationLang = null;
    let mainLang = null;

    if (latestEvaluation) {
      const word = await Word.findById(latestEvaluation.wordId);
      if (word) {
        mainLang = word.mainLang;
        translationLang = word.translationLang;
      }
    }

    res.json({
      userId: user._id,
      provider: user.provider,
      name: user.name,
      email: user.email,
      picture: user.picture,
      sessionModel: user.sessionModel,
      notificationsEnabled: user.notifications.enabled,
      translationLang,
      mainLang,
      stats: {
        sessionCount,
        averageScore,
        evaluationCount,
        studyDays
      }
    });
  } catch (err) {
    console.error("Error fetching user data", err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;