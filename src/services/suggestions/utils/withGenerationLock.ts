import LockModel from '../../../models/utils/Lock';

export async function withGenerationLock(
    key: string,
    fn: () => Promise<void>,
    lockTTLSeconds = 60,
): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + lockTTLSeconds * 1000);

    try {
        await LockModel.create({ _id: key, expiresAt, lockedAt: now });
    } catch (err: any) {
        if (err.code === 11000) {
            const existingLock = await LockModel.findById(key).exec();

            if (existingLock && existingLock.expiresAt > now) return false;

            await LockModel.findByIdAndUpdate(
                key,
                { expiresAt, lockedAt: now },
                { upsert: true },
            ).exec();
        } else {
            throw err;
        }
    }

    try {
        await fn();
        return true;
    } finally {
        await LockModel.deleteOne({ _id: key }).exec();
    }
}
