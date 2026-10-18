import { Request, Response, Router } from 'express';

import { CEFR_LEVELS, CefrLevel, isCefrLevelValue } from '../constants/cefrLevels';
import authenticate from '../middleware/auth';
import requireAdmin from '../middleware/requireAdmin';
import BundleCategory from '../models/core/BundleCategory';
import BundleTheme from '../models/core/BundleTheme';
import { withIdField } from '../services/utils/withIdField';

const router = Router();

router.get('/coverage', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const { category: categoryFilter, level: levelFilter } = req.query;

    if (levelFilter !== undefined && !isCefrLevelValue(levelFilter)) {
        return res.status(400).json({ error: 'level must be a valid CEFR level' });
    }

    const categoryQuery: { slug?: string } = {};
    if (typeof categoryFilter === 'string') {
        categoryQuery.slug = categoryFilter;
    }

    const existingThemesQuery: { category?: string; level?: CefrLevel } = {};
    if (typeof categoryFilter === 'string') {
        existingThemesQuery.category = categoryFilter;
    }
    if (levelFilter !== undefined) {
        existingThemesQuery.level = levelFilter;
    }

    const [categories, existingThemes] = await Promise.all([
        BundleCategory.find(categoryQuery).lean(),
        BundleTheme.find(existingThemesQuery).lean(),
    ]);

    const countsByCategoryAndLevel = new Map<string, number>();
    for (const theme of existingThemes) {
        if (theme.status !== 'active') {
            continue;
        }

        const key = `${theme.category}:${theme.level}`;
        countsByCategoryAndLevel.set(key, (countsByCategoryAndLevel.get(key) ?? 0) + 1);
    }

    const categoriesResponse = categories.map(cat => {
        const levels = {} as Record<CefrLevel, number>;
        for (const level of CEFR_LEVELS) {
            levels[level] = countsByCategoryAndLevel.get(`${cat.slug}:${level}`) ?? 0;
        }

        return { label: cat.label, levels, slug: cat.slug };
    });

    res.json({
        categories: categoriesResponse,
        existingThemes: existingThemes.map(theme => ({
            category: theme.category,
            level: theme.level,
            status: theme.status,
            title: theme.title,
        })),
    });
});

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const { category, createdBy, description, level, status, title } = req.body as {
        title?: string;
        description?: string;
        category?: string;
        level?: string;
        status?: 'proposed' | 'active' | 'archived';
        createdBy?: string;
    };

    if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'title is required' });
    }

    if (typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'description is required' });
    }

    if (typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ error: 'category is required' });
    }

    if (!isCefrLevelValue(level)) {
        return res.status(400).json({ error: 'level must be a valid CEFR level' });
    }

    if (status !== undefined && !['proposed', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'status must be proposed, active, or archived' });
    }

    try {
        if (!(await BundleCategory.exists({ slug: category }))) {
            return res.status(400).json({ error: `Category "${category}" does not exist` });
        }

        const theme = await BundleTheme.create({
            category,
            createdBy: createdBy ?? 'claude',
            description,
            level,
            status: status ?? 'active',
            title,
        });

        res.status(201).json(withIdField(theme.toObject()));
    } catch (error) {
        console.error('Failed to create bundle theme:', error);
        res.status(500).json({ error: 'Failed to create bundle theme' });
    }
});

router.patch('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status?: 'proposed' | 'active' | 'archived' };

    if (!status || !['proposed', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'status must be proposed, active, or archived' });
    }

    try {
        const theme = await BundleTheme.findByIdAndUpdate(id, { $set: { status } }, { new: true });

        if (!theme) {
            return res.status(404).json({ error: 'Bundle theme not found' });
        }

        res.json(withIdField(theme.toObject()));
    } catch (error) {
        console.error('Failed to update bundle theme:', error);
        res.status(500).json({ error: 'Failed to update bundle theme' });
    }
});

export default router;
