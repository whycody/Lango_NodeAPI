import request from 'supertest';

import app from '../../app';
import BundleMember from '../../models/core/BundleMember';
import Word from '../../models/core/Word';
import WordsBundle from '../../models/core/WordsBundle';

jest.mock('../../models/core/BundleMember');
jest.mock('../../models/core/Word');
jest.mock('../../models/core/WordsBundle');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '507f1f77bcf86cd799439011' })),
}));

const auth = 'Bearer mocked-access-token';
const userId = '507f1f77bcf86cd799439011';

const mockLean = (result: unknown) => ({ lean: jest.fn().mockResolvedValue(result) });

describe('Words Routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/words', () => {
        it('returns 401 when authorization token is missing', async () => {
            const res = await request(app).get('/api/words');
            expect(res.status).toBe(401);
        });

        it("returns the user's own unbundled words and words from bundles they belong to", async () => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue(['bundle1']),
            });
            (Word.find as jest.Mock).mockReturnValue(
                mockLean([{ _id: 'word1', userId, word: 'casa' }]),
            );

            const res = await request(app).get('/api/words').set('Authorization', auth);

            expect(Word.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    $or: [{ bundleId: null, userId }, { bundleId: { $in: ['bundle1'] } }],
                }),
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ id: 'word1', userId, word: 'casa' }]);
        });

        it('filters words updated since the given date', async () => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue([]),
            });
            const findMock = jest.fn().mockReturnValue(mockLean([]));
            (Word.find as jest.Mock) = findMock;

            await request(app)
                .get('/api/words')
                .query({ since: '2026-01-01T00:00:00.000Z' })
                .set('Authorization', auth);

            expect(findMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    updatedAt: { $gt: new Date('2026-01-01T00:00:00.000Z') },
                }),
            );
        });

        it('returns 404 when the requested bundle does not exist', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .get('/api/words')
                .query({ bundleId: 'bundle1' })
                .set('Authorization', auth);

            expect(res.status).toBe(404);
        });

        it('returns 403 when the bundle is private and the user is not a member', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({ visibility: 'private' });
            (BundleMember.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .get('/api/words')
                .query({ bundleId: 'bundle1' })
                .set('Authorization', auth);

            expect(res.status).toBe(403);
        });

        it('returns words for a private bundle when the user is a member', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({ visibility: 'private' });
            (BundleMember.findOne as jest.Mock).mockResolvedValue({ userId });
            const findMock = jest
                .fn()
                .mockReturnValue(mockLean([{ _id: 'word1', bundleId: 'bundle1', word: 'casa' }]));
            (Word.find as jest.Mock) = findMock;

            const res = await request(app)
                .get('/api/words')
                .query({ bundleId: 'bundle1' })
                .set('Authorization', auth);

            expect(findMock).toHaveBeenCalledWith(expect.objectContaining({ bundleId: 'bundle1' }));
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ bundleId: 'bundle1', id: 'word1', word: 'casa' }]);
        });

        it('returns words for a public bundle even when the user is not a member', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue({ visibility: 'public' });
            const findMock = jest
                .fn()
                .mockReturnValue(mockLean([{ _id: 'word1', bundleId: 'bundle1', word: 'casa' }]));
            (Word.find as jest.Mock) = findMock;

            const res = await request(app)
                .get('/api/words')
                .query({ bundleId: 'bundle1' })
                .set('Authorization', auth);

            expect(BundleMember.findOne).not.toHaveBeenCalled();
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ bundleId: 'bundle1', id: 'word1', word: 'casa' }]);
        });
    });

    describe('POST /api/words/sync', () => {
        it('creates a new personal word (no bundle) for the requesting user', async () => {
            (Word.findOne as jest.Mock).mockResolvedValue(null);
            (Word.findOneAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'word1',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        userId,
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.synced).toEqual([
                { id: 'word1', updatedAt: '2026-01-01T00:00:00.000Z' },
            ]);
            expect(res.body.rejectedIds).toEqual([]);
            expect(res.body.unauthorized).toEqual([]);
        });

        it('skips word sync when local update is older than existing', async () => {
            (Word.findOne as jest.Mock).mockResolvedValue({
                updatedAt: '2026-02-01T00:00:00.000Z',
            });

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        userId,
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.synced).toEqual([]);
            expect(Word.findOneAndUpdate).not.toHaveBeenCalled();
        });

        it('rejects creating a personal word for another user', async () => {
            (Word.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        userId: 'anotherUser',
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.rejectedIds).toEqual(['word1']);
            expect(Word.findOneAndUpdate).not.toHaveBeenCalled();
        });

        it('flags an existing personal word as unauthorized when it belongs to another user', async () => {
            const existingWord = {
                _id: 'word1',
                bundleId: undefined,
                toObject: () => ({ _id: 'word1', userId: 'anotherUser', word: 'casa' }),
                userId: 'anotherUser',
            };
            (Word.findOne as jest.Mock).mockResolvedValue(existingWord);

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        userId: 'anotherUser',
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.unauthorized).toEqual([
                { id: 'word1', userId: 'anotherUser', word: 'casa' },
            ]);
        });

        it('creates a bundle word when the user is an owner/editor member', async () => {
            (Word.findOne as jest.Mock).mockResolvedValue(null);
            (BundleMember.findOne as jest.Mock).mockResolvedValue({ role: 'editor' });
            (Word.findOneAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'word1',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.synced).toEqual([
                { id: 'word1', updatedAt: '2026-01-01T00:00:00.000Z' },
            ]);
        });

        it('rejects creating a bundle word when the user is not a member with edit rights', async () => {
            (Word.findOne as jest.Mock).mockResolvedValue(null);
            (BundleMember.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.rejectedIds).toEqual(['word1']);
            expect(Word.findOneAndUpdate).not.toHaveBeenCalled();
        });

        it('flags an existing bundle word as unauthorized when membership is lost', async () => {
            const existingWord = {
                _id: 'word1',
                bundleId: 'bundle1',
                toObject: () => ({ _id: 'word1', bundleId: 'bundle1', word: 'casa' }),
                userId,
            };
            (Word.findOne as jest.Mock).mockResolvedValue(existingWord);
            (BundleMember.findOne as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        bundleId: 'bundle1',
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.unauthorized).toEqual([
                { bundleId: 'bundle1', id: 'word1', word: 'casa' },
            ]);
        });

        it('continues processing when an individual word sync fails', async () => {
            (Word.findOne as jest.Mock).mockRejectedValue(new Error('db error'));

            const res = await request(app)
                .post('/api/words/sync')
                .set('Authorization', auth)
                .send([
                    {
                        id: 'word1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        userId,
                        word: 'casa',
                    },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.synced).toEqual([]);
            expect(res.body.rejectedIds).toEqual([]);
        });
    });
});
