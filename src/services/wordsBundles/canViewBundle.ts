import { Types } from 'mongoose';

import BundleMember from '../../models/core/BundleMember';

export async function canViewBundle(
    bundle: { _id: unknown; visibility: string },
    userId: string,
): Promise<boolean> {
    if (bundle.visibility === 'public') {
        return true;
    }

    const membership = await BundleMember.findOne({
        bundleId: bundle._id,
        removed: false,
        userId: new Types.ObjectId(userId),
    });

    return Boolean(membership);
}
