import { Document, model, Schema } from 'mongoose';
import jwt from 'jsonwebtoken';
import { SessionMode, SessionModeValue } from "../../constants/sessionModes";

interface RefreshToken {
  deviceId: string;
  token: string;
  issuedAt: Date;
}

interface User extends Document {
  provider: 'google' | 'facebook';
  providerId: string;
  name: string;
  email: string;
  picture?: string;
  sessionModel: SessionModeValue;
  refreshTokens: RefreshToken[];
  generateAccessToken(): string;
  registerDeviceAndGenerateRefreshToken(deviceId: string): string;
  generateRefreshToken(deviceId: string): string;
  extendRefreshToken(oldToken: string, deviceId: string): string;
  revokeRefreshToken(deviceId: string): void;
}

const userSchema = new Schema<User>({
  provider: { type: String, enum: ['google', 'facebook'], required: true },
  providerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: false, unique: true },
  picture: { type: String },
  sessionModel: { type: String, enum: Object.values(SessionMode), default: SessionMode.Hybrid, required: true },
  refreshTokens: [{
    deviceId: { type: String, required: true },
    token: { type: String, required: true },
    issuedAt: { type: Date, required: true, default: Date.now },
  }],
});

userSchema.methods.generateAccessToken = function (): string {
  return jwt.sign(
    { userId: this._id },
    process.env.ACCESS_TOKEN_SECRET!,
    { expiresIn: '15m' }
  );
};

userSchema.methods.registerDeviceAndGenerateRefreshToken = function (deviceId: string): string {
  const token = jwt.sign(
    { userId: this._id },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  );

  const existingDeviceIndex = this.refreshTokens.findIndex((rt: RefreshToken) => rt.deviceId === deviceId);
  if (existingDeviceIndex === -1) {
    this.refreshTokens.push({ token, deviceId, issuedAt: new Date() });
  } else {
    this.refreshTokens[existingDeviceIndex].token = token;
    this.refreshTokens[existingDeviceIndex].issuedAt = new Date();
  }

  this.save();
  return token;
};

userSchema.methods.generateRefreshToken = function (deviceId: string): string {
  const token = jwt.sign(
    { userId: this._id },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  );

  const existingTokenIndex = this.refreshTokens.findIndex((rt: RefreshToken) => rt.deviceId === deviceId);

  if (existingTokenIndex !== -1) {
    this.refreshTokens[existingTokenIndex] = { deviceId, token, issuedAt: new Date() };
  } else {
    this.refreshTokens.push({ deviceId, token, issuedAt: new Date() });
  }

  this.save();
  return token;
};

userSchema.methods.extendRefreshToken = function (oldToken: string, deviceId: string): string {
  const tokenIndex = this.refreshTokens.findIndex((rt: RefreshToken) => rt.deviceId === deviceId && rt.token === oldToken);

  if (tokenIndex === -1) {
    throw new Error('Invalid or expired refresh token');
  }

  const newToken = jwt.sign(
    { userId: this._id },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  );

  this.refreshTokens[tokenIndex].token = newToken;
  this.refreshTokens[tokenIndex].issuedAt = new Date();
  this.save();

  return newToken;
};

userSchema.methods.revokeRefreshToken = function (deviceId: string): void {
  this.refreshTokens = this.refreshTokens.filter((rt: RefreshToken) => rt.deviceId !== deviceId);
  this.save();
};


export default model<User>('User', userSchema, 'users');