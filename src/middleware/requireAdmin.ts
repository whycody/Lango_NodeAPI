import { NextFunction, Request, Response } from 'express';

import User from '../models/core/User';

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await User.findById(req.userId).select('+admin').lean();

        if (!user?.admin) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        next();
    } catch (err) {
        next(err);
    }
};

export default requireAdmin;
