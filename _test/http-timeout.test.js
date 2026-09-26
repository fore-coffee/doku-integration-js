const http = require('http');
const Config = require('../_commons/config');
const httpClient = require('../_commons/httpClient');

describe('HTTP client timeout', () => {
    test('should default to 5 seconds', () => {
        expect(Config.REQUEST_TIMEOUT_MS).toBe(5000);
    });

    test('should abort the request when the origin does not respond in time', async () => {
        // accepts the connection, never answers
        const server = http.createServer(() => {});
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();

        const startedAt = Date.now();
        try {
            await expect(httpClient({ method: 'post', url: `http://127.0.0.1:${port}/`, data: {} }))
                .rejects.toMatchObject({ code: 'ECONNABORTED' });
            expect(Date.now() - startedAt).toBeGreaterThanOrEqual(Config.REQUEST_TIMEOUT_MS - 50);
        } finally {
            server.closeAllConnections();
            server.close();
        }
    }, Config.REQUEST_TIMEOUT_MS + 5000);
});

describe('Services use the shared HTTP client', () => {
    let mockHttpClient;
    let TokenService;
    let VaService;
    let DirectDebitService;

    beforeEach(() => {
        jest.resetModules();
        mockHttpClient = jest.fn().mockResolvedValue({ data: {} });
        jest.doMock('../_commons/httpClient', () => mockHttpClient);
        TokenService = require('../_services/tokenService');
        VaService = require('../_services/vaService');
        DirectDebitService = require('../_services/directDebitService');
    });

    afterEach(() => {
        jest.dontMock('../_commons/httpClient');
    });

    test('tokenService', async () => {
        await TokenService.createTokenB2B({ clientId: 'c', timestamp: 't', signature: 's', grantType: 'client_credentials' }, false);
        expect(mockHttpClient).toHaveBeenCalledTimes(1);
    });

    test('vaService', async () => {
        // the stub response is too thin for the response DTO; only the call matters here
        await VaService.createVa({}, {}, false).catch(() => {});
        expect(mockHttpClient).toHaveBeenCalledTimes(1);
    });

    test('directDebitService', async () => {
        await DirectDebitService.doAccountUnBindingProcess({}, {}, false);
        expect(mockHttpClient).toHaveBeenCalledTimes(1);
    });
});
