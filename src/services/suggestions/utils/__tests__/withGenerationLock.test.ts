import LockModel from '../../../../models/utils/Lock';
import { withGenerationLock } from '../withGenerationLock';

jest.mock('../../../../models/utils/Lock');

describe('withGenerationLock', () => {
    const key = 'test-lock-key';

    beforeEach(() => {
        jest.clearAllMocks();

        (LockModel.create as jest.Mock).mockResolvedValue({});
        (LockModel.deleteOne as jest.Mock).mockReturnValue({
            exec: jest.fn().mockResolvedValue({}),
        });
    });

    it('acquires lock, executes fn, and releases lock', async () => {
        const fn = jest.fn().mockResolvedValue(undefined);

        const result = await withGenerationLock(key, fn);

        expect(LockModel.create).toHaveBeenCalledWith(expect.objectContaining({ _id: key }));
        expect(fn).toHaveBeenCalled();
        expect(LockModel.deleteOne).toHaveBeenCalledWith({ _id: key });
        expect(result).toBe(true);
    });

    it('returns false when lock is already held and not expired', async () => {
        const duplicateError = { code: 11000 };
        (LockModel.create as jest.Mock).mockRejectedValue(duplicateError);

        (LockModel.findById as jest.Mock).mockReturnValue({
            exec: jest.fn().mockResolvedValue({
                expiresAt: new Date(Date.now() + 60_000),
            }),
        });

        const fn = jest.fn();
        const result = await withGenerationLock(key, fn);

        expect(fn).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('takes over expired lock and executes fn', async () => {
        const duplicateError = { code: 11000 };
        (LockModel.create as jest.Mock).mockRejectedValue(duplicateError);

        (LockModel.findById as jest.Mock).mockReturnValue({
            exec: jest.fn().mockResolvedValue({
                expiresAt: new Date(Date.now() - 10_000),
            }),
        });

        (LockModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
            exec: jest.fn().mockResolvedValue({}),
        });

        const fn = jest.fn().mockResolvedValue(undefined);
        const result = await withGenerationLock(key, fn);

        expect(LockModel.findByIdAndUpdate).toHaveBeenCalledWith(
            key,
            expect.objectContaining({ lockedAt: expect.any(Date), expiresAt: expect.any(Date) }),
            { upsert: true },
        );
        expect(fn).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    it('releases lock even when fn throws', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fn failed'));

        await expect(withGenerationLock(key, fn)).rejects.toThrow('fn failed');

        expect(LockModel.deleteOne).toHaveBeenCalledWith({ _id: key });
    });

    it('rethrows non-duplicate errors from create', async () => {
        const otherError = new Error('connection error');
        (LockModel.create as jest.Mock).mockRejectedValue(otherError);

        const fn = jest.fn();

        await expect(withGenerationLock(key, fn)).rejects.toThrow('connection error');
        expect(fn).not.toHaveBeenCalled();
    });

    it('takes over when existing lock is not found (deleted between check)', async () => {
        const duplicateError = { code: 11000 };
        (LockModel.create as jest.Mock).mockRejectedValue(duplicateError);

        (LockModel.findById as jest.Mock).mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
        });

        (LockModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
            exec: jest.fn().mockResolvedValue({}),
        });

        const fn = jest.fn().mockResolvedValue(undefined);
        const result = await withGenerationLock(key, fn);

        expect(LockModel.findByIdAndUpdate).toHaveBeenCalled();
        expect(fn).toHaveBeenCalled();
        expect(result).toBe(true);
    });
});
