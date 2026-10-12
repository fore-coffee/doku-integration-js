const http = require('http');
const Config = require('../_commons/config');
const httpClient = require('../_commons/httpClient');

describe('HTTP client timeout', () => {
    test('should default to 3 seconds', () => {
        expect(Config.REQUEST_TIMEOUT_MS).toBe(3000);
    });

    test('should abort the request when the origin does not respond in time (explicit timeout)', async () => {
        // accepts the connection, never answers
        const server = http.createServer(() => {});
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();

        const startedAt = Date.now();
        try {
            await expect(httpClient({ method: 'post', url: `http://127.0.0.1:${port}/`, data: {}, timeout: 200 }))
                .rejects.toMatchObject({ code: 'ECONNABORTED' });
            const elapsed = Date.now() - startedAt;
            expect(elapsed).toBeGreaterThanOrEqual(150);
            expect(elapsed).toBeLessThan(1500);
        } finally {
            server.closeAllConnections();
            server.close();
        }
    });
});

describe('httpClient timeout resolution (per-call value vs SDK default)', () => {
    let mockAxios;
    let client;

    beforeEach(() => {
        jest.resetModules();
        mockAxios = jest.fn().mockResolvedValue({ data: {} });
        jest.doMock('axios', () => ({ default: mockAxios }));
        client = require('../_commons/httpClient');
    });

    afterEach(() => {
        jest.dontMock('axios');
    });

    test.each([
        ['undefined', undefined],
        ['null', null],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['0 (axios would mean no timeout)', 0],
        ['negative', -5],
        ['a numeric string', '5000'],
    ])('falls back to the SDK default for %s', async (_label, value) => {
        await client({ method: 'post', url: 'http://x', timeout: value });
        expect(mockAxios.mock.calls[0][0].timeout).toBe(Config.REQUEST_TIMEOUT_MS);
    });

    test('falls back to the SDK default when no timeout is given', async () => {
        await client({ method: 'post', url: 'http://x' });
        expect(mockAxios.mock.calls[0][0].timeout).toBe(Config.REQUEST_TIMEOUT_MS);
    });

    test('uses a valid per-call timeout', async () => {
        await client({ method: 'post', url: 'http://x', timeout: 1500 });
        expect(mockAxios.mock.calls[0][0].timeout).toBe(1500);
    });

    test('keeps the rest of the request config', async () => {
        await client({ method: 'post', url: 'http://x', headers: { 'X-A': '1' }, data: { a: 1 }, timeout: 1500 });
        expect(mockAxios.mock.calls[0][0]).toMatchObject({
            method: 'post', url: 'http://x', headers: { 'X-A': '1' }, data: { a: 1 },
        });
    });

    test('does not mutate the caller\'s request config', async () => {
        const cfg = { method: 'post', url: 'http://x', timeout: 0 };
        await client(cfg);
        expect(cfg).toEqual({ method: 'post', url: 'http://x', timeout: 0 });
    });
});

describe('Services use the shared HTTP client', () => {
    let mockHttpClient;
    let TokenService;
    let VaService;

    beforeEach(() => {
        jest.resetModules();
        mockHttpClient = jest.fn().mockResolvedValue({ data: {} });
        jest.doMock('../_commons/httpClient', () => mockHttpClient);
        TokenService = require('../_services/tokenService');
        VaService = require('../_services/vaService');
    });

    afterEach(() => {
        jest.dontMock('../_commons/httpClient');
    });

    test('tokenService', async () => {
        await TokenService.createTokenB2B({ clientId: 'c', timestamp: 't', signature: 's', grantType: 'client_credentials' }, false);
        expect(mockHttpClient).toHaveBeenCalledTimes(1);
        expect(mockHttpClient.mock.calls[0][0].timeout).toBeUndefined();
    });

    test('tokenService forwards the per-call timeoutMs', async () => {
        await TokenService.createTokenB2B({ clientId: 'c', timestamp: 't', signature: 's', grantType: 'client_credentials' }, false, 1234);
        expect(mockHttpClient.mock.calls[0][0].timeout).toBe(1234);
    });

    test('vaService.createVa', async () => {
        // the stub response is too thin for the response DTO; only the call matters here
        await VaService.createVa({}, {}, false).catch(() => {});
        expect(mockHttpClient).toHaveBeenCalledTimes(1);
        expect(mockHttpClient.mock.calls[0][0].timeout).toBeUndefined();
    });

    test('vaService.createVa forwards the per-call timeoutMs', async () => {
        await VaService.createVa({}, {}, false, 1234).catch(() => {});
        expect(mockHttpClient.mock.calls[0][0].timeout).toBe(1234);
    });

    test('vaService.doCheckStatusVa', async () => {
        await VaService.doCheckStatusVa({}, {}, false).catch(() => {});
        expect(mockHttpClient).toHaveBeenCalledTimes(1);
        expect(mockHttpClient.mock.calls[0][0].timeout).toBeUndefined();
    });

    test('vaService.doCheckStatusVa forwards the per-call timeoutMs', async () => {
        await VaService.doCheckStatusVa({}, {}, false, 1234).catch(() => {});
        expect(mockHttpClient.mock.calls[0][0].timeout).toBe(1234);
    });
});

// Snap -> controller -> service: a real value must reach the right layer, and the right value
// (call timeoutMs for the DOKU request, tokenTimeoutMs for the token request).
describe('Snap forwards the timeouts down the stack', () => {
    let tokenGetTokenB2B;
    let vaCreateVa;
    let vaDoCheckStatusVa;
    let Snap;
    const dto = () => ({
        validateVaRequestDto: jest.fn(),
        validateCheckStatusVaRequestDto: jest.fn(),
        validateSimulator: jest.fn(),
    });
    const newSnap = (extra = {}) => new Snap({ isProduction: false, privateKey: 'k', clientID: 'c', ...extra });

    beforeEach(() => {
        jest.resetModules();
        tokenGetTokenB2B = jest.fn().mockResolvedValue({ accessToken: 'fresh', expiresIn: 900 });
        vaCreateVa = jest.fn().mockResolvedValue({ ok: 'create' });
        vaDoCheckStatusVa = jest.fn().mockResolvedValue({ ok: 'status' });
        jest.doMock('../_controllers/tokenController', () => class {
            isTokenInvalid() { return true; }
            getTokenB2B(...args) { return tokenGetTokenB2B(...args); }
        });
        jest.doMock('../_controllers/vaController', () => class {
            createVa(...args) { return vaCreateVa(...args); }
            doCheckStatusVa(...args) { return vaDoCheckStatusVa(...args); }
        });
        Snap = require('../_modules/snap');
    });

    afterEach(() => {
        jest.dontMock('../_controllers/tokenController');
        jest.dontMock('../_controllers/vaController');
    });

    test('createVa: call timeoutMs goes to the VA request, tokenTimeoutMs to the token refresh', async () => {
        const snap = newSnap({ tokenTimeoutMs: 4000 });
        await snap.createVa(dto(), 1500);
        expect(tokenGetTokenB2B).toHaveBeenCalledWith('k', 'c', false, 4000);
        expect(vaCreateVa.mock.calls[0][6]).toBe(1500);
    });

    test('checkStatusVa: call timeoutMs goes to the VA request, tokenTimeoutMs to the token refresh', async () => {
        const snap = newSnap({ tokenTimeoutMs: 4000 });
        await snap.checkStatusVa(dto(), 1500);
        expect(tokenGetTokenB2B).toHaveBeenCalledWith('k', 'c', false, 4000);
        expect(vaDoCheckStatusVa.mock.calls[0][6]).toBe(1500);
    });

    test('no values given: both layers get undefined (the SDK default applies below)', async () => {
        const snap = newSnap();
        await snap.createVa(dto());
        await snap.checkStatusVa(dto());
        expect(tokenGetTokenB2B).toHaveBeenCalledWith('k', 'c', false, undefined);
        expect(vaCreateVa.mock.calls[0][6]).toBeUndefined();
        expect(vaDoCheckStatusVa.mock.calls[0][6]).toBeUndefined();
    });

    test('getTokenB2B() takes no per-call value: it uses tokenTimeoutMs', async () => {
        await newSnap({ tokenTimeoutMs: 4000 }).getTokenB2B(9999);
        expect(tokenGetTokenB2B).toHaveBeenCalledWith('k', 'c', false, 4000);
    });
});

describe('Controllers forward timeoutMs to the services', () => {
    let vaService;
    let tokenServiceMock;

    beforeEach(() => {
        jest.resetModules();
        const actualToken = jest.requireActual('../_services/tokenService');
        const actualVa = jest.requireActual('../_services/vaService');
        vaService = { ...actualVa, createVa: jest.fn().mockResolvedValue({}), doCheckStatusVa: jest.fn().mockResolvedValue({}) };
        tokenServiceMock = { ...actualToken, createTokenB2B: jest.fn().mockResolvedValue({}) };
        jest.doMock('../_services/vaService', () => vaService);
        jest.doMock('../_services/tokenService', () => tokenServiceMock);
    });

    afterEach(() => {
        jest.dontMock('../_services/vaService');
        jest.dontMock('../_services/tokenService');
    });

    test('VaController.createVa', async () => {
        const VaController = require('../_controllers/vaController');
        const req = { additionalInfo: { channel: 'VIRTUAL_ACCOUNT_BCA' } };
        await new VaController().createVa(req, 'k', 'c', 'tok', false, 'secret', 1234);
        expect(vaService.createVa.mock.calls[0][3]).toBe(1234);
    });

    test('VaController.doCheckStatusVa', async () => {
        const VaController = require('../_controllers/vaController');
        const req = { additionalInfo: { channel: 'VIRTUAL_ACCOUNT_BCA' } };
        await new VaController().doCheckStatusVa(req, 'k', 'c', 'tok', 'secret', false, 1234);
        expect(vaService.doCheckStatusVa.mock.calls[0][3]).toBe(1234);
    });

    test('TokenController.getTokenB2B', async () => {
        const privateKey = require('crypto').generateKeyPairSync('rsa', {
            modulusLength: 2048,
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
        }).privateKey;
        const TokenController = require('../_controllers/tokenController');
        await new TokenController().getTokenB2B(privateKey, 'c', false, 1234);
        expect(tokenServiceMock.createTokenB2B.mock.calls[0][2]).toBe(1234);
    });
});

// Scope rule (FORE-9550): only the 3 calls fore-services uses get the timeout; the rest stay on
// plain axios exactly as upstream.
describe('Out-of-scope calls stay on plain axios', () => {
    let mockHttpClient;
    let mockAxios;

    beforeEach(() => {
        jest.resetModules();
        mockHttpClient = jest.fn().mockResolvedValue({ data: {} });
        mockAxios = jest.fn().mockResolvedValue({ data: {} });
        jest.doMock('../_commons/httpClient', () => mockHttpClient);
        jest.doMock('axios', () => ({ default: mockAxios }));
    });

    afterEach(() => {
        jest.dontMock('../_commons/httpClient');
        jest.dontMock('axios');
    });

    test.each([
        ['tokenService.hitTokenB2b2cApi', (m) => require('../_services/tokenService').hitTokenB2b2cApi({}, 't', 's', 'c', false)],
        ['vaService.doUpdateVa', () => require('../_services/vaService').doUpdateVa({}, { toObject: () => ({}) }, false)],
        ['vaService.doDeletePaymentCode', () => require('../_services/vaService').doDeletePaymentCode({}, { toObject: () => ({}) }, false)],
        ['directDebitService.doAccountUnBindingProcess', () => require('../_services/directDebitService').doAccountUnBindingProcess({}, {}, false)],
    ])('%s calls axios directly, not httpClient', async (_name, call) => {
        await call().catch(() => {}); // the stub response is too thin for the response DTOs
        expect(mockHttpClient).not.toHaveBeenCalled();
        expect(mockAxios).toHaveBeenCalledTimes(1);
        expect(mockAxios.mock.calls[0][0].timeout).toBeUndefined();
    });
});
