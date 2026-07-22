import express, { Request, Response } from 'express';

import AppConfig from '../models/core/AppConfig';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    try {
        const appConfig = await AppConfig.findOne();

        if (!appConfig) {
            return res.status(404).json({ message: 'App config not found' });
        }

        res.json({
            recommendedMinimalAppVersion: appConfig.recommendedMinimalAppVersion,
            requiredMinimalAppVersion: appConfig.requiredMinimalAppVersion,
        });
    } catch (err) {
        console.error('Error fetching app config', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
