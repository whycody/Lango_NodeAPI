import request from 'supertest';

import app from '../../app';
import BundleMember from '../../models/core/BundleMember';
import WordsBundle from '../../models/core/WordsBundle';

jest.mock('../../models/core/BundleMember');
jest.mock('../../models/core/WordsBundle');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '507f1f77bcf86cd799439011' })),
}));

const auth = 'Bearer mocked-access-token';

const mockLean = (result: unknown) => ({ lean: jest.fn().mockResolvedValue(result) });

describe('BundleMembers Routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /bundle-members', () => {
        it('returns 401 when authorization token is missing', async () => {
            const res = await request(app).get('/bundle-members');
            expect(res.status).toBe(401);
        });

        it("returns the user's memberships", async () => {
            (BundleMember.find as jest.Mock).mockReturnValue(
                mockLean([
                    { _id: 'member1', bundleId: 'bundle1', userId: '507f1f77bcf86cd799439011' },
                ]),
            );

            const res = await request(app).get('/bundle-members').set('Authorization', auth);

            expect(BundleMember.find).toHaveBeenCalledWith({ userId: '507f1f77bcf86cd799439011' });
            expect(res.status).toBe(200);
            expect(res.body).toEqual([
                { bundleId: 'bundle1', id: 'member1', userId: '507f1f77bcf86cd799439011' },
            ]);
        });

        it('filters memberships updated since the given date', async () => {
            const findMock = jest.fn().mockReturnValue(mockLean([]));
            (BundleMember.find as jest.Mock) = findMock;

            await request(app)
                .get('/bundle-members')
                .query({ since: '2026-01-01T00:00:00.000Z' })
                .set('Authorization', auth);

            expect(findMock).toHaveBeenCalledWith({
                updatedAt: { $gt: new Date('2026-01-01T00:00:00.000Z') },
                userId: '507f1f77bcf86cd799439011',
            });
        });
    });

    describe('GET /bundle-members/bundle/:bundleId', () => {
        it('returns empty array when bundle does not exist', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .get('/bundle-members/bundle/bundle1')
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns empty array when bundle is private and requester is not a member', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({ visibility: 'private' });
            (BundleMember.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .get('/bundle-members/bundle/bundle1')
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns members with user summaries for a public bundle', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({ visibility: 'public' });
            (BundleMember.findOne as jest.Mock).mockResolvedValue({
                userId: '507f1f77bcf86cd799439011',
            });

            const populateMock = jest.fn().mockReturnValue(
                mockLean([
                    {
                        _id: 'member1',
                        bundleId: 'bundle1',
                        userId: {
                            _id: '507f1f77bcf86cd799439011',
                            name: 'Jane',
                            picture: 'pic.png',
                        },
                    },
                ]),
            );
            (BundleMember.find as jest.Mock).mockReturnValue({ populate: populateMock });

            const res = await request(app)
                .get('/bundle-members/bundle/bundle1')
                .set('Authorization', auth);

            expect(populateMock).toHaveBeenCalledWith('userId', 'name picture');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([
                {
                    bundleId: 'bundle1',
                    id: 'member1',
                    userId: '507f1f77bcf86cd799439011',
                    userSummary: {
                        id: '507f1f77bcf86cd799439011',
                        name: 'Jane',
                        picture: 'pic.png',
                    },
                },
            ]);
        });

        it('returns members for a private bundle when requester is a member', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({ visibility: 'private' });
            (BundleMember.findOne as jest.Mock).mockResolvedValue({
                userId: '507f1f77bcf86cd799439011',
            });

            const populateMock = jest.fn().mockReturnValue(
                mockLean([
                    {
                        _id: 'member1',
                        bundleId: 'bundle1',
                        userId: { _id: '507f1f77bcf86cd799439011', name: 'Jane' },
                    },
                ]),
            );
            (BundleMember.find as jest.Mock).mockReturnValue({ populate: populateMock });

            const res = await request(app)
                .get('/bundle-members/bundle/bundle1')
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
    });

    describe('POST /bundle-members/sync', () => {
        it('creates a new member as viewer when requester is not the owner', async () => {
            (BundleMember.findOne as jest.Mock)
                .mockResolvedValueOnce(null) // existingMember lookup
                .mockResolvedValueOnce(null); // duplicateMember lookup
            (WordsBundle.findById as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                ownerId: { toString: () => 'ownerId' },
            });
            (BundleMember.findOneAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'member1',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });

            const res = await request(app)
                .post('/bundle-members/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'member1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        role: 'owner',
                        userId: '507f1f77bcf86cd799439011',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.synced).toEqual([
                { id: 'member1', updatedAt: '2026-01-01T00:00:00.000Z' },
            ]);
            expect(res.body.rejectedIds).toEqual([]);
            expect(res.body.unauthorized).toEqual([]);
        });

        it('skips member sync when local update is older than existing', async () => {
            (BundleMember.findOne as jest.Mock).mockResolvedValue({
                updatedAt: '2026-02-01T00:00:00.000Z',
            });

            const res = await request(app)
                .post('/bundle-members/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'member1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        role: 'viewer',
                        userId: '507f1f77bcf86cd799439011',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.synced).toEqual([]);
        });

        it('rejects the member when the bundle no longer exists and there is no existing member', async () => {
            (BundleMember.findOne as jest.Mock).mockResolvedValue(null);
            (WordsBundle.findById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/bundle-members/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'member1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        role: 'viewer',
                        userId: '507f1f77bcf86cd799439011',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.rejectedIds).toEqual(['member1']);
        });

        it('flags an existing member as unauthorized when the bundle no longer exists', async () => {
            const existingMember = {
                _id: 'member1',
                toObject: () => ({ _id: 'member1', bundleId: 'bundle1' }),
                userId: { toString: () => '507f1f77bcf86cd799439011' },
            };
            (BundleMember.findOne as jest.Mock).mockResolvedValue(existingMember);
            (WordsBundle.findById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/bundle-members/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'member1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        role: 'viewer',
                        userId: '507f1f77bcf86cd799439011',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.unauthorized).toEqual([{ bundleId: 'bundle1', id: 'member1' }]);
        });

        it('rejects non-owner attempts to modify another user membership', async () => {
            (BundleMember.findOne as jest.Mock).mockResolvedValue(null);
            (WordsBundle.findById as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                ownerId: { toString: () => 'someoneElse' },
            });

            const res = await request(app)
                .post('/bundle-members/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'member1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        role: 'viewer',
                        userId: 'anotherUser',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.rejectedIds).toEqual(['member1']);
        });

        it('rejects duplicate membership creation for the same bundle and user', async () => {
            (BundleMember.findOne as jest.Mock)
                .mockResolvedValueOnce(null) // existingMember lookup
                .mockResolvedValueOnce({ _id: 'existingDup' }); // duplicateMember lookup
            (WordsBundle.findById as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                ownerId: { toString: () => '507f1f77bcf86cd799439011' },
            });

            const res = await request(app)
                .post('/bundle-members/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'member1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        role: 'viewer',
                        userId: '507f1f77bcf86cd799439011',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.rejectedIds).toEqual(['member1']);
        });

        it('continues processing when an individual member sync fails', async () => {
            (BundleMember.findOne as jest.Mock).mockRejectedValue(new Error('db error'));

            const res = await request(app)
                .post('/bundle-members/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'member1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        role: 'viewer',
                        userId: '507f1f77bcf86cd799439011',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.synced).toEqual([]);
            expect(res.body.rejectedIds).toEqual([]);
        });
    });
});
