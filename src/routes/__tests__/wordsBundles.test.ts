import request from 'supertest';

import app from '../../app';
import BundleJoinCode from '../../models/core/BundleJoinCode';
import BundleMember from '../../models/core/BundleMember';
import WordsBundle from '../../models/core/WordsBundle';

jest.mock('../../models/core/WordsBundle');
jest.mock('../../models/core/BundleMember');
jest.mock('../../models/core/BundleJoinCode');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '507f1f77bcf86cd799439011' })),
}));

const auth = 'Bearer mocked-access-token';

const mockLean = (result: unknown) => ({ lean: jest.fn().mockResolvedValue(result) });

describe('WordsBundles Routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /words-bundles', () => {
        it('returns 401 when authorization token is missing', async () => {
            const res = await request(app).get('/words-bundles');
            expect(res.status).toBe(401);
        });

        it('returns bundles the user is a member of', async () => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue(['bundle1']),
            });
            (WordsBundle.find as jest.Mock).mockReturnValue(
                mockLean([{ _id: 'bundle1', title: 'Bundle 1' }]),
            );

            const res = await request(app).get('/words-bundles').set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ id: 'bundle1', title: 'Bundle 1' }]);
        });

        it('filters bundles updated since the given date', async () => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue(['bundle1']),
            });
            const findMock = jest.fn().mockReturnValue(mockLean([]));
            (WordsBundle.find as jest.Mock) = findMock;

            await request(app)
                .get('/words-bundles')
                .query({ since: '2026-01-01T00:00:00.000Z' })
                .set('Authorization', auth);

            expect(findMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    updatedAt: { $gt: new Date('2026-01-01T00:00:00.000Z') },
                }),
            );
        });
    });

    describe('GET /words-bundles/by-ids', () => {
        it('returns empty array when no ids are provided', async () => {
            const res = await request(app).get('/words-bundles/by-ids').set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns bundles matching the provided ids that the user belongs to', async () => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue(['bundle1']),
            });
            (WordsBundle.find as jest.Mock).mockReturnValue(
                mockLean([{ _id: 'bundle1', title: 'Bundle 1' }]),
            );

            const res = await request(app)
                .get('/words-bundles/by-ids')
                .query({ ids: 'bundle1,bundle2' })
                .set('Authorization', auth);

            expect(BundleMember.find).toHaveBeenCalledWith(
                expect.objectContaining({ bundleId: { $in: ['bundle1', 'bundle2'] } }),
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ id: 'bundle1', title: 'Bundle 1' }]);
        });
    });

    describe('POST /words-bundles/sync', () => {
        it('creates a new bundle when it does not exist', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue(null);
            (WordsBundle.findOneAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                updatedAt: '2026-01-01T00:00:00.000Z',
                visibility: 'public',
            });

            const res = await request(app)
                .post('/words-bundles/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'bundle1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        title: 'Bundle 1',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ id: 'bundle1', updatedAt: '2026-01-01T00:00:00.000Z' }]);
        });

        it('skips bundle when local update is older than existing', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({
                updatedAt: '2026-02-01T00:00:00.000Z',
            });

            const res = await request(app)
                .post('/words-bundles/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'bundle1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        title: 'Bundle 1',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
            expect(WordsBundle.findOneAndUpdate).not.toHaveBeenCalled();
        });

        it('removes non-owner members when visibility changes from public', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({
                updatedAt: '2020-01-01T00:00:00.000Z',
                visibility: 'public',
            });
            (WordsBundle.findOneAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                updatedAt: '2026-01-01T00:00:00.000Z',
                visibility: 'private',
            });
            (BundleMember.updateMany as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/words-bundles/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'bundle1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        title: 'Bundle 1',
                        visibility: 'private',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(BundleMember.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ bundleId: 'bundle1' }),
                expect.objectContaining({ $set: expect.objectContaining({ removed: true }) }),
            );
        });

        it('continues processing when an individual bundle sync fails', async () => {
            (WordsBundle.findOne as jest.Mock).mockRejectedValue(new Error('db error'));

            const res = await request(app)
                .post('/words-bundles/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'bundle1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        title: 'Bundle 1',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('DELETE /words-bundles/:id', () => {
        it('returns 404 when bundle does not exist', async () => {
            (WordsBundle.findById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .delete('/words-bundles/bundle1')
                .set('Authorization', auth);

            expect(res.status).toBe(404);
        });

        it('returns 403 when requester is not the owner', async () => {
            (WordsBundle.findById as jest.Mock).mockResolvedValue({
                ownerId: { toString: () => 'someoneElse' },
            });

            const res = await request(app)
                .delete('/words-bundles/bundle1')
                .set('Authorization', auth);

            expect(res.status).toBe(403);
        });

        it('soft deletes the bundle and its members when owner requests it', async () => {
            const bundle = {
                _id: 'bundle1',
                ownerId: { toString: () => '507f1f77bcf86cd799439011' },
                removed: false,
                save: jest.fn().mockResolvedValue(undefined),
            };
            (WordsBundle.findById as jest.Mock).mockResolvedValue(bundle);
            (BundleMember.updateMany as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .delete('/words-bundles/bundle1')
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(bundle.removed).toBe(true);
            expect(bundle.save).toHaveBeenCalled();
            expect(res.body).toEqual({ id: 'bundle1', removed: true });
        });
    });

    describe('POST /words-bundles/:id/generate-invitation-code', () => {
        it('returns 404 when bundle does not exist', async () => {
            (WordsBundle.findById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/words-bundles/bundle1/generate-invitation-code')
                .set('Authorization', auth);

            expect(res.status).toBe(404);
        });

        it('returns 403 when requester is not the owner', async () => {
            (WordsBundle.findById as jest.Mock).mockResolvedValue({
                ownerId: { toString: () => 'someoneElse' },
            });

            const res = await request(app)
                .post('/words-bundles/bundle1/generate-invitation-code')
                .set('Authorization', auth);

            expect(res.status).toBe(403);
        });

        it('generates a join code for the owner', async () => {
            (WordsBundle.findById as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                ownerId: { toString: () => '507f1f77bcf86cd799439011' },
            });
            (BundleJoinCode.create as jest.Mock).mockResolvedValue({
                _id: 'code1',
                bundleId: 'bundle1',
                code: 'ABCDEF',
                expireAt: new Date('2026-01-08T00:00:00.000Z'),
                role: 'viewer',
            });

            const res = await request(app)
                .post('/words-bundles/bundle1/generate-invitation-code')
                .set('Authorization', auth)
                .send({ role: 'viewer' });

            expect(res.status).toBe(201);
            expect(res.body).toEqual({
                bundleId: 'bundle1',
                code: 'ABCDEF',
                expireAt: '2026-01-08T00:00:00.000Z',
                id: 'code1',
                role: 'viewer',
            });
        });

        it('retries when a duplicate join code is generated', async () => {
            (WordsBundle.findById as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                ownerId: { toString: () => '507f1f77bcf86cd799439011' },
            });
            (BundleJoinCode.create as jest.Mock)
                .mockRejectedValueOnce({ code: 11000 })
                .mockResolvedValueOnce({
                    _id: 'code1',
                    bundleId: 'bundle1',
                    code: 'GHIJKL',
                    expireAt: new Date('2026-01-08T00:00:00.000Z'),
                    role: 'viewer',
                });

            const res = await request(app)
                .post('/words-bundles/bundle1/generate-invitation-code')
                .set('Authorization', auth)
                .send({});

            expect(res.status).toBe(201);
            expect(BundleJoinCode.create).toHaveBeenCalledTimes(2);
        });
    });

    describe('POST /words-bundles/join/:code', () => {
        it('returns 404 when join code is invalid or expired', async () => {
            (BundleJoinCode.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/words-bundles/join/ABCDEF')
                .set('Authorization', auth);

            expect(res.status).toBe(404);
        });

        it('returns 404 when join code has expired', async () => {
            (BundleJoinCode.findOne as jest.Mock).mockResolvedValue({
                bundleId: 'bundle1',
                expireAt: new Date('2020-01-01T00:00:00.000Z'),
                role: 'viewer',
            });

            const res = await request(app)
                .post('/words-bundles/join/ABCDEF')
                .set('Authorization', auth);

            expect(res.status).toBe(404);
        });

        it('returns existing membership when user already joined', async () => {
            (BundleJoinCode.findOne as jest.Mock).mockResolvedValue({
                bundleId: 'bundle1',
                expireAt: new Date('2030-01-01T00:00:00.000Z'),
                role: 'editor',
            });
            (BundleMember.findOne as jest.Mock).mockResolvedValue({
                _id: 'member1',
                bundleId: 'bundle1',
                removed: false,
                role: 'viewer',
            });

            const res = await request(app)
                .post('/words-bundles/join/ABCDEF')
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ bundleId: 'bundle1', id: 'member1', role: 'viewer' });
        });

        it('reactivates a removed membership using the new join code role', async () => {
            const existingMember = {
                _id: 'member1',
                bundleId: 'bundle1',
                joinedViaCodeId: undefined,
                removed: true,
                role: 'viewer',
                save: jest.fn().mockResolvedValue(undefined),
            };
            (BundleJoinCode.findOne as jest.Mock).mockResolvedValue({
                _id: 'code1',
                bundleId: 'bundle1',
                expireAt: new Date('2030-01-01T00:00:00.000Z'),
                role: 'editor',
            });
            (BundleMember.findOne as jest.Mock).mockResolvedValue(existingMember);

            const res = await request(app)
                .post('/words-bundles/join/ABCDEF')
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(existingMember.removed).toBe(false);
            expect(existingMember.role).toBe('editor');
            expect(existingMember.save).toHaveBeenCalled();
            expect(res.body).toEqual({ bundleId: 'bundle1', id: 'member1', role: 'editor' });
        });

        it('creates a new membership for a first-time joiner', async () => {
            (BundleJoinCode.findOne as jest.Mock).mockResolvedValue({
                _id: 'code1',
                bundleId: 'bundle1',
                expireAt: new Date('2030-01-01T00:00:00.000Z'),
                role: 'viewer',
            });
            (BundleMember.findOne as jest.Mock).mockResolvedValue(null);
            (BundleMember.create as jest.Mock).mockResolvedValue({
                _id: 'member2',
                bundleId: 'bundle1',
                role: 'viewer',
            });

            const res = await request(app)
                .post('/words-bundles/join/ABCDEF')
                .set('Authorization', auth);

            expect(res.status).toBe(201);
            expect(res.body).toEqual({ bundleId: 'bundle1', id: 'member2', role: 'viewer' });
        });
    });
});
