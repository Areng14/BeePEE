/**
 * Crash report endpoint configuration
 *
 * The placeholders below are replaced at build time by scripts/inject-config.js
 * Set CRASH_REPORT_ENDPOINT (stable) and CRASH_REPORT_ENDPOINT_BETA (beta)
 * environment variables (or .env entries) before running npm run build/publish
 */

const { isBeta } = require("./betaInfo")

// These placeholders get replaced at build time
// DO NOT commit actual endpoints here - use the inject script
const CRASH_REPORT_ENDPOINT = "__CRASH_REPORT_ENDPOINT__"
const CRASH_REPORT_ENDPOINT_BETA = "__CRASH_REPORT_ENDPOINT_BETA__"

// Un-injected placeholders (or empty strings) mean "not configured"
function resolveEndpoint(value) {
    if (!value || value.startsWith("__")) return null
    return value
}

/**
 * Get the crash report endpoint URL for this build's channel.
 * Beta builds use the beta endpoint, falling back to the stable one
 * if no beta endpoint was configured.
 * @returns {string|null} The endpoint URL or null if not configured
 */
function getCrashReportEndpoint() {
    if (isBeta()) {
        return (
            resolveEndpoint(CRASH_REPORT_ENDPOINT_BETA) ||
            resolveEndpoint(CRASH_REPORT_ENDPOINT)
        )
    }
    return resolveEndpoint(CRASH_REPORT_ENDPOINT)
}

module.exports = { getCrashReportEndpoint }
