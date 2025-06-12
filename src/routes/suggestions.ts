import { Router, Request, Response } from 'express';
import authenticate from '../middleware/auth';
import { getSuggestionsForUser } from '../services/suggestions/suggestionService';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { since, firstLang, secondLang } = req.query;

  if (typeof firstLang !== 'string' || typeof secondLang !== 'string') {
    return res.status(400).json({ error: 'firstLang and secondLang query params are required' });
  }

  try {
    const suggestions = await getSuggestionsForUser(userId, firstLang, secondLang, since as string | undefined);
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

export default router;