import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../app';
import { translateTextWithCache } from '../../services/translation/translateWithCache';

jest.mock('../../services/translation/translateWithCache');
jest.mock('jsonwebtoken', () => ({
    ...jest.requireActual('jsonwebtoken'),
    verify: jest.fn(() => ({ userId: '123' })),
}));

describe('Translations Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when authorization token is missing', async () => {
        const res = await request(app).post('/translations/translate').send({
            from: 'it',
            text: 'casa',
            to: 'pl',
        });

        expect(res.status).toBe(401);
    });

    it('returns 400 when text is invalid', async () => {
        const res = await request(app)
            .post('/translations/translate')
            .set('Authorization', 'Bearer mocked-access-token')
            .send({
                from: 'it',
                text: '',
                to: 'pl',
            });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'text must be a non-empty string' });
    });

    it('returns 400 when language codes are invalid', async () => {
        const res = await request(app)
            .post('/translations/translate')
            .set('Authorization', 'Bearer mocked-access-token')
            .send({
                from: 'de',
                text: 'casa',
                to: 'pl',
            });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'from and to must be valid language codes' });
    });

    it('returns translation payload from service', async () => {
        (translateTextWithCache as jest.Mock).mockResolvedValue({
            cacheHit: false,
            translation: 'dom',
        });

        const res = await request(app)
            .post('/translations/translate')
            .set('Authorization', 'Bearer mocked-access-token')
            .send({
                from: 'it',
                text: 'casa',
                to: 'pl',
            });

        expect(translateTextWithCache).toHaveBeenCalledWith('casa', 'it', 'pl');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            cacheHit: false,
            from: 'it',
            text: 'casa',
            to: 'pl',
            translation: 'dom',
        });
    });

    it('returns 500 when translation service throws', async () => {
        (translateTextWithCache as jest.Mock).mockRejectedValue(new Error('azure down'));

        const res = await request(app)
            .post('/translations/translate')
            .set('Authorization', 'Bearer mocked-access-token')
            .send({
                from: 'it',
                text: 'casa',
                to: 'pl',
            });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Translation failed' });
    });

    it('returns 401 when token is invalid', async () => {
        (jwt.verify as jest.Mock).mockImplementationOnce(() => {
            throw new Error('invalid token');
        });

        const res = await request(app)
            .post('/translations/translate')
            .set('Authorization', 'Bearer bad-token')
            .send({
                from: 'it',
                text: 'casa',
                to: 'pl',
            });

        expect(res.status).toBe(401);
    });
});
