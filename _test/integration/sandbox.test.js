// L8 integration suite: real Snap against the DOKU SANDBOX. No mocks of lib/axios/jwt.
// Run: npm run test:integration (loads .env). Skipped when DOKU_CLIENT_ID is unset.
// Tokens/secrets are never asserted by value: compare timestamps / booleans only.
const { spawnSync } = require("child_process");
const Snap = require("../../_modules/snap");
const CreateVARequestDto = require("../../_models/createVaRequestDto");
const TotalAmount = require("../../_models/totalAmount");
const AdditionalInfo = require("../../_models/additionalInfo");
const CheckStatusVARequestDto = require("../../_models/checkStatusVARequestDTO");

const env = process.env;
const pem = (v) => (v || "").replace(/\\n/g, "\n");
const run = env.DOKU_CLIENT_ID ? describe : describe.skip;

jest.setTimeout(30000);

run("DOKU sandbox integration", () => {
    // isProduction is hard-coded: this suite must never hit production.
    const snapOptions = (over = {}) => ({
        isProduction: false,
        privateKey: pem(env.DOKU_PRIVATE_KEY),
        clientID: env.DOKU_CLIENT_ID,
        publicKey: pem(env.DOKU_PUBLIC_KEY),
        dokuPublicKey: pem(env.DOKU_PUBLIC_KEY_DOKU),
        issuer: env.DOKU_ISSUER,
        secretKey: env.DOKU_SECRET_KEY,
        ...over,
    });
    const snap = new Snap(snapOptions());
    const psid = env.DOKU_PARTNER_SERVICE_ID || "";
    const partnerServiceId = psid.padStart(8, " ");
    const customerNo = env.DOKU_CUSTOMER_NO;
    const virtualAccountNo = `${partnerServiceId}${customerNo}`;
    const CHANNEL = "VIRTUAL_ACCOUNT_BCA";

    // compareSignatures console.errors on bad signatures; keep jest output clean.
    beforeAll(() => {
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterAll(() => jest.restoreAllMocks());

    // Same shape as fore-services DokuService.createVa. "L8_" prefix never matches the
    // simulator's 111-115 trxId prefixes.
    const buildCreateVaDto = (trxId) => {
        const totalAmount = new TotalAmount();
        totalAmount.value = "10000.00";
        totalAmount.currency = "IDR";
        const additionalInfo = new AdditionalInfo();
        additionalInfo.channel = CHANNEL;

        const req = new CreateVARequestDto();
        req.partnerServiceId = partnerServiceId;
        req.customerNo = customerNo;
        req.virtualAccountNo = virtualAccountNo;
        req.virtualAccountName = "L8 Integration";
        req.virtualAccountEmail = "l8-integration@example.com";
        req.virtualAccountPhone = "6280000000000";
        req.trxId = trxId;
        req.totalAmount = totalAmount;
        req.additionalInfo = additionalInfo;
        req.virtualAccountTrxType = "C";
        req.expiredDate = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 19) + "+07:00";
        delete req.freeText;
        return req;
    };
    // Same shape as fore-services DokuService.checkStatusVa.
    const buildCheckStatusDto = (fullCustomerNo) => {
        const dto = new CheckStatusVARequestDto();
        dto.partnerServiceId = partnerServiceId;
        dto.customerNo = fullCustomerNo;
        dto.virtualAccountNo = `${partnerServiceId}${fullCustomerNo}`;
        dto.additionalInfo = { channel: CHANNEL };
        return dto;
    };

    // VA is created lazily once, so no case depends on another having run first.
    // DOKU extends customerNo into a longer number on create, and checkStatus on the
    // unextended number gives 404 4042601, so derive the DTO from the returned VA
    // (as fore-services does with its stored VA).
    const trxId = `L8_${Date.now()}`;
    let vaPromise;
    const getVa = () => (vaPromise ??= snap.createVa(buildCreateVaDto(trxId)));
    const checkStatusDto = async () => {
        const res = await getVa();
        return buildCheckStatusDto(res.virtualAccountData.virtualAccountNo.trim().slice(psid.length));
    };

    // Fresh Snap with a valid token already fetched, for the L1 expiry cases.
    const snapWithToken = async () => {
        const s = new Snap(snapOptions());
        await s.getTokenB2B();
        return s;
    };
    // fore's request adapter: only get(headerName)
    const authRequest = (headers) => ({ get: (n) => headers[n.toLowerCase()] });

    describe("new Snap(...)", () => {
        // Jest's sandboxed `process` never receives the real unhandledRejection event, so
        // construct the Snap in a plain node child process and listen there for ~2s.
        // Options travel via the child's env (never argv/stdout), so no secret is printed.
        const childScript = `
            const Snap = require(${JSON.stringify(require.resolve("../../_modules/snap"))});
            let rejected = 0;
            process.on("unhandledRejection", () => rejected++);
            const s = new Snap(JSON.parse(process.env.L8_SNAP_OPTIONS));
            setTimeout(() => {
                process.stdout.write(JSON.stringify({
                    rejected,
                    tokenEmpty: s.tokenB2B === "" && s.tokenGeneratedTimestamp === "",
                }));
            }, 2000);`;
        const constructInChild = (options) => {
            const r = spawnSync(process.execPath, ["-e", childScript], {
                env: { ...env, L8_SNAP_OPTIONS: JSON.stringify(options) },
                encoding: "utf8",
            });
            expect(r.status).toBe(0);
            return JSON.parse(r.stdout);
        };

        test("valid credentials: no token fetch, no unhandled rejection", () => {
            expect(constructInChild(snapOptions())).toEqual({ rejected: 0, tokenEmpty: true });
        });
        test("bad credentials: no token fetch, no unhandled rejection", () => {
            const bad = { isProduction: false, privateKey: "x", clientID: "x" };
            expect(constructInChild(bad)).toEqual({ rejected: 0, tokenEmpty: true });
        });
    });

    describe("getTokenB2B()", () => {
        test("valid credentials: accessToken + expiresIn, state set", async () => {
            const s = new Snap(snapOptions());
            const res = await s.getTokenB2B();
            expect(!!res.accessToken).toBe(true);
            expect(res.expiresIn).toBe(900);
            expect(res.responseCode).toBe("2007300");
            expect(s.tokenB2B === res.accessToken).toBe(true);
            expect(s.tokenExpiresIn).toBe(res.expiresIn);
            expect(typeof s.tokenGeneratedTimestamp).toBe("number");
        });

        test("wrong clientID: rejects with AxiosError 401 4017300", async () => {
            const s = new Snap(snapOptions({ clientID: "L8-WRONG-CLIENT" }));
            const err = await s.getTokenB2B().then(
                () => null,
                (e) => e
            );
            expect(err).not.toBeNull();
            expect(err.name).toBe("AxiosError");
            expect(err.response.status).toBe(401);
            expect(err.response.data.responseCode).toBe("4017300");
            expect(err.response.data.responseMessage).toBe("Unauthorized. Unknown Client");
            expect(s.tokenGeneratedTimestamp).toBe("");
        });
    });

    describe("createVa(dto)", () => {
        test("success: 2002700 + VA number", async () => {
            const res = await getVa();
            expect(res.responseCode).toBe("2002700");
            expect(res.responseMessage).toBe("Successful");
            const vd = res.virtualAccountData;
            expect(vd.virtualAccountNo.trim()).toBeTruthy();
            expect(vd.virtualAccountNo.trim().startsWith(psid)).toBe(true);
            expect(vd.trxId).toBe(trxId);
        });

        test("duplicate trxId: rejects with AxiosError 404 4042718", async () => {
            await getVa();
            const err = await snap.createVa(buildCreateVaDto(trxId)).then(
                () => null,
                (e) => e
            );
            expect(err).not.toBeNull();
            expect(err.name).toBe("AxiosError");
            expect(err.response.status).toBe(404);
            expect(err.response.data.responseCode).toBe("4042718");
            expect(err.response.data.responseMessage).toBe("Inconsistent Request");
        });

        test("missing required field: fails locally (throws Error), no network", async () => {
            const dto = buildCreateVaDto(`L8_${Date.now()}_c`);
            delete dto.virtualAccountName;
            // Throws a plain Error from Joi before any HTTP call (not an AxiosError)
            await expect(snap.createVa(dto)).rejects.toThrow(
                'Validation failed: "virtualAccountName" is required'
            );
        });
    });

    describe("checkStatusVa(dto)", () => {
        test("VA from createVa: success, not paid", async () => {
            const res = await snap.checkStatusVa(await checkStatusDto());
            expect(res.responseCode).toBe("2002600");
            expect(res.responseMessage).toBe("Successful");
            expect(res.virtualAccountData.paymentFlagReason.english).toBe("Pending");
            // NOTE: paidAmount comes back double-nested (paidAmount.value = {value, currency});
            // fore-services' extractPaidAmountValue already handles that. Not asserted here.
        });

        test("non-existent VA: rejects with AxiosError 404 4042601", async () => {
            const err = await snap.checkStatusVa(buildCheckStatusDto("9999999999")).then(
                () => null,
                (e) => e
            );
            expect(err).not.toBeNull();
            expect(err.name).toBe("AxiosError");
            expect(err.response.status).toBe(404);
            expect(err.response.data.responseCode).toBe("4042601");
            expect(err.response.data.responseMessage).toBe("Transaction Not Found");
        });
    });

    describe("validateSignatureAndGenerateToken(request)", () => {
        // The VALID-signature path can't be tested here: it needs a request signed with
        // DOKU's private key, which we don't have.
        const expectInvalidSignature = (res) => {
            expect(res.body.responseCode).toBe("4017300");
            expect(res.body.responseMessage).toBe("Unauthorized.Invalid Signature");
            expect(res.body.accessToken).toBeNull();
        };

        test("invalid x-signature / x-timestamp: invalid-signature response", () => {
            const res = snap.validateSignatureAndGenerateToken(
                authRequest({ "x-timestamp": "2026-01-01T00:00:00+07:00", "x-signature": "AAAA" })
            );
            expectInvalidSignature(res);
        });

        test("missing headers: same invalid-signature response (no throw)", () => {
            expectInvalidSignature(snap.validateSignatureAndGenerateToken(authRequest({})));
        });
    });

    describe("validateTokenB2B(token)", () => {
        const ownToken = () => snap.generateTokenB2B(true).body.accessToken;

        test("own token, with and without Bearer prefix: claims", () => {
            const token = ownToken();
            for (const header of [token, `Bearer ${token}`]) {
                const claims = snap.validateTokenB2B(header);
                expect(!!claims).toBe(true);
                expect(claims.clientId).toBe(env.DOKU_CLIENT_ID);
            }
        });

        test("tampered token: false", () => {
            const [h, p, sig] = ownToken().split(".");
            // reversed signature always differs
            const tampered = [h, p, sig.split("").reverse().join("")].join(".");
            expect(snap.validateTokenB2B(`Bearer ${tampered}`)).toBe(false);
        });

        test("garbage string: false", () => {
            expect(snap.validateTokenB2B("Bearer not.a.jwt")).toBe(false);
            expect(snap.validateTokenB2B("garbage")).toBe(false);
        });

        // What fore-services actually sends when the header is missing: its webhook
        // controller defaults it with `?? ''` (virtual-account-doku-webhook.controller.ts).
        test("empty string (fore's missing-header value): false", () => {
            expect(snap.validateTokenB2B("")).toBe(false);
        });

        // BUG (not reachable from fore-services): undefined throws
        // "TypeError: Cannot read properties of undefined (reading 'startsWith')"
        // (tokenController.validateTokenB2B). fore defaults a missing header to '',
        // covered above. Kept as documentation, not a fix target.
        test.failing("undefined token (missing header): returns false", () => {
            expect(snap.validateTokenB2B(undefined)).toBe(false);
        });
    });

    describe("generateNotificationResponse(isTokenValid, payload)", () => {
        // Realistic DOKU BCA VA payment-notification body
        const payload = {
            partnerServiceId,
            customerNo,
            virtualAccountNo,
            virtualAccountName: "L8 Integration",
            virtualAccountEmail: "l8-integration@example.com",
            virtualAccountPhone: "6280000000000",
            trxId: "L8_notification",
            paymentRequestId: "L8-PAYREQ-1",
            channelCode: "6011",
            paidAmount: { value: "10000.00", currency: "IDR" },
            totalAmount: { value: "10000.00", currency: "IDR" },
            trxDateTime: "2026-10-06T13:00:00+07:00",
            referenceNo: "L8-REF-1",
            additionalInfo: { channel: CHANNEL, virtualAccountConfig: { reusableStatus: false } },
        };

        test("valid: success response echoing the payload fields", () => {
            const res = snap.generateNotificationResponse(true, payload);
            expect(res.responseCode).toBe(2002700); // number, not string (flagged, not fixed)
            expect(res.responseMessage).toBe("success");
            expect(res.partnerServiceId).toBe(payload.partnerServiceId);
            expect(res.customerNo).toBe(payload.customerNo);
            // virtualAccountNo: asserted by L4
            expect(res.virtualAccountName).toBe(payload.virtualAccountName);
            expect(res.paymentRequestId).toBe(payload.paymentRequestId);
            expect(res.additionalInfo).toEqual(payload.additionalInfo);
        });

        test("invalid (false): invalid-token response echoing the payload fields", () => {
            const res = snap.generateNotificationResponse(false, payload);
            expect(res.responseCode).toBe(4012701); // number, not string
            expect(res.responseMessage).toBe("invalid Token ( B2B)");
            expect(res.partnerServiceId).toBe(payload.partnerServiceId);
            expect(res.customerNo).toBe(payload.customerNo);
            // virtualAccountNo: asserted by L4
            expect(res.virtualAccountName).toBe(payload.virtualAccountName);
            expect(res.paymentRequestId).toBe(payload.paymentRequestId);
        });
    });

    // L1: token expiry. Refetch is detected via tokenGeneratedTimestamp, NOT tokenB2B
    // (DOKU may hand back the same token while it is still valid).
    describe("L1 token expiry", () => {
        test("fresh Snap, empty token: one fetch on checkStatusVa", async () => {
            const s = new Snap(snapOptions());
            expect(s.tokenGeneratedTimestamp).toBe("");
            const res = await s.checkStatusVa(await checkStatusDto());
            expect(res.responseCode).toBe("2002600");
            expect(typeof s.tokenGeneratedTimestamp).toBe("number");
            expect(!!s.tokenB2B).toBe(true);
        });

        test("two checkStatusVa back to back: second does not refetch", async () => {
            const s = new Snap(snapOptions());
            const dto = await checkStatusDto();
            await s.checkStatusVa(dto);
            const ts = s.tokenGeneratedTimestamp;
            await s.checkStatusVa(dto);
            expect(s.tokenGeneratedTimestamp).toBe(ts);
        });

        test("expired (now - 901s): refetch + success", async () => {
            const s = await snapWithToken();
            const stale = Date.now() - 901_000;
            s.tokenGeneratedTimestamp = stale;
            const res = await s.checkStatusVa(await checkStatusDto());
            expect(res.responseCode).toBe("2002600");
            expect(s.tokenGeneratedTimestamp > stale).toBe(true);
            expect(s.tokenGeneratedTimestamp > Date.now() - 60_000).toBe(true);
        });

        test("inside the 30s safety margin (now - 875s): refetch", async () => {
            const s = await snapWithToken();
            const stale = Date.now() - 875_000;
            s.tokenGeneratedTimestamp = stale;
            await s.checkStatusVa(await checkStatusDto());
            expect(s.tokenGeneratedTimestamp > stale).toBe(true);
        });

        test("outside the margin (now - 850s): no refetch", async () => {
            const s = await snapWithToken();
            const ts = Date.now() - 850_000;
            s.tokenGeneratedTimestamp = ts;
            const res = await s.checkStatusVa(await checkStatusDto());
            expect(res.responseCode).toBe("2002600");
            expect(s.tokenGeneratedTimestamp).toBe(ts);
        });

        // Records today's behaviour (not a fix target): a token that is "fresh" per the
        // timestamp but rejected by DOKU is NOT retried; the 401 surfaces to the caller.
        test("garbage token with a fresh timestamp: DOKU 401 4012601, no automatic retry", async () => {
            const s = new Snap(snapOptions());
            s.tokenB2B = "garbage";
            s.tokenGeneratedTimestamp = Date.now();
            const ts = s.tokenGeneratedTimestamp;
            const err = await s.checkStatusVa(await checkStatusDto()).then(
                () => null,
                (e) => e
            );
            expect(err).not.toBeNull();
            expect(err.response.status).toBe(401);
            expect(err.response.data.responseCode).toBe("4012601");
            expect(err.response.data.responseMessage).toBe("Access Token Invalid (B2B)");
            expect(s.tokenGeneratedTimestamp).toBe(ts); // no refetch
            expect(s.tokenB2B === "garbage").toBe(true);
        });
    });
});
