import { Request, Response, Router } from 'express';

import { isLanguageCodeValue } from '../constants/languageCodes';
import authenticate from '../middleware/auth';
import { translateTextWithCache } from '../services/translation/translateWithCache';

const router = Router();

router.post('/translate', authenticate, async (req: Request, res: Response) => {
    const { from, text, to } = req.body as {
        from?: string;
        text?: string;
        to?: string;
    };

    if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'text must be a non-empty string' });
    }

    if (!isLanguageCodeValue(from) || !isLanguageCodeValue(to)) {
        return res.status(400).json({ error: 'from and to must be valid language codes' });
    }

    try {
        const { cacheHit, translation } = await translateTextWithCache(text, from, to);
        return res.status(200).json({ cacheHit, from, text, to, translation });
    } catch (error) {
        console.error(
            'Translation endpoint failed:',
            error instanceof Error ? error.message : error,
        );
        return res.status(500).json({ error: 'Translation failed' });
    }
});

export default router;
