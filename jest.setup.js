jest.mock('./src/services/clients/GPTClient', () => {
    return {
        GPTClient: jest.fn().mockImplementation(() => ({
            chat: jest.fn().mockResolvedValue({ data: 'mocked response' }),
        })),
    };
});

jest.mock('jose', () => ({
    createRemoteJWKSet: jest.fn(),
    jwtVerify: jest.fn(),
}));
