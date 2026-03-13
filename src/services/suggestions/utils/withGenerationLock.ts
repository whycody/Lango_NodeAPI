import LockModel from '../../../models/utils/Lock'

export async function withGenerationLock(
  key: string,
  fn: () => Promise<void>,
  lockTTLSeconds = 60
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lockTTLSeconds * 1000);

  try {
    await LockModel.create({ _id: key, lockedAt: now, expiresAt });
  } catch (err: any) {
    if (err.code === 11000) {
      const existingLock = await LockModel.findById(key).exec();

      if (existingLock && existingLock.expiresAt > now) return false;

      await LockModel.findByIdAndUpdate(key, { lockedAt: now, expiresAt }, { upsert: true }).exec();
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