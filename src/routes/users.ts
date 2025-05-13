import express, { Request, Response } from 'express';
import User from '../models/User';
import authenticate from "../middleware/auth";

const router = express.Router();

router.get('/users', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({ message: 'User not found' });
  }

  try {
    const user = await User.findById(userId).select('-password'); // Nie zwracamy hasła
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      userId: user._id,
      provider: user.provider,
      name: user.name,
      email: user.email,
      picture: user.picture,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;