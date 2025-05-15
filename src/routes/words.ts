import { Router } from 'express';
import Word from '../models/Word';
import authenticate from "../middleware/auth";
import { Request, Response } from "express";

const router = Router();

router.post('/words', authenticate, async (req: Request, res: Response) => {
  const { id, text, translation, firstLang, secondLang, source, interval, repetitionCount, addDate, lastReviewDate, nextReviewDate, EF } = req.body;
  console.log(req.body)
  const userId = req.userId;

  const newWord = new Word({
    _id: id,
    userId,
    text,
    translation,
    firstLang,
    secondLang,
    source,
    interval,
    addDate,
    repetitionCount,
    lastReviewDate,
    nextReviewDate,
    EF,
  });

  try {
    await newWord.save();
    res.status(201).json(newWord);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Error saving word", error });
  }
});

router.put('/words/:id', authenticate, async (req: Request, res: Response) => {
  const { text, translation, firstLang, secondLang, source, interval, repetitionCount, EF } = req.body;
  const userId = req.userId;
  const wordId = req.params.id;

  const updateFields: { [key: string]: any } = {};

  if (text) updateFields.text = text;
  if (translation) updateFields.translation = translation;
  if (firstLang) updateFields.firstLang = firstLang;
  if (secondLang) updateFields.secondLang = secondLang;
  if (source) updateFields.source = source;
  if (interval) updateFields.interval = interval;
  if (repetitionCount) updateFields.repetitionCount = repetitionCount;
  if (EF) updateFields.EF = EF;

  updateFields.updatedAt = new Date();

  try {
    const updatedWord = await Word.findOneAndUpdate(
      { _id: wordId, userId },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedWord) {
      return res.status(404).json({ message: "Word not found" });
    }

    res.json(updatedWord);
  } catch (error) {
    res.status(500).json({ message: "Error updating word", error });
  }
});


router.get('/words', authenticate, async (req: Request, res: Response) => {
  const { since } = req.query;
  const userId = req.userId ?? '';

  const query: { userId: string; updatedAt?: { $gt: Date } } = { userId };

  if (since) {
    query.updatedAt = { $gt: new Date(since as string) };
  }

  const words = await Word.find(query);
  res.json(words);
});

export default router;