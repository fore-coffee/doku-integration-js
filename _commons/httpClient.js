'use strict'

const { default: axios } = require('axios');
const Config = require('./config');

// Goes through the global axios, so the host app's defaults and interceptors still
// apply; the only change is a timeout instead of axios' default of 0 (wait forever).
module.exports = (requestConfig) => axios({ timeout: Config.REQUEST_TIMEOUT_MS, ...requestConfig });
