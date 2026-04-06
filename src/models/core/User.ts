import jwt from 'jsonwebtoken';
import { Document, model, Schema } from 'mongoose';

import { LanguageCode, LanguageCodeValue } from '../../constants/languageCodes';
import { SessionModel, SessionModelValue } from '../../constants/sessionModels';

interface RefreshToken {
    deviceId: string;
    token: string;
    issuedAt: Date;
}

export interface SuggestedTime {
    hour: number;
    minute: number;
}

interface DeviceToken {
    deviceId: string;
    token: string;
}

interface Notifications {
    enabled: boolean;
    neutralTime: SuggestedTime;
    endOfDayTime: SuggestedTime;
    deviceTokens: DeviceToken[];
    endOfDayTimeLastNotifiedAt?: Date;
    neutralTimeLastNotifiedAt?: Date;
}

export interface UserStats {
    studyDays: string[];
    sessionCount: number;
    evaluationCount: number;
    averageScore: number;
}

export type LanguageLevel = {
    language: LanguageCodeValue;
    level: 1 | 2 | 3 | 4 | 5;
};

interface User extends Document {
    provider: 'google' | 'facebook' | 'apple';
    providerId: string;
    name: string;
    email?: string;
    picture?: string;
    timezone: string;
    mainLang?: LanguageCodeValue;
    translationLang?: LanguageCodeValue;
    stats: UserStats;
    suggestionsInSession: boolean;
    languageLevels: LanguageLevel[];
    sessionModel: SessionModelValue;
    notifications: Notifications;
    refreshTokens: RefreshToken[];
    generateAccessToken(): string;
    registerDeviceAndGenerateRefreshToken(deviceId: string): string;
    generateRefreshToken(deviceId: string): string;
    extendRefreshToken(oldToken: string, deviceId: string): string;
    revokeTokensRelatedWithDeviceId(deviceId: string): void;
}

const languageLevelSchema = new Schema(
    {
        language: {
            enum: Object.values(LanguageCode),
            required: true,
            type: String,
        },
        level: {
            enum: [1, 2, 3, 4, 5],
            required: true,
            type: Number,
        },
    },
    { _id: false },
);

const userSchema = new Schema<User>({
    email: { required: false, type: String, unique: true },
    languageLevels: {
        default: [],
        type: [languageLevelSchema],
    },
    mainLang: { type: String },
    name: { required: true, type: String },
    notifications: {
        deviceTokens: [
            {
                deviceId: { required: true, type: String },
                token: { required: true, type: String },
            },
        ],
        enabled: { default: true, type: Boolean },
        endOfDayTime: {
            hour: { default: 20, type: Number },
            minute: { default: 0, type: Number },
        },
        endOfDayTimeLastNotifiedAt: { default: Date.now, type: Date },
        neutralTime: {
            hour: { default: 15, type: Number },
            minute: { default: 0, type: Number },
        },
        neutralTimeLastNotifiedAt: { default: Date.now, type: Date },
    },
    picture: { type: String },
    provider: { enum: ['google', 'facebook'], required: true, type: String },
    providerId: { required: true, type: String, unique: true },
    refreshTokens: [
        {
            deviceId: { required: true, type: String },
            issuedAt: { default: Date.now, required: true, type: Date },
            token: { required: true, type: String },
        },
    ],
    sessionModel: {
        default: SessionModel.Hybrid,
        enum: Object.values(SessionModel),
        required: true,
        type: String,
    },
    stats: {
        averageScore: { default: 0, type: Number },
        evaluationCount: { default: 0, type: Number },
        sessionCount: { default: 0, type: Number },
        studyDays: { default: [], type: [String] },
    },
    suggestionsInSession: { default: true, type: Boolean },
    timezone: { default: 'Europe/Warsaw', type: String },
    translationLang: { type: String },
});

userSchema.methods.generateAccessToken = function (): string {
    return jwt.sign({ userId: this._id }, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: '15m' });
};

userSchema.methods.registerDeviceAndGenerateRefreshToken = function (deviceId: string): string {
    const token = jwt.sign({ userId: this._id }, process.env.REFRESH_TOKEN_SECRET!, {
        expiresIn: '7d',
    });

    const existingDeviceIndex = this.refreshTokens.findIndex(
        (rt: RefreshToken) => rt.deviceId === deviceId,
    );
    if (existingDeviceIndex === -1) {
        this.refreshTokens.push({ deviceId, issuedAt: new Date(), token });
    } else {
        this.refreshTokens[existingDeviceIndex].token = token;
        this.refreshTokens[existingDeviceIndex].issuedAt = new Date();
    }

    this.save();
    return token;
};

userSchema.methods.generateRefreshToken = function (deviceId: string): string {
    const token = jwt.sign({ userId: this._id }, process.env.REFRESH_TOKEN_SECRET!, {
        expiresIn: '7d',
    });

    const existingTokenIndex = this.refreshTokens.findIndex(
        (rt: RefreshToken) => rt.deviceId === deviceId,
    );

    if (existingTokenIndex !== -1) {
        this.refreshTokens[existingTokenIndex] = { deviceId, issuedAt: new Date(), token };
    } else {
        this.refreshTokens.push({ deviceId, issuedAt: new Date(), token });
    }

    this.save();
    return token;
};

userSchema.methods.extendRefreshToken = function (oldToken: string, deviceId: string): string {
    const tokenIndex = this.refreshTokens.findIndex(
        (rt: RefreshToken) => rt.deviceId === deviceId && rt.token === oldToken,
    );

    if (tokenIndex === -1) {
        throw new Error('Invalid or expired refresh token');
    }

    const newToken = jwt.sign({ userId: this._id }, process.env.REFRESH_TOKEN_SECRET!, {
        expiresIn: '7d',
    });

    this.refreshTokens[tokenIndex].token = newToken;
    this.refreshTokens[tokenIndex].issuedAt = new Date();
    this.save();

    return newToken;
};

userSchema.methods.revokeTokensRelatedWithDeviceId = function (deviceId: string): void {
    this.refreshTokens = this.refreshTokens.filter((rt: RefreshToken) => rt.deviceId !== deviceId);
    this.notifications.deviceTokens = this.notifications.deviceTokens.filter(
        (token: DeviceToken) => token.deviceId !== deviceId,
    );
    this.save();
};

export default model<User>('User', userSchema, 'users');
