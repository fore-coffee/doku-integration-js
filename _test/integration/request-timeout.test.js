// Request timeout, end to end through the real Snap -> controller -> service -> httpClient -> axios.
// Needs NO DOKU access and NO secrets: a local server stands in for DOKU, so this runs in plain
// `npm test` as well as `npm run test:integration`. Config.CORE_SANDBOX_BASE_URL is pointed at it
// and always restored. Snap is built with isProduction: false and a throwaway RSA key.
//
// Timeout rules under test:
//   - SDK default Config.REQUEST_TIMEOUT_MS (3s) is the fallback for everything
//   - new Snap({ tokenTimeoutMs }) times the B2B token request
//   - createVa(dto, timeoutMs) / checkStatusVa(dto, timeoutMs) time their own DOKU request
//   - anything that is not a positive finite number falls back to the default
//   - a token refresh inside createVa/checkStatusVa uses tokenTimeoutMs, never the call's timeoutMs
const http = require("http");
const { generateKeyPairSync } = require("crypto");
const Snap = require("../../_modules/snap");
const Config = require("../../_commons/config");
const CreateVARequestDto = require("../../_models/createVaRequestDto");
const TotalAmount = require("../../_models/totalAmount");
const AdditionalInfo = require("../../_models/additionalInfo");
const CheckStatusVARequestDto = require("../../_models/checkStatusVARequestDTO");

jest.setTimeout(30000);

const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
});

const snapOptions = (over = {}) => ({
    isProduction: false,
    privateKey,
    clientID: "TIMEOUT-TEST",
    publicKey: "unused",
    dokuPublicKey: "unused",
    issuer: "unused",
    secretKey: "unused",
    ...over,
});

// "L3_" never matches the simulator's 111-115 trxId prefixes, and the VA number never matches 1113/1116.
const buildCreateVaDto = () => {
    const totalAmount = new TotalAmount();
    totalAmount.value = "10000.00";
    totalAmount.currency = "IDR";
    const additionalInfo = new AdditionalInfo();
    additionalInfo.channel = "VIRTUAL_ACCOUNT_BCA";
    const req = new CreateVARequestDto();
    req.partnerServiceId = "  123456";
    req.customerNo = "12345";
    req.virtualAccountNo = "  12345612345";
    req.virtualAccountName = "Timeout Test";
    req.virtualAccountEmail = "timeout@example.com";
    req.virtualAccountPhone = "6280000000000";
    req.trxId = `L3_${Date.now()}`;
    req.totalAmount = totalAmount;
    req.additionalInfo = additionalInfo;
    req.virtualAccountTrxType = "C";
    req.expiredDate = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 19) + "+07:00";
    delete req.freeText;
    return req;
};
const buildCheckStatusDto = () => {
    const dto = new CheckStatusVARequestDto();
    dto.partnerServiceId = "  123456";
    dto.customerNo = "12345";
    dto.virtualAccountNo = "  12345612345";
    dto.additionalInfo = { channel: "VIRTUAL_ACCOUNT_BCA" };
    return dto;
};

// Local stand-in for DOKU. Accepts every connection and never answers, except the B2B token
// endpoint when `answerToken` is set (a successful token, so the call after it can be timed).
const withServer = async ({ answerToken = false } = {}, fn) => {
    const server = http.createServer((req, res) => {
        if (answerToken && req.url.includes("/authorization/")) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
                responseCode: "2007300",
                responseMessage: "Successful",
                accessToken: "local-token",
                tokenType: "Bearer",
                expiresIn: 900,
            }));
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const original = Config.CORE_SANDBOX_BASE_URL;
    Config.CORE_SANDBOX_BASE_URL = `http://127.0.0.1:${server.address().port}`;
    try {
        return await fn();
    } finally {
        Config.CORE_SANDBOX_BASE_URL = original;
        server.closeAllConnections();
        server.close();
    }
};
const snapWithToken = (over) => {
    const s = new Snap(snapOptions(over));
    s.tokenB2B = "stub";
    s.tokenExpiresIn = 900;
    s.tokenGeneratedTimestamp = Date.now();
    return s;
};
// resolves { err, elapsed } instead of throwing, so each case asserts both
const timed = async (call) => {
    const startedAt = Date.now();
    const err = await call().then(
        () => null,
        (e) => e
    );
    return { err, elapsed: Date.now() - startedAt };
};
// createVa / checkStatusVa timeout: AxiosError, ECONNABORTED, no response (it did reach the server)
const expectAbortedAfter = ({ err, elapsed }, ms) => {
    expect(err).not.toBeNull();
    expect(err.code).toBe("ECONNABORTED");
    expect(err.response).toBeUndefined();
    expect(elapsed).toBeGreaterThanOrEqual(ms - 100);
    expect(elapsed).toBeLessThan(ms + 1500);
};
// getTokenB2B wraps errors that have no .response, so a token timeout is a plain Error
// ("Failed to get token: timeout of Nms exceeded"), not an AxiosError with a code.
const expectTokenTimeout = ({ err, elapsed }, ms) => {
    expect(err).not.toBeNull();
    expect(err.message).toBe(`Failed to get token: timeout of ${ms}ms exceeded`);
    expect(elapsed).toBeGreaterThanOrEqual(ms - 100);
    expect(elapsed).toBeLessThan(ms + 1500);
};

describe("createVa / checkStatusVa timeoutMs (valid token held)", () => {
    test("default is 3s", () => {
        expect(Config.REQUEST_TIMEOUT_MS).toBe(3000);
    });

    test("checkStatusVa without timeoutMs: aborts after the SDK default", () =>
        withServer({}, async () => {
            const s = snapWithToken();
            expectAbortedAfter(await timed(() => s.checkStatusVa(buildCheckStatusDto())), Config.REQUEST_TIMEOUT_MS);
        }));

    test("createVa without timeoutMs: aborts after the SDK default", () =>
        withServer({}, async () => {
            const s = snapWithToken();
            expectAbortedAfter(await timed(() => s.createVa(buildCreateVaDto())), Config.REQUEST_TIMEOUT_MS);
        }));

    test("checkStatusVa with timeoutMs: aborts after the given value, not the default", () =>
        withServer({}, async () => {
            const s = snapWithToken();
            expectAbortedAfter(await timed(() => s.checkStatusVa(buildCheckStatusDto(), 1000)), 1000);
        }));

    test("createVa with timeoutMs: aborts after the given value, not the default", () =>
        withServer({}, async () => {
            const s = snapWithToken();
            expectAbortedAfter(await timed(() => s.createVa(buildCreateVaDto(), 1000)), 1000);
        }));

    test("createVa and checkStatusVa in parallel take their own values", () =>
        withServer({}, async () => {
            const s = snapWithToken();
            const [create, status] = await Promise.all([
                timed(() => s.createVa(buildCreateVaDto(), 1000)),
                timed(() => s.checkStatusVa(buildCheckStatusDto(), 2000)),
            ]);
            expectAbortedAfter(create, 1000);
            expectAbortedAfter(status, 2000);
        }));

    // axios rejects Infinity (ERR_BAD_OPTION_VALUE); the guard maps it to the default instead. The full
    // list of invalid values (undefined, null, NaN, 0, 0.5, negative, string, too large) is unit-tested on httpClient.
    test("invalid timeoutMs (Infinity): uses the SDK default, never no timeout", () =>
        withServer({}, async () => {
            const s = snapWithToken();
            expectAbortedAfter(await timed(() => s.checkStatusVa(buildCheckStatusDto(), Infinity)), Config.REQUEST_TIMEOUT_MS);
        }));

    test("a timeout leaves the Snap token state untouched, and the next call works the same", () =>
        withServer({}, async () => {
            const s = snapWithToken();
            const stamp = s.tokenGeneratedTimestamp;
            expectAbortedAfter(await timed(() => s.checkStatusVa(buildCheckStatusDto(), 1000)), 1000);
            expect(s.tokenB2B).toBe("stub");
            expect(s.tokenGeneratedTimestamp).toBe(stamp);
            expectAbortedAfter(await timed(() => s.checkStatusVa(buildCheckStatusDto(), 1000)), 1000);
        }));
});

describe("tokenTimeoutMs (B2B token request)", () => {
    test("getTokenB2B uses the constructor's tokenTimeoutMs", () =>
        withServer({}, async () => {
            const s = new Snap(snapOptions({ tokenTimeoutMs: 1000 }));
            expectTokenTimeout(await timed(() => s.getTokenB2B()), 1000);
        }));

    test("tokenTimeoutMs not set: token request uses the SDK default", () =>
        withServer({}, async () => {
            const s = new Snap(snapOptions());
            expectTokenTimeout(await timed(() => s.getTokenB2B()), Config.REQUEST_TIMEOUT_MS);
        }));

    test("token refresh inside checkStatusVa uses tokenTimeoutMs, not the call's timeoutMs", () =>
        withServer({}, async () => {
            const s = new Snap(snapOptions({ tokenTimeoutMs: 1000 })); // no token yet: refresh first
            expectTokenTimeout(await timed(() => s.checkStatusVa(buildCheckStatusDto(), 2500)), 1000);
        }));

    test("token refresh inside createVa uses tokenTimeoutMs, not the call's timeoutMs", () =>
        withServer({}, async () => {
            const s = new Snap(snapOptions({ tokenTimeoutMs: 1000 }));
            expectTokenTimeout(await timed(() => s.createVa(buildCreateVaDto(), 2500)), 1000);
        }));

    test("a token timeout sets no token on the Snap", () =>
        withServer({}, async () => {
            const s = new Snap(snapOptions({ tokenTimeoutMs: 1000 }));
            expectTokenTimeout(await timed(() => s.checkStatusVa(buildCheckStatusDto())), 1000);
            expect(s.tokenB2B).toBe("");
            expect(s.tokenGeneratedTimestamp).toBe("");
        }));

    // The token refresh succeeds (local token endpoint answers), then the VA request hangs:
    // that request must use the call's timeoutMs, not tokenTimeoutMs.
    test("after a successful refresh, the call's own timeoutMs applies to the VA request", () =>
        withServer({ answerToken: true }, async () => {
            const s = new Snap(snapOptions({ tokenTimeoutMs: 1000 }));
            expectAbortedAfter(await timed(() => s.checkStatusVa(buildCheckStatusDto(), 2000)), 2000);
            expect(s.tokenB2B).toBe("local-token"); // the refresh did happen
        }));
});
