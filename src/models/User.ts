import { Schema, model, Document } from 'mongoose';
import jwt from 'jsonwebtoken';

interface User extends Document {
  provider: 'google' | 'facebook';
  providerId: string;
  name: string;
  email: string;
  picture?: string;
  generateAccessToken(): string;
  generateRefreshToken(): string;
}

const userSchema = new Schema<User>({
  provider: { type: String, enum: ['google', 'facebook'], required: true },
  providerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  picture: { type: String },
});

userSchema.methods.generateAccessToken = function (): string {
  return jwt.sign(
    { userId: this._id },
    process.env.ACCESS_TOKEN_SECRET!,
    { expiresIn: '15m' }
  );
};

userSchema.methods.generateRefreshToken = function (): string {
  return jwt.sign(
    { userId: this._id },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  );
};

export default model<User>('User', userSchema);