const fs = require("fs")
const path = require("path")
const { app } = require("electron")

/**
 * Parse a .env file and return key-value pairs
 * @param {string} filePath - Path to the .env file
 * @returns {Object} Key-value pairs from the .env file
 */
function parseEnvFile(filePath) {
    const env = {}
    try {
        if (!fs.existsSync(filePath)) return env
        const content = fs.readFileSync(filePath, "utf-8")
        for (const line of content.split("\n")) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith("#")) continue
            const eqIndex = trimmed.indexOf("=")
            if (eqIndex === -1) continue
            const key = trimmed.slice(0, eqIndex).trim()
            const value = trimmed.slice(eqIndex + 1).trim()
            env[key] = value
        }
    } catch (err) {
        // Silently fail - .env is optional
    }
    return env
}

/**
 * Get the crash report endpoint URL from .env
 * @returns {string|null} The endpoint URL or null if not configured
 */
function getCrashReportEndpoint() {
    // In production: look next to the app resources
    // In dev: look in the project root
    const envPath = app.isPackaged
        ? path.join(process.resourcesPath, ".env")
        : path.join(__dirname, "..", "..", ".env")

    const env = parseEnvFile(envPath)
    return env.CRASH_REPORT_ENDPOINT || null
}

module.exports = { getCrashReportEndpoint }
