import { Router } from 'express';
import Word from '../models/Card';
import authenticate from "../middleware/auth";

const router = Router();

router.post('/cards', authenticate, async (req, res) => {
  const { text, translation, firstLang, secondLang, source, interval, repetitionCount, EF } = req.body;

  const userId = req.userId;

  const newWord = new Word({
    userId,
    text,
    translation,
    firstLang,
    secondLang,
    source,
    interval,
    repetitionCount,
    EF,
  });

  await newWord.save();
  res.status(201).json(newWord);
});

router.get('/cards', authenticate, async (req, res) => {
  const userId = (req as Express.Request).userId;
  const words = await Word.find({ userId });
  res.json(words);
});

export default router;