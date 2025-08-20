import express, { Request, Response } from 'express';
import User from '../models/User';
import Session from '../models/Session';
import Evaluation from '../models/Evaluation';
import authenticate from "../middleware/auth";

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

    const studyDays = Array.from(new Set(
        sessions.map(s => s.date.toISOString().split('T')[0])
    ));

    const evaluationCount = await Evaluation.countDocuments({ userId });

    res.json({
      userId: user._id,
      provider: user.provider,
      name: user.name,
      email: user.email,
      picture: user.picture,
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