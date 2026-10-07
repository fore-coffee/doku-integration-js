const Snap = require("../_modules/snap");
const TokenService = require("../_services/tokenService");
const TokenController = require("../_controllers/tokenController");
const VaController = require("../_controllers/vaController");

describe('Token expiry', () => {
    test('token generated 901s ago is expired', () => {
        expect(TokenService.isTokenExpired(900, Date.now() - 901 * 1000)).toBe(true);
    });
    test('token generated 10s ago is not expired', () => {
        expect(TokenService.isTokenExpired(900, Date.now() - 10 * 1000)).toBe(false);
    });

    test('createVa refetches B2B token exactly once after expiry', async () => {
        const snap = new Snap({ isProduction: false, privateKey: 'pk', clientID: 'cid', publicKey: 'pub', issuer: 'issuer', secretKey: 'sk' });
        snap.tokenB2B = 'oldToken';
        snap.tokenExpiresIn = 900;
        snap.tokenGeneratedTimestamp = Date.now() - 901 * 1000;
        const getToken = jest.spyOn(TokenController.prototype, 'getTokenB2B').mockResolvedValue({ accessToken: 'newToken', expiresIn: 900 });
        jest.spyOn(VaController.prototype, 'createVa').mockResolvedValue({ success: true });

        const dto = { validateVaRequestDto: jest.fn(), validateSimulator: jest.fn() };
        await snap.createVa(dto);
        await snap.createVa(dto);

        expect(getToken).toHaveBeenCalledTimes(1);
        jest.restoreAllMocks();
    });
});
