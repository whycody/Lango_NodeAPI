import { Router, Request, Response } from 'express';
import axios from 'axios';
import User from '../models/User';
import jwt from 'jsonwebtoken';

const router = Router();

interface LoginRequestBody {
  idToken: string;
}

router.post('/login/google', async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: 'idToken is required' });

  try {
    const googleApiUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const response = await axios.get(googleApiUrl);
    const { sub: providerId, name, email, picture } = response.data;

    let user = await User.findOne({ provider: 'google', providerId });
    if (!user) {
      user = await User.create({ provider: 'google', providerId, name, email, picture });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    res.json({ accessToken, refreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid Google ID token' });
  }
});

router.post('/login/facebook', async (req: Request<{}, {}, { accessToken: string }>, res: Response) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ message: 'accessToken is required' });

  try {
    const facebookApiUrl = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`;
    const response = await axios.get(facebookApiUrl);
    const { id: providerId, name, email, picture } = response.data;

    let user = await User.findOne({ provider: 'facebook', providerId });
    if (!user) {
      user = await User.create({ provider: 'facebook', providerId, name, email, picture: picture.data.url });
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();
    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid Facebook access token' });
  }
});

router.post('/refresh-token', async (req: Request<{}, {}, { refreshToken: string }>, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as { userId: string };
    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();
    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

export default router;