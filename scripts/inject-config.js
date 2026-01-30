/**
 * Injects environment variables into config files before build
 * Run with: node scripts/inject-config.js
 *
 * Reads CRASH_REPORT_ENDPOINT from .env file (or environment) and injects it into the config
 */

const fs = require("fs")
const path = require("path")

const CONFIG_FILE = path.join(__dirname, "..", "backend", "utils", "crashReportConfig.js")
const ENV_FILE = path.join(__dirname, "..", ".env")
const PLACEHOLDER = "__CRASH_REPORT_ENDPOINT__"

/**
 * Parse .env file and return key-value pairs
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
        // Silently fail
    }
    return env
}

function injectConfig() {
    // Try environment variable first, then .env file
    let endpoint = process.env.CRASH_REPORT_ENDPOINT

    if (!endpoint) {
        const envVars = parseEnvFile(ENV_FILE)
        endpoint = envVars.CRASH_REPORT_ENDPOINT
    }

    if (!endpoint) {
        console.warn("WARN: CRASH_REPORT_ENDPOINT not set - crash reporting will be disabled in this build")
        console.warn("      Set it in .env file or as environment variable")
        return
    }

    // Read the config file
    let content = fs.readFileSync(CONFIG_FILE, "utf-8")

    // Check if placeholder exists
    if (!content.includes(PLACEHOLDER)) {
        console.log("INFO: No placeholder found in crashReportConfig.js (may already be injected)")
        return
    }

    // Replace placeholder with actual endpoint
    content = content.replace(PLACEHOLDER, endpoint)

    // Write back
    fs.writeFileSync(CONFIG_FILE, content, "utf-8")
    console.log("OK: Injected CRASH_REPORT_ENDPOINT into crashReportConfig.js")
}

injectConfig()
