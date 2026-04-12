import { Document, model, Schema } from 'mongoose';

interface Evaluation extends Document {
    id: string;
    userId: string;
    wordId: string;
    sessionId: string;
    grade: number;
    date: Date;
    updatedAt: Date;
}

const evaluationSchema = new Schema<Evaluation>(
    {
        _id: { required: true, type: String },
        date: { required: true, type: Date },
        grade: { required: true, type: Number },
        sessionId: { required: true, type: String },
        updatedAt: { default: Date.now, type: Date },
        userId: { required: true, type: String },
        wordId: { required: true, type: String },
    },
    {
        timestamps: { createdAt: false, updatedAt: 'updatedAt' },
    },
);

evaluationSchema.virtual('id').get(function (this: Evaluation) {
    return this._id;
});

export default model<Evaluation>('Evaluation', evaluationSchema, 'evaluations');
