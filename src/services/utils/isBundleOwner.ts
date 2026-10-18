import { Types } from 'mongoose';

export const isBundleOwner = (bundle: { ownerId: Types.ObjectId }, userId: string): boolean =>
    bundle.ownerId.toString() === userId;
