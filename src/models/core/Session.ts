import { Document, model, Schema } from 'mongoose';

import { LanguageCode, LanguageCodeValue } from '../../constants/languageCodes';
import { SessionModel, SessionModelValue } from '../../constants/sessionModels';
import { SessionMode, SessionModeValue } from '../../constants/sessionModes';

interface Session extends Document {
    id: string;
    userId: string;
    date: Date;
    localDay: string;
    mode: SessionModeValue;
    mainLang: LanguageCodeValue;
    translationLang: LanguageCodeValue;
    sessionModel: SessionModelValue;
    sessionModelVersion: string;
    averageScore: number;
    wordsCount: number;
    finished: boolean;
    updatedAt: Date;
}

const sessionSchema = new Schema<Session>(
    {
        _id: { required: true, type: String },
        averageScore: { required: true, type: Number },
        date: { required: true, type: Date },
        finished: { default: true, type: Boolean },
        localDay: { required: true, type: String },
        mainLang: { enum: Object.values(LanguageCode), required: true, type: String },
        mode: { enum: Object.values(SessionMode), required: true, type: String },
        sessionModel: { enum: Object.values(SessionModel), required: true, type: String },
        sessionModelVersion: { required: false, type: String },
        translationLang: { enum: Object.values(LanguageCode), required: true, type: String },
        updatedAt: { default: Date.now, type: Date },
        userId: { required: true, type: String },
        wordsCount: { required: true, type: Number },
    },
    {
        timestamps: { createdAt: false, updatedAt: 'updatedAt' },
    },
);

sessionSchema.virtual('id').get(function (this: Session) {
    return this._id;
});

sessionSchema.index({ userId: 1 });

export default model<Session>('Session', sessionSchema, 'sessions');
