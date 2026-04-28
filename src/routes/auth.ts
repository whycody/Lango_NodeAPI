import axios from 'axios';
import { Request, Response, Router } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import jwt from 'jsonwebtoken';

import authenticate from '../middleware/auth';
import Session from '../models/core/Session';
import Suggestion from '../models/core/Suggestion';
import User from '../models/core/User';
import Word from '../models/core/Word';
import { removeTokensWithDeviceId } from '../services/utils/removeTokensWithDeviceId';
import {
    FacebookLoginRequest,
    GoogleLoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
} from '../types/routes/auth';

const router = Router();

const getHighResPhoto = (photo: string) => photo.replace(/=s\d+-c$/, '=s400-c');

router.post('/login/google', async (req: Request<{}, {}, GoogleLoginRequest>, res: Response) => {
    const { deviceId, idToken, timezone } = req.body;
    if (!idToken || !deviceId)
        return res.status(400).json({ message: 'idToken and deviceId are required' });

    try {
        const googleApiUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
        const response = await axios.get(googleApiUrl);
        const { email, name, picture, sub: providerId } = response.data;

        const highResPicture = getHighResPhoto(picture);
        let user = await User.findOne({ provider: 'google', providerId });
        if (!user) {
            user = await User.create({
                email,
                name,
                picture: highResPicture,
                provider: 'google',
                providerId,
                timezone,
            });
        } else {
            await User.updateOne(
                { provider: 'google', providerId },
                { email, name, picture: highResPicture, timezone },
            );
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.registerDeviceAndGenerateRefreshToken(deviceId);

        res.json({ accessToken, refreshToken });
    } catch {
        res.status(401).json({ message: 'Invalid Google ID token' });
    }
});

router.post(
    '/login/facebook',
    async (req: Request<{}, {}, FacebookLoginRequest>, res: Response) => {
        const { accessToken, deviceId, timezone } = req.body;
        if (!accessToken || !deviceId)
            return res.status(400).json({ message: 'accessToken and deviceId are required' });

        try {
            const facebookApiUrl = `https://graph.facebook.com/me?fields=id,name,picture.type(large),email&access_token=${accessToken}`;
            const response = await axios.get(facebookApiUrl);
            const { email, id: providerId, name, picture } = response.data;

            let user = await User.findOne({ provider: 'facebook', providerId });
            const userData = {
                email,
                name,
                picture: picture.data.url,
                provider: 'facebook',
                providerId,
                timezone,
            };
            if (!user) {
                user = await User.create(userData);
            } else {
                await User.updateOne({ provider: 'facebook', providerId }, userData);
            }

            const newAccessToken = user.generateAccessToken();
            const newRefreshToken = user.registerDeviceAndGenerateRefreshToken(deviceId);

            res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
        } catch {
            res.status(401).json({ message: 'Invalid Facebook access token' });
        }
    },
);

router.post('/login/apple', async (req: Request, res: Response) => {
    const { accessToken, deviceId, fullName, timezone } = req.body;

    if (!accessToken || !deviceId) {
        return res.status(400).json({
            message: 'accessToken and deviceId are required',
        });
    }

    try {
        const appleJWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

        const { payload } = await jwtVerify(accessToken, appleJWKS, {
            audience: process.env.APPLE_BUNDLE_ID,
            issuer: 'https://appleid.apple.com',
        });

        const providerId = payload.sub as string;
        const email = payload.email as string | undefined;

        const updateData: {
            email?: string;
            name?: string;
            timezone?: string;
        } = { timezone };

        if (email && payload.email_verified) updateData.email = email;
        updateData.name = fullName ?? '';

        const user = await User.findOneAndUpdate(
            { provider: 'apple', providerId },
            {
                $set: updateData,
                $setOnInsert: {
                    provider: 'apple',
                    providerId,
                },
            },
            { new: true, upsert: true },
        );

        const userAccessToken = user.generateAccessToken();
        const userRefreshToken = user.registerDeviceAndGenerateRefreshToken(deviceId);

        res.json({ accessToken: userAccessToken, refreshToken: userRefreshToken });
    } catch (e) {
        console.error('Apple login error:', e);
        res.status(401).json({ message: 'Invalid Apple identity token' });
    }
});

router.post('/auth/refresh', async (req: Request<{}, {}, RefreshTokenRequest>, res: Response) => {
    const { deviceId, refreshToken } = req.body;

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
            userId: string;
        };
        const user = await User.findById(decoded.userId);

        if (!user) throw new Error('User not found');

        const newRefreshToken = user.extendRefreshToken(refreshToken, deviceId);
        const newAccessToken = user.generateAccessToken();

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch {
        try {
            await removeTokensWithDeviceId(deviceId);
        } catch (err) {
            console.error('Failed to remove tokens during failed refresh:', err);
        }

        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

router.post(
    '/auth/logout',
    authenticate,
    async (req: Request<{}, {}, LogoutRequest>, res: Response) => {
        try {
            const { deviceId } = req.body;
            const user = await User.findById(req.userId);

            if (!user) throw new Error('User not found');

            user.revokeTokensRelatedWithDeviceId(deviceId);

            res.json({ message: 'Logged out successfully' });
        } catch {
            res.status(401).json({ message: 'Invalid token' });
        }
    },
);

router.delete('/auth/account', authenticate, async (req: Request, res: Response) => {
    const userId = req.userId!;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await Promise.all([
            Session.deleteMany({ userId }),
            Word.deleteMany({ userId }),
            Suggestion.deleteMany({ userId }),
            User.findByIdAndDelete(userId),
        ]);

        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Failed to delete account:', err instanceof Error ? err.message : err);
        res.status(500).json({ message: 'Failed to delete account' });
    }
});

export default router;
