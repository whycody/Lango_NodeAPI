import { Schema } from 'mongoose';

import { WordPair } from '../types/shared/WordPair';

export const wordPairSchema = new Schema<WordPair>(
    {
        translation: { default: null, required: false, type: String },
        word: { required: true, type: String },
    },
    { _id: false },
);
