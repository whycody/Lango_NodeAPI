import request from 'supertest';

import app from '../../app';
import BundleCategory from '../../models/core/BundleCategory';
import User from '../../models/core/User';

jest.mock('../../models/core/BundleCategory');
jest.mock('../../models/core/User');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '507f1f77bcf86cd799439011' })),
}));

const auth = 'Bearer mocked-access-token';

const mockSelectLean = (result: unknown) => ({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }),
});

describe('BundleCategories Routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /bundle-categories', () => {
        it('returns 401 when authorization token is missing', async () => {
            const res = await request(app).post('/bundle-categories').send({ label: 'Food' });
            expect(res.status).toBe(401);
        });

        it('returns 403 when the user is not an admin', async () => {
            (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: false }));

            const res = await request(app)
                .post('/bundle-categories')
                .set('Authorization', auth)
                .send({ label: 'Food', slug: 'food' });

            expect(res.status).toBe(403);
        });

        it('returns 400 when slug is missing', async () => {
            (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: true }));

            const res = await request(app)
                .post('/bundle-categories')
                .set('Authorization', auth)
                .send({ label: 'Food' });

            expect(res.status).toBe(400);
        });

        it('returns 400 when label is missing', async () => {
            (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: true }));

            const res = await request(app)
                .post('/bundle-categories')
                .set('Authorization', auth)
                .send({ slug: 'food' });

            expect(res.status).toBe(400);
        });

        it('creates a new bundle category', async () => {
            (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: true }));
            (BundleCategory.create as jest.Mock).mockResolvedValue({
                toObject: () => ({ _id: 'cat1', label: 'Food', slug: 'food' }),
            });

            const res = await request(app)
                .post('/bundle-categories')
                .set('Authorization', auth)
                .send({ label: 'Food', slug: 'food' });

            expect(res.status).toBe(201);
            expect(res.body).toEqual({ id: 'cat1', label: 'Food', slug: 'food' });
        });

        it('returns 409 when the slug already exists', async () => {
            (User.findById as jest.Mock).mockReturnValue(mockSelectLean({ admin: true }));
            (BundleCategory.create as jest.Mock).mockRejectedValue({ code: 11000 });

            const res = await request(app)
                .post('/bundle-categories')
                .set('Authorization', auth)
                .send({ label: 'Food', slug: 'food' });

            expect(res.status).toBe(409);
        });
    });
});
