const { app } = require("electron")
const path = require("path")
const fs = require("fs")
const { isDev } = require("./isDev.js")

/**
 * Gets the packages directory path.
 * In development: uses project root/packages
 * In production: uses app.getPath("userData")/packages (writable location)
 */
function getPackagesDir() {
    if (isDev) {
        return path.resolve(__dirname, "..", "..", "packages")
    } else {
        return path.join(app.getPath("userData"), "packages")
    }
}

/**
 * Ensures the packages directory exists and is writable.
 * Should be called at app startup.
 */
function ensurePackagesDir() {
    const packagesDir = getPackagesDir()
    
    if (!fs.existsSync(packagesDir)) {
        fs.mkdirSync(packagesDir, { recursive: true })
        return
    }
    
    const stat = fs.statSync(packagesDir)
    if (!stat.isDirectory()) {
        throw new Error(
            `Packages path exists but is not a directory: ${packagesDir}`,
        )
    }
}

module.exports = { getPackagesDir, ensurePackagesDir }

