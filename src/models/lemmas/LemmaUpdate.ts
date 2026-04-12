import { Schema } from 'mongoose';

import { LemmaUpdate } from '../../types/shared/LemmaUpdate';

export const lemmaUpdateSchema = new Schema<LemmaUpdate>(
    {
        lemma: { required: true, type: String },
        prefix: { required: true, type: String },
    },
    { _id: false },
);
