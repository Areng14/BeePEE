/**
 * Injects crash report endpoints before build
 * Run with: node scripts/inject-config.js
 *
 * Reads CRASH_REPORT_ENDPOINT and CRASH_REPORT_ENDPOINT_BETA from .env
 * (or environment) and writes them to a GITIGNORED generated file that
 * crashReportConfig.js reads at runtime. Tracked source is never touched,
 * so the real URLs can't be committed by accident.
 */

const fs = require("fs")
const path = require("path")

const GENERATED_FILE = path.join(
    __dirname,
    "..",
    "backend",
    "utils",
    "crashEndpoints.generated.json",
)
const ENV_FILE = path.join(__dirname, "..", ".env")

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
    // Environment variables take precedence over the .env file
    const endpoint =
        process.env.CRASH_REPORT_ENDPOINT || envVars.CRASH_REPORT_ENDPOINT
    const endpointBeta =
        process.env.CRASH_REPORT_ENDPOINT_BETA ||
        envVars.CRASH_REPORT_ENDPOINT_BETA

    if (!endpoint) {
        console.warn(
            "WARN: CRASH_REPORT_ENDPOINT not set - crash reporting will be disabled in this build",
        )
        console.warn("      Set it in .env file or as environment variable")
    }
    if (!endpointBeta) {
        console.warn(
            "WARN: CRASH_REPORT_ENDPOINT_BETA not set - beta builds will fall back to the stable endpoint",
        )
    }

    const out = {}
    if (endpoint) out.endpoint = endpoint
    if (endpointBeta) out.endpointBeta = endpointBeta

    fs.writeFileSync(GENERATED_FILE, JSON.stringify(out, null, 4), "utf-8")
    console.log(
        `OK: Wrote crash report endpoints to ${path.basename(GENERATED_FILE)} (gitignored)`,
    )
}

injectConfig()
