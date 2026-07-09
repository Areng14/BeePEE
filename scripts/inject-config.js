/**
 * Injects environment variables into config files before build
 * Run with: node scripts/inject-config.js
 *
 * Reads CRASH_REPORT_ENDPOINT and CRASH_REPORT_ENDPOINT_BETA from .env file
 * (or environment) and injects them into the config
 */

const fs = require("fs")
const path = require("path")

const CONFIG_FILE = path.join(__dirname, "..", "backend", "utils", "crashReportConfig.js")
const ENV_FILE = path.join(__dirname, "..", ".env")

// env var name -> placeholder in crashReportConfig.js
const INJECTIONS = {
    CRASH_REPORT_ENDPOINT: "__CRASH_REPORT_ENDPOINT__",
    CRASH_REPORT_ENDPOINT_BETA: "__CRASH_REPORT_ENDPOINT_BETA__",
}

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
    const envVars = parseEnvFile(ENV_FILE)
    let content = fs.readFileSync(CONFIG_FILE, "utf-8")
    let changed = false

    for (const [envName, placeholder] of Object.entries(INJECTIONS)) {
        // Environment variable takes precedence over .env file
        const value = process.env[envName] || envVars[envName]

        if (!value) {
            console.warn(`WARN: ${envName} not set - this endpoint will be disabled in this build`)
            console.warn("      Set it in .env file or as environment variable")
            continue
        }

        if (!content.includes(placeholder)) {
            console.log(`INFO: No ${placeholder} placeholder found in crashReportConfig.js (may already be injected)`)
            continue
        }

        content = content.replace(placeholder, value)
        changed = true
        console.log(`OK: Injected ${envName} into crashReportConfig.js`)
    }

    if (changed) {
        fs.writeFileSync(CONFIG_FILE, content, "utf-8")
    }
}

injectConfig()
