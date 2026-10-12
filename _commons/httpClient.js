'use strict'

const { default: axios } = require('axios');
const Config = require('./config');

// Goes through the global axios, so the host app's interceptors and other defaults still
// apply, but the timeout is always set here, so it replaces any host axios.defaults.timeout.
// requestConfig.timeout is the caller's per-call timeoutMs: anything that isn't an integer from
// 1 to 2^31-1 ms (undefined, null, NaN, Infinity, 0, 0.5, negative, string, too large) falls back
// to the SDK default, so a bad value can never turn the timeout off (axios truncates 0.5 to 0 and
// Node clamps > 2^31-1 to 1ms).
module.exports = (requestConfig) => {
    const { timeout } = requestConfig;
    const valid = Number.isInteger(timeout) && timeout >= 1 && timeout <= 2147483647;
    return axios({ ...requestConfig, timeout: valid ? timeout : Config.REQUEST_TIMEOUT_MS });
};
