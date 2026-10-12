'use strict'

const { default: axios } = require('axios');
const Config = require('./config');

// Goes through the global axios, so the host app's defaults and interceptors still
// apply; the only change is a timeout instead of axios' default of 0 (wait forever).
// requestConfig.timeout is the caller's per-call timeoutMs: anything that isn't a positive
// finite number (undefined, null, NaN, 0, negative, string) falls back to the SDK default,
// so a bad value can never turn the timeout off.
module.exports = (requestConfig) => {
    const { timeout } = requestConfig;
    const valid = typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0;
    return axios({ ...requestConfig, timeout: valid ? timeout : Config.REQUEST_TIMEOUT_MS });
};
