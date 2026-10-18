import { Request, Response, Router } from 'express';

import authenticate from '../middleware/auth';
import requireAdmin from '../middleware/requireAdmin';
import BundleCategory from '../models/core/BundleCategory';
import { withIdField } from '../services/utils/withIdField';

const router = Router();

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const { description, label, slug } = req.body as {
        slug?: string;
        label?: string;
        description?: string;
    };

    if (typeof slug !== 'string' || !slug.trim()) {
        return res.status(400).json({ error: 'slug is required' });
    }

    if (typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'label is required' });
    }

    try {
        const category = await BundleCategory.create({ description, label, slug });
        res.status(201).json(withIdField(category.toObject()));
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return res.status(409).json({ error: `Category with slug "${slug}" already exists` });
        }

        console.error('Failed to create bundle category:', error);
        res.status(500).json({ error: 'Failed to create bundle category' });
    }
});

export default router;
