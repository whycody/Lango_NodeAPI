import request from 'supertest';

import app from '../../app';
import BundleCategory from '../../models/core/BundleCategory';
import BundleTheme from '../../models/core/BundleTheme';
import User from '../../models/core/User';

jest.mock('../../models/core/BundleCategory');
jest.mock('../../models/core/BundleTheme');
jest.mock('../../models/core/User');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '507f1f77bcf86cd799439011' })),
}));

const auth = 'Bearer mocked-access-token';

const mockSelectLean = (result: unknown) => ({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }),
});

const mockLean = (result: unknown) => ({ lean: jest.fn().mockResolvedValue(result) });

describe('BundleThemes Routes', () => {
    beforeEach(() => {
        (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: true }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /bundle-themes/coverage', () => {
        it('returns 401 when authorization token is missing', async () => {
            const res = await request(app).get('/bundle-themes/coverage');
            expect(res.status).toBe(401);
        });

        it('returns 403 when the user is not an admin', async () => {
            (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: false }));

            const res = await request(app)
                .get('/bundle-themes/coverage')
                .set('Authorization', auth);

            expect(res.status).toBe(403);
        });

        it('returns 400 when level filter is invalid', async () => {
            const res = await request(app)
                .get('/bundle-themes/coverage')
                .query({ level: 'Z9' })
                .set('Authorization', auth);

            expect(res.status).toBe(400);
        });

        it('returns category coverage counts and existing theme titles', async () => {
            (BundleCategory.find as jest.Mock).mockReturnValue(
                mockLean([{ label: 'Food', slug: 'food' }]),
            );
            (BundleTheme.find as jest.Mock).mockReturnValue(
                mockLean([
                    { category: 'food', level: 'A2', status: 'active', title: 'Restaurant food' },
                    { category: 'food', level: 'A2', status: 'archived', title: 'Old theme' },
                ]),
            );

            const res = await request(app)
                .get('/bundle-themes/coverage')
                .set('Authorization', auth);

            expect(res.status).toBe(200);
            expect(res.body.categories).toEqual([
                {
                    label: 'Food',
                    levels: { A1: 0, A2: 1, B1: 0, B2: 0, C1: 0, C2: 0 },
                    slug: 'food',
                },
            ]);
            expect(res.body.existingThemes).toEqual([
                { category: 'food', level: 'A2', status: 'active', title: 'Restaurant food' },
                { category: 'food', level: 'A2', status: 'archived', title: 'Old theme' },
            ]);
        });

        it('filters by category and level query params', async () => {
            const categoryFindMock = jest.fn().mockReturnValue(mockLean([]));
            const themeFindMock = jest.fn().mockReturnValue(mockLean([]));
            (BundleCategory.find as jest.Mock) = categoryFindMock;
            (BundleTheme.find as jest.Mock) = themeFindMock;

            await request(app)
                .get('/bundle-themes/coverage')
                .query({ category: 'food', level: 'A2' })
                .set('Authorization', auth);

            expect(categoryFindMock).toHaveBeenCalledWith({ slug: 'food' });
            expect(themeFindMock).toHaveBeenCalledWith({ category: 'food', level: 'A2' });
        });
    });

    describe('POST /bundle-themes', () => {
        const validBody = {
            category: 'food',
            description: 'Kitchen items',
            level: 'A1',
            title: 'Kitchen items',
        };

        it('returns 400 when level is invalid', async () => {
            const res = await request(app)
                .post('/bundle-themes')
                .set('Authorization', auth)
                .send({ ...validBody, level: 'Z9' });

            expect(res.status).toBe(400);
        });

        it('returns 400 when the category does not exist', async () => {
            (BundleCategory.exists as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/bundle-themes')
                .set('Authorization', auth)
                .send(validBody);

            expect(res.status).toBe(400);
            expect(BundleCategory.exists).toHaveBeenCalledWith({ slug: 'food' });
            expect(BundleTheme.create).not.toHaveBeenCalled();
        });

        it('creates a theme with status active by default', async () => {
            (BundleCategory.exists as jest.Mock).mockResolvedValue({ _id: 'category1' });
            (BundleTheme.create as jest.Mock).mockResolvedValue({
                toObject: () => ({ _id: 'theme1', ...validBody, status: 'active' }),
            });

            const res = await request(app)
                .post('/bundle-themes')
                .set('Authorization', auth)
                .send(validBody);

            expect(res.status).toBe(201);
            expect(BundleTheme.create).toHaveBeenCalledWith(
                expect.objectContaining({ createdBy: 'claude', status: 'active' }),
            );
            expect(res.body.id).toBe('theme1');
        });
    });

    describe('PATCH /bundle-themes/:id', () => {
        it('returns 400 for an invalid status', async () => {
            const res = await request(app)
                .patch('/bundle-themes/theme1')
                .set('Authorization', auth)
                .send({ status: 'nope' });

            expect(res.status).toBe(400);
        });

        it('returns 404 when the theme does not exist', async () => {
            (BundleTheme.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .patch('/bundle-themes/theme1')
                .set('Authorization', auth)
                .send({ status: 'archived' });

            expect(res.status).toBe(404);
        });

        it('updates the theme status', async () => {
            (BundleTheme.findByIdAndUpdate as jest.Mock).mockResolvedValue({
                toObject: () => ({ _id: 'theme1', status: 'archived' }),
            });

            const res = await request(app)
                .patch('/bundle-themes/theme1')
                .set('Authorization', auth)
                .send({ status: 'archived' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ id: 'theme1', status: 'archived' });
        });
    });
});
