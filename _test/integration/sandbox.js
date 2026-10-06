const Snap = require("../../_modules/snap");

const REQUIRED_ENV = [
    'DOKU_CLIENT_ID',
    'DOKU_SECRET_KEY',
    'DOKU_PRIVATE_KEY',
    'DOKU_PARTNER_SERVICE_ID',
    'DOKU_CUSTOMER_NO',
];

// GitHub secrets and .env files usually carry a PEM key on one line with literal \n
const pem = (value) => value && value.replace(/\\n/g, '\n');

function loadSandboxEnv() {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    if (missing.length) {
        throw new Error(`Integration tests need these env vars: ${missing.join(', ')}`);
    }

    return {
        clientId: process.env.DOKU_CLIENT_ID,
        secretKey: process.env.DOKU_SECRET_KEY,
        privateKey: pem(process.env.DOKU_PRIVATE_KEY),
        publicKey: pem(process.env.DOKU_PUBLIC_KEY),
        dokuPublicKey: pem(process.env.DOKU_PUBLIC_KEY_DOKU),
        issuer: process.env.DOKU_ISSUER,
        partnerServiceId: process.env.DOKU_PARTNER_SERVICE_ID,
        customerNoPrefix: process.env.DOKU_CUSTOMER_NO,
        vaChannel: process.env.DOKU_VA_CHANNEL || 'VIRTUAL_ACCOUNT_BANK_CIMB',
    };
}

function createSandboxSnap(env) {
    return new Snap({
        isProduction: false,
        privateKey: env.privateKey,
        clientID: env.clientId,
        publicKey: env.publicKey,
        dokuPublicKey: env.dokuPublicKey,
        issuer: env.issuer,
        secretKey: env.secretKey,
    });
}

// an axios error also carries the signed request headers, so surface only what DOKU answered
async function callDoku(request) {
    try {
        return await request();
    } catch (error) {
        if (error.response) {
            throw new Error(`DOKU answered ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}

// DOKU wants ISO-8601 with an explicit offset, and its own clock runs on WIB
function toWibIsoString(date) {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return wib.toISOString().replace(/\.\d{3}Z$/, '+07:00');
}

module.exports = { loadSandboxEnv, createSandboxSnap, callDoku, toWibIsoString };
