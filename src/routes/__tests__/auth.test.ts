import request from 'supertest';
import app from '../../app';
import axios from 'axios';
import User from '../../models/core/User';
import jwt from 'jsonwebtoken';

jest.mock('axios');
jest.mock('../../models/core/User');
jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(() => ({ userId: '123' }))
}));

describe('Auth Routes', () => {
  const mockUser = {
    _id: 'userId123',
    name: 'John Doe',
    email: 'john@example.com',
    picture: 'https://photo=s96-c',
    generateAccessToken: () => 'access-token',
    registerDeviceAndGenerateRefreshToken: () => 'refresh-token',
    extendRefreshToken: () => 'new-refresh-token',
    revokeRefreshToken: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /login/google', () => {
    it('should login or register with Google and return tokens', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          sub: 'providerId123',
          name: 'John Doe',
          email: 'john@example.com',
          picture: 'https://photo=s96-c'
        }
      });

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app).post('/auth/login/google').send({ idToken: 'valid', deviceId: 'device1' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'access-token');
      expect(res.body).toHaveProperty('refreshToken', 'refresh-token');
    });

    it('should return 400 if missing parameters', async () => {
      const res = await request(app).post('/auth/login/google').send({});
      expect(res.status).toBe(400);
    });

    it('should return 401 if Google token invalid', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('invalid'));
      const res = await request(app).post('/auth/login/google').send({ idToken: 'bad', deviceId: 'device1' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /login/facebook', () => {
    it('should login or register with Facebook and return tokens', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          id: 'providerId456',
          name: 'Jane Doe',
          email: 'jane@example.com',
          picture: { data: { url: 'https://facebook.com/photo' } }
        }
      });

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app).post('/auth/login/facebook').send({ accessToken: 'valid', deviceId: 'device2' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 401 if Facebook token invalid', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('invalid'));
      const res = await request(app).post('/auth/login/facebook').send({ accessToken: 'bad', deviceId: 'device1' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'userId123' });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app).post('/auth/auth/refresh').send({ refreshToken: 'valid', deviceId: 'device1' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ accessToken: 'access-token', refreshToken: 'new-refresh-token' });
    });

    it('should return 401 if token is invalid', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error();
      });
      const res = await request(app).post('/auth/auth/refresh').send({ refreshToken: 'bad', deviceId: 'device1' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user and revoke token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'userId123' });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      const token = 'Bearer mocked-access-token';

      const res = await request(app)
        .post('/auth/auth/logout')
        .set('Authorization', token)
        .send({ deviceId: 'device1' });

      expect(res.status).toBe(200);
      expect(mockUser.revokeRefreshToken).toHaveBeenCalledWith('device1');
    });
  });
});