const { loadSandboxEnv, createSandboxSnap, callDoku } = require('./sandbox');

describe('DOKU sandbox: B2B token', () => {
    test('issues an access token for the configured client', async () => {
        const snap = createSandboxSnap(loadSandboxEnv());

        const token = await callDoku(() => snap.getTokenB2B());

        expect(token.accessToken).toEqual(expect.any(String));
        expect(Number(token.expiresIn)).toBeGreaterThan(0);
        expect(snap.tokenB2B).toBe(token.accessToken);
    });
});
