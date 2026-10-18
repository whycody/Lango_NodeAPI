import request from 'supertest';

import app from '../../app';
import BundleThemeInstance from '../../models/core/BundleThemeInstance';
import User from '../../models/core/User';
import Word from '../../models/core/Word';
import WordsBundle from '../../models/core/WordsBundle';
import { translateWords } from '../../services/suggestions/translateWords';
import { saveGPTReport } from '../../services/suggestions/utils/reports/saveGPTReport';
import { withGenerationLock } from '../../services/suggestions/utils/withGenerationLock';

jest.mock('../../models/core/BundleThemeInstance');
jest.mock('../../models/core/User');
jest.mock('../../models/core/Word');
jest.mock('../../models/core/WordsBundle');
jest.mock('../../services/suggestions/translateWords');
jest.mock('../../services/suggestions/utils/reports/saveGPTReport');
jest.mock('../../services/suggestions/utils/withGenerationLock');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '507f1f77bcf86cd799439011' })),
}));

const auth = 'Bearer mocked-access-token';

const mockSelectLean = (result: unknown) => ({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }),
});

const mockLean = (result: unknown) => ({ lean: jest.fn().mockResolvedValue(result) });

describe('BundleThemeInstances Routes', () => {
    beforeEach(() => {
        (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: true }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /bundle-theme-instances', () => {
        const validBody = {
            mainLang: 'en',
            themeId: '507f1f77bcf86cd799439099',
            words: ['pillow', 'knife'],
        };

        it('returns 401 when authorization token is missing', async () => {
            const res = await request(app).post('/bundle-theme-instances').send(validBody);
            expect(res.status).toBe(401);
        });

        it('returns 403 when the user is not an admin', async () => {
            (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: false }));

            const res = await request(app)
                .post('/bundle-theme-instances')
                .set('Authorization', auth)
                .send(validBody);

            expect(res.status).toBe(403);
        });

        it('returns 400 when mainLang is invalid', async () => {
            const res = await request(app)
                .post('/bundle-theme-instances')
                .set('Authorization', auth)
                .send({ ...validBody, mainLang: 'xx' });

            expect(res.status).toBe(400);
        });

        it('returns 400 when words is empty', async () => {
            const res = await request(app)
                .post('/bundle-theme-instances')
                .set('Authorization', auth)
                .send({ ...validBody, words: [] });

            expect(res.status).toBe(400);
        });

        it('returns 400 when words contains duplicates', async () => {
            const res = await request(app)
                .post('/bundle-theme-instances')
                .set('Authorization', auth)
                .send({ ...validBody, words: ['pillow', 'pillow'] });

            expect(res.status).toBe(400);
        });

        it('creates a bundle theme instance', async () => {
            (BundleThemeInstance.create as jest.Mock).mockResolvedValue({
                toObject: () => ({ _id: 'instance1', ...validBody }),
            });

            const res = await request(app)
                .post('/bundle-theme-instances')
                .set('Authorization', auth)
                .send(validBody);

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('instance1');
        });

        it('returns 409 when an instance for themeId+mainLang already exists', async () => {
            (BundleThemeInstance.create as jest.Mock).mockRejectedValue({ code: 11000 });

            const res = await request(app)
                .post('/bundle-theme-instances')
                .set('Authorization', auth)
                .send(validBody);

            expect(res.status).toBe(409);
        });
    });

    describe('PATCH /bundle-theme-instances/:id', () => {
        it('returns 400 when words contains duplicates', async () => {
            const res = await request(app)
                .patch('/bundle-theme-instances/instance1')
                .set('Authorization', auth)
                .send({ words: ['pillow', 'pillow'] });

            expect(res.status).toBe(400);
        });

        it('returns 404 when the instance does not exist', async () => {
            (BundleThemeInstance.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .patch('/bundle-theme-instances/instance1')
                .set('Authorization', auth)
                .send({ words: ['pillow', 'knife'] });

            expect(res.status).toBe(404);
        });

        it('updates words on the instance', async () => {
            (BundleThemeInstance.findByIdAndUpdate as jest.Mock).mockResolvedValue({
                _id: 'instance1',
                toObject: () => ({ _id: 'instance1', words: ['pillow', 'knife'] }),
            });

            const res = await request(app)
                .patch('/bundle-theme-instances/instance1')
                .set('Authorization', auth)
                .send({ words: ['pillow', 'knife'] });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ id: 'instance1', words: ['pillow', 'knife'] });
        });

        describe('regenerateExisting', () => {
            const instanceDoc = {
                _id: 'instance1',
                mainLang: 'en',
                toObject: () => ({ _id: 'instance1', mainLang: 'en', words: ['pillow', 'knife'] }),
            };

            beforeEach(() => {
                (BundleThemeInstance.findByIdAndUpdate as jest.Mock).mockResolvedValue(
                    instanceDoc,
                );
                (withGenerationLock as jest.Mock).mockImplementation(
                    async (_key: string, fn: () => Promise<void>) => {
                        await fn();
                        return true;
                    },
                );
            });

            it('returns 400 when regenerateExisting is true but wordChanges is missing', async () => {
                const res = await request(app)
                    .patch('/bundle-theme-instances/instance1')
                    .set('Authorization', auth)
                    .send({ regenerateExisting: true, words: ['pillow', 'knife'] });

                expect(res.status).toBe(400);
            });

            it('updates an existing Word in place when text matches', async () => {
                (WordsBundle.find as jest.Mock).mockReturnValue(
                    mockLean([
                        { _id: 'bundle1', ownerId: 'admin1', translationLang: 'pl' },
                    ]),
                );
                (translateWords as jest.Mock).mockResolvedValue({
                    fetchMetadata: { totalWords: 1 },
                    translations: [
                        { isValid: true, source: 'pillow-fixed', translations: ['poduszka'] },
                    ],
                });

                const existingWordDoc = {
                    save: jest.fn().mockResolvedValue(undefined),
                    text: 'pillow',
                    translation: 'old-translation',
                    updatedAt: new Date('2020-01-01'),
                };
                (Word.findOne as jest.Mock).mockResolvedValue(existingWordDoc);

                const res = await request(app)
                    .patch('/bundle-theme-instances/instance1')
                    .set('Authorization', auth)
                    .send({
                        regenerateExisting: true,
                        wordChanges: [{ new: 'pillow-fixed', old: 'pillow' }],
                        words: ['pillow-fixed', 'knife'],
                    });

                expect(res.status).toBe(200);
                expect(WordsBundle.find).toHaveBeenCalledWith({
                    removed: false,
                    themeInstanceId: 'instance1',
                    wordsGenerated: true,
                });
                expect(Word.findOne).toHaveBeenCalledWith(
                    expect.objectContaining({
                        bundleId: 'bundle1',
                        source: 'lango',
                        text: 'pillow',
                    }),
                );
                expect(existingWordDoc.text).toBe('pillow-fixed');
                expect(existingWordDoc.translation).toBe('poduszka');
                expect(existingWordDoc.save).toHaveBeenCalled();
                expect(Word.create).not.toHaveBeenCalled();
                expect(res.body.failedTranslationLangs).toEqual([]);
            });

            it('creates a new Word when no existing text matches', async () => {
                (WordsBundle.find as jest.Mock).mockReturnValue(
                    mockLean([
                        { _id: 'bundle1', ownerId: 'admin1', translationLang: 'pl' },
                    ]),
                );
                (translateWords as jest.Mock).mockResolvedValue({
                    fetchMetadata: { totalWords: 1 },
                    translations: [
                        { isValid: true, source: 'spoon', translations: ['łyżka'] },
                    ],
                });
                (Word.findOne as jest.Mock).mockResolvedValue(null);
                (Word.create as jest.Mock).mockResolvedValue({});

                const res = await request(app)
                    .patch('/bundle-theme-instances/instance1')
                    .set('Authorization', auth)
                    .send({
                        regenerateExisting: true,
                        wordChanges: [{ new: 'spoon', old: 'fork' }],
                        words: ['pillow', 'knife', 'spoon'],
                    });

                expect(res.status).toBe(200);
                expect(Word.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        bundleId: 'bundle1',
                        source: 'lango',
                        text: 'spoon',
                        translation: 'łyżka',
                        translationLang: 'pl',
                    }),
                );
            });

            it('reports a failed translationLang without aborting other bundles when the lock is held', async () => {
                (WordsBundle.find as jest.Mock).mockReturnValue(
                    mockLean([
                        { _id: 'bundle1', ownerId: 'admin1', translationLang: 'pl' },
                        { _id: 'bundle2', ownerId: 'admin1', translationLang: 'es' },
                    ]),
                );
                (withGenerationLock as jest.Mock)
                    .mockResolvedValueOnce(false)
                    .mockImplementationOnce(async (_key: string, fn: () => Promise<void>) => {
                        await fn();
                        return true;
                    });
                (translateWords as jest.Mock).mockResolvedValue({
                    fetchMetadata: { totalWords: 1 },
                    translations: [
                        { isValid: true, source: 'spoon', translations: ['cuchara'] },
                    ],
                });
                (Word.findOne as jest.Mock).mockResolvedValue(null);
                (Word.create as jest.Mock).mockResolvedValue({});

                const res = await request(app)
                    .patch('/bundle-theme-instances/instance1')
                    .set('Authorization', auth)
                    .send({
                        regenerateExisting: true,
                        wordChanges: [{ new: 'spoon', old: 'fork' }],
                        words: ['pillow', 'knife', 'spoon'],
                    });

                expect(res.status).toBe(200);
                expect(res.body.failedTranslationLangs).toEqual(['pl']);
                expect(Word.create).toHaveBeenCalledTimes(1);
            });
        });
    });
});
