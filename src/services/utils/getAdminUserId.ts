import { Types } from 'mongoose';

export const getAdminUserId = (): Types.ObjectId | null => {
    const adminUserId = process.env.ADMIN_USER_ID;

    if (!adminUserId || !Types.ObjectId.isValid(adminUserId)) {
        return null;
    }

    return new Types.ObjectId(adminUserId);
};
