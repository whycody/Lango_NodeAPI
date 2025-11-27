import express, { Request, Response } from "express";
import authenticate from "../middleware/auth";
import User from "../models/core/User";

const router = express.Router();

router.patch('/', authenticate, async (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (enabled === undefined) return res.status(400).json({ message: 'enabled is required' });

  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 'notifications.enabled': enabled },
      { new: true, select: 'notifications' }
    );
    res.json(user?.notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

router.post('/devices', authenticate, async (req: Request, res: Response) => {
  const { deviceId, token } = req.body;
  if (!deviceId || !token) return res.status(400).json({ message: 'deviceId and token required' });

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.notifications.deviceTokens.some(d => d.deviceId === deviceId)) {
      user.notifications.deviceTokens.push({ deviceId, token });
      await user.save();
    }

    res.json(user.notifications.deviceTokens);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to register device token' });
  }
});


router.delete('/devices/:deviceId', authenticate, async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.notifications.deviceTokens = user.notifications.deviceTokens.filter(d => d.deviceId !== deviceId);
    await user.save();

    res.json({ message: 'Device removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to remove device token' });
  }
});

export default router;
