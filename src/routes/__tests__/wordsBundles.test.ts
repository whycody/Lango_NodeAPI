import request from 'supertest';

import app from '../../app';
import BundleJoinCode from '../../models/core/BundleJoinCode';
import BundleMember from '../../models/core/BundleMember';
import User from '../../models/core/User';
import Word from '../../models/core/Word';
import WordsBundle from '../../models/core/WordsBundle';

jest.mock('../../models/core/WordsBundle');
jest.mock('../../models/core/BundleMember');
jest.mock('../../models/core/BundleJoinCode');
jest.mock('../../models/core/User');
jest.mock('../../models/core/Word');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '507f1f77bcf86cd799439011' })),
}));

const auth = 'Bearer mocked-access-token';

const mockLean = (result: unknown) => ({ lean: jest.fn().mockResolvedValue(result) });

const mockSearchAggregate = (data: unknown[], total: number) =>
    jest.fn().mockResolvedValue([{ data, totalCount: total ? [{ total }] : [] }]);

const getAggregatePipeline = (aggregateMock: jest.Mock) => aggregateMock.mock.calls[0][0];

const getMatchStage = (aggregateMock: jest.Mock) => getAggregatePipeline(aggregateMock)[0].$match;

const getFacetDataStages = (aggregateMock: jest.Mock) =>
    getAggregatePipeline(aggregateMock).find((stage: Record<string, unknown>) => stage.$facet)
        .$facet.data;

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

    describe('GET /words-bundles/search', () => {
        beforeEach(() => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue([]),
            });
            (User.find as jest.Mock).mockReturnValue(mockLean([]));
            (Word.aggregate as jest.Mock).mockResolvedValue([]);
            (WordsBundle.aggregate as jest.Mock) = mockSearchAggregate([], 0);
        });

        it('returns empty data and total when no query is provided', async () => {
            const res = await request(app).get('/words-bundles/search').set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ data: [], total: 0 });
            expect(WordsBundle.aggregate).not.toHaveBeenCalled();
        });

        it('returns empty data and total when query is blank', async () => {
            const res = await request(app)
                .get('/words-bundles/search')
                .query({ q: '   ' })
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ data: [], total: 0 });
        });

        it('searches public bundles and bundles the user belongs to, by combined search text, using the default limit', async () => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue(['bundle2']),
            });
            const aggregateMock = mockSearchAggregate(
                [{ _id: 'bundle1', ownerId: 'owner1', title: 'Italian basics' }],
                1,
            );
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;
            (User.find as jest.Mock).mockReturnValue(mockLean([{ _id: 'owner1', name: 'Jane' }]));
            (Word.aggregate as jest.Mock).mockResolvedValue([{ _id: 'bundle1', count: 3 }]);

            const res = await request(app)
                .get('/words-bundles/search')
                .query({ q: 'italian' })
                .set('Authorization', auth);

            expect(getMatchStage(aggregateMock)).toEqual({
                $and: [{ searchText: /italian/i }],
                $or: [{ visibility: 'public' }, { _id: { $in: ['bundle2'] } }],
                removed: false,
            });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                data: [
                    {
                        creatorName: 'Jane',
                        flashcardsCount: 3,
                        id: 'bundle1',
                        ownerId: 'owner1',
                        title: 'Italian basics',
                    },
                ],
                total: 1,
            });
        });

        it('sorts results by createdAt descending', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ q: 'italian' })
                .set('Authorization', auth);

            expect(getFacetDataStages(aggregateMock)).toContainEqual({
                $sort: { createdAt: -1 },
            });
        });

        it('defaults flashcardsCount to 0 when no words exist for the bundle', async () => {
            (WordsBundle.aggregate as jest.Mock) = mockSearchAggregate(
                [{ _id: 'bundle1', ownerId: 'owner1', title: 'Bundle 1' }],
                1,
            );
            (User.find as jest.Mock).mockReturnValue(mockLean([{ _id: 'owner1', name: 'Jane' }]));
            (Word.aggregate as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .get('/words-bundles/search')
                .query({ q: 'bundle' })
                .set('Authorization', auth);

            expect(res.body).toEqual({
                data: [
                    {
                        creatorName: 'Jane',
                        flashcardsCount: 0,
                        id: 'bundle1',
                        ownerId: 'owner1',
                        title: 'Bundle 1',
                    },
                ],
                total: 1,
            });
        });

        it('returns the total count of matching bundles regardless of pagination', async () => {
            (WordsBundle.aggregate as jest.Mock) = mockSearchAggregate([], 123);

            const res = await request(app)
                .get('/words-bundles/search')
                .query({ limit: '10', q: 'italian' })
                .set('Authorization', auth);

            expect(res.body.total).toBe(123);
        });

        it('matches bundles with diacritics using a plain ASCII query', async () => {
            const aggregateMock = mockSearchAggregate(
                [{ _id: 'bundle1', ownerId: 'owner1', title: 'Chrobąszcz' }],
                1,
            );
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ q: 'chrobaszcz' })
                .set('Authorization', auth);

            expect(getMatchStage(aggregateMock)).toEqual(
                expect.objectContaining({
                    $and: [{ searchText: /chrobaszcz/i }],
                }),
            );
        });

        it('escapes regex special characters in the search term', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ q: 'a.b*c' })
                .set('Authorization', auth);

            const calledQuery = getMatchStage(aggregateMock);
            const usedRegex = calledQuery.$and[0].searchText as RegExp;

            expect(usedRegex.source).toBe('a\\.b\\*c');
            expect(usedRegex.test('a.b*c')).toBe(true);
            expect(usedRegex.test('axbyc')).toBe(false);
        });

        it('matches words regardless of order by requiring each word independently', async () => {
            const aggregateMock = mockSearchAggregate(
                [{ _id: 'bundle1', ownerId: 'owner1', title: 'Italian basics' }],
                1,
            );
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            const res = await request(app)
                .get('/words-bundles/search')
                .query({ q: 'basics italian' })
                .set('Authorization', auth);

            expect(getMatchStage(aggregateMock)).toEqual({
                $and: [{ searchText: /basics/i }, { searchText: /italian/i }],
                $or: [{ visibility: 'public' }, { _id: { $in: [] } }],
                removed: false,
            });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                data: [
                    {
                        creatorName: undefined,
                        flashcardsCount: 0,
                        id: 'bundle1',
                        ownerId: 'owner1',
                        title: 'Italian basics',
                    },
                ],
                total: 1,
            });
        });

        it('collapses repeated whitespace between words', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ q: '  basics   italian  ' })
                .set('Authorization', auth);

            expect(getMatchStage(aggregateMock)).toEqual(
                expect.objectContaining({
                    $and: [{ searchText: /basics/i }, { searchText: /italian/i }],
                }),
            );
        });

        it('includes a private bundle the user is a non-removed member of', async () => {
            (BundleMember.find as jest.Mock).mockReturnValue({
                distinct: jest.fn().mockResolvedValue(['bundle1']),
            });
            const aggregateMock = mockSearchAggregate(
                [
                    {
                        _id: 'bundle1',
                        ownerId: 'owner1',
                        title: 'Italian basics',
                        visibility: 'private',
                    },
                ],
                1,
            );
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            const res = await request(app)
                .get('/words-bundles/search')
                .query({ q: 'italian' })
                .set('Authorization', auth);

            expect(getMatchStage(aggregateMock)).toEqual(
                expect.objectContaining({
                    $or: [{ visibility: 'public' }, { _id: { $in: ['bundle1'] } }],
                }),
            );
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                data: [
                    {
                        creatorName: undefined,
                        flashcardsCount: 0,
                        id: 'bundle1',
                        ownerId: 'owner1',
                        title: 'Italian basics',
                        visibility: 'private',
                    },
                ],
                total: 1,
            });
        });

        it('only queries membership for the requesting user, excluding removed memberships', async () => {
            const distinctMock = jest.fn().mockResolvedValue([]);
            (BundleMember.find as jest.Mock).mockReturnValue({ distinct: distinctMock });
            (WordsBundle.aggregate as jest.Mock) = mockSearchAggregate([], 0);

            await request(app)
                .get('/words-bundles/search')
                .query({ q: 'italian' })
                .set('Authorization', auth);

            expect(BundleMember.find).toHaveBeenCalledWith({
                removed: false,
                userId: '507f1f77bcf86cd799439011',
            });
            expect(distinctMock).toHaveBeenCalledWith('bundleId');
        });

        it('caps the result limit at 50', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ limit: '500', q: 'italian' })
                .set('Authorization', auth);

            expect(getFacetDataStages(aggregateMock)).toContainEqual({ $limit: 50 });
        });

        it('falls back to the default limit when an invalid limit is provided', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ limit: 'abc', q: 'italian' })
                .set('Authorization', auth);

            expect(getFacetDataStages(aggregateMock)).toContainEqual({ $limit: 20 });
        });

        it('defaults offset to 0 when not provided', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ q: 'italian' })
                .set('Authorization', auth);

            expect(getFacetDataStages(aggregateMock)).toContainEqual({ $skip: 0 });
        });

        it('applies the provided offset', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ offset: '40', q: 'italian' })
                .set('Authorization', auth);

            expect(getFacetDataStages(aggregateMock)).toContainEqual({ $skip: 40 });
        });

        it('falls back to offset 0 when a negative or invalid offset is provided', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ offset: '-5', q: 'italian' })
                .set('Authorization', auth);

            expect(getFacetDataStages(aggregateMock)).toContainEqual({ $skip: 0 });
        });

        it('filters by mainLang and translationLang when provided', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ mainLang: 'it', q: 'italian', translationLang: 'pl' })
                .set('Authorization', auth);

            expect(getMatchStage(aggregateMock)).toEqual({
                $and: [{ searchText: /italian/i }],
                $or: [{ visibility: 'public' }, { _id: { $in: [] } }],
                mainLang: 'it',
                removed: false,
                translationLang: 'pl',
            });
        });

        it('ignores invalid mainLang and translationLang values', async () => {
            const aggregateMock = mockSearchAggregate([], 0);
            (WordsBundle.aggregate as jest.Mock) = aggregateMock;

            await request(app)
                .get('/words-bundles/search')
                .query({ mainLang: 'xx', q: 'italian', translationLang: 'yy' })
                .set('Authorization', auth);

            expect(getMatchStage(aggregateMock)).toEqual({
                $and: [{ searchText: /italian/i }],
                $or: [{ visibility: 'public' }, { _id: { $in: [] } }],
                removed: false,
            });
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

        it('passes title and description through to $set unchanged, leaving searchText to the model hook', async () => {
            (WordsBundle.findOne as jest.Mock).mockResolvedValue(null);
            (WordsBundle.findOneAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'bundle1',
                updatedAt: '2026-01-01T00:00:00.000Z',
                visibility: 'public',
            });

            await request(app)
                .post('/words-bundles/sync')
                .set('Authorization', auth)
                .send([
                    {
                        description: 'Chrobąszcz opis',
                        id: 'bundle1',
                        locallyUpdatedAt: '2026-01-01T00:00:00.000Z',
                        title: 'Chrobąszcz',
                    },
                ]);

            expect(WordsBundle.findOneAndUpdate).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    $set: expect.objectContaining({
                        description: 'Chrobąszcz opis',
                        title: 'Chrobąszcz',
                    }),
                }),
                expect.anything(),
            );
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
