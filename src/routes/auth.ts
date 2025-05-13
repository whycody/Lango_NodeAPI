import { Router, Request, Response } from 'express';
import axios from 'axios';
import User from '../models/User';
import jwt from 'jsonwebtoken';

const router = Router();

const getHighResPhoto = (photo: string) => photo.replace(/=s\d+-c$/, '=s400-c');

router.post('/login/google', async (req: Request<{}, {}, { idToken: string, deviceId: string }>, res: Response) => {
  const { idToken, deviceId } = req.body;
  if (!idToken || !deviceId) return res.status(400).json({ message: 'idToken and deviceId are required' });

  try {
    const googleApiUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const response = await axios.get(googleApiUrl);
    const { sub: providerId, name, email, picture } = response.data;

    const highResPicture = getHighResPhoto(picture);
    let user = await User.findOne({ provider: 'google', providerId });
    if (!user) {
      user = await User.create({ provider: 'google', providerId, name, email, picture: highResPicture });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.registerDeviceAndGenerateRefreshToken(deviceId);

    res.json({ accessToken, refreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid Google ID token' });
  }
});

router.post('/login/facebook', async (req: Request<{}, {}, { accessToken: string, deviceId: string }>, res: Response) => {
  const { accessToken, deviceId } = req.body;
  if (!accessToken || !deviceId) return res.status(400).json({ message: 'accessToken and deviceId are required' });

  try {
    const facebookApiUrl = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`;
    const response = await axios.get(facebookApiUrl);
    const { id: providerId, name, email, picture } = response.data;

    let user = await User.findOne({ provider: 'facebook', providerId });
    if (!user) {
      user = await User.create({ provider: 'facebook', providerId, name, email, picture: picture.data.url });
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.registerDeviceAndGenerateRefreshToken(deviceId);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid Facebook access token' });
  }
});

router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken, deviceId } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user) throw new Error('User not found');

    const newRefreshToken = user.extendRefreshToken(refreshToken, deviceId);
    const newAccessToken = user.generateAccessToken();

    res.json({
      refreshToken: newRefreshToken,
      accessToken: newAccessToken
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

export default router;