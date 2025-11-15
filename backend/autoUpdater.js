const { dialog } = require("electron")
const { logger } = require("./utils/logger")
const isDev = require("./utils/isDev")

// Lazy-load autoUpdater to avoid accessing app before it's ready
let _autoUpdater = null
function getAutoUpdater() {
    if (!_autoUpdater) {
        _autoUpdater = require("electron-updater").autoUpdater
    }
    return _autoUpdater
}

class AutoUpdater {
    constructor(mainWindow) {
        this.mainWindow = mainWindow
        this.updateCheckInterval = null
        this.autoUpdater = getAutoUpdater()

        // Configure auto-updater
        this.autoUpdater.logger = logger
        this.autoUpdater.autoDownload = false // Don't auto-download, ask user first
        this.autoUpdater.autoInstallOnAppQuit = true

        // Set up event listeners
        this.setupEventListeners()
    }

    setupEventListeners() {
        const updater = this.autoUpdater

        // Checking for updates
        updater.on("checking-for-update", () => {
            logger.info("Checking for updates...")
            this.sendStatusToWindow("checking-for-update")
        })

        // Update available
        updater.on("update-available", (info) => {
            logger.info("Update available:", info.version)
            this.sendStatusToWindow("update-available", {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseNotes: info.releaseNotes,
            })

            // Notify user
            this.notifyUpdateAvailable(info)
        })

        // Update not available
        updater.on("update-not-available", (info) => {
            logger.info("Update not available. Current version is the latest.")
            this.sendStatusToWindow("update-not-available", {
                version: info.version,
            })
        })

        // Update error
        updater.on("error", (err) => {
            logger.error("Error in auto-updater:", err)
            const errorInfo = this.parseUpdateError(err)
            this.sendStatusToWindow("update-error", errorInfo)
        })

        // Download progress
        updater.on("download-progress", (progressObj) => {
            const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`
            logger.info(message)
            this.sendStatusToWindow("download-progress", {
                percent: progressObj.percent,
                bytesPerSecond: progressObj.bytesPerSecond,
                transferred: progressObj.transferred,
                total: progressObj.total,
            })
        })

        // Update downloaded
        updater.on("update-downloaded", (info) => {
            logger.info("Update downloaded:", info.version)
            this.sendStatusToWindow("update-downloaded", {
                version: info.version,
            })

            // Notify user to restart
            this.notifyUpdateDownloaded(info)
        })
    }

    sendStatusToWindow(status, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("update-status", {
                status,
                data,
            })
        }
    }

    parseUpdateError(err) {
        const errorMessage = err.message || err.toString()
        let userMessage = "An unexpected error occurred while checking for updates."
        let troubleshooting = []
        let errorType = "unknown"

        // Network errors
        if (
            errorMessage.includes("ENOTFOUND") ||
            errorMessage.includes("ETIMEDOUT") ||
            errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("network")
        ) {
            errorType = "network"
            userMessage =
                "Unable to connect to the update server. Please check your internet connection."
            troubleshooting = [
                "Check your internet connection",
                "Try again in a few moments",
                "Check if a firewall is blocking the connection",
                "Verify your network settings",
            ]
        }
        // File system errors
        else if (
            errorMessage.includes("EACCES") ||
            errorMessage.includes("EPERM") ||
            errorMessage.includes("permission denied")
        ) {
            errorType = "permissions"
            userMessage =
                "Permission denied while trying to update. The app may need administrator privileges."
            troubleshooting = [
                "Try running the app as administrator",
                "Check if the app folder is write-protected",
                "Ensure antivirus isn't blocking the update",
                "Close the app and try updating again",
            ]
        }
        // Disk space errors
        else if (
            errorMessage.includes("ENOSPC") ||
            errorMessage.includes("no space")
        ) {
            errorType = "disk_space"
            userMessage =
                "Not enough disk space to download the update."
            troubleshooting = [
                "Free up some disk space",
                "Check available storage on your drive",
                "Remove unnecessary files or apps",
            ]
        }
        // Download/checksum errors
        else if (
            errorMessage.includes("sha512") ||
            errorMessage.includes("checksum") ||
            errorMessage.includes("corrupted")
        ) {
            errorType = "corrupted"
            userMessage =
                "The downloaded update file is corrupted or incomplete."
            troubleshooting = [
                "Try downloading the update again",
                "Check your internet connection stability",
                "Clear the update cache and retry",
                "Download the update manually from the website",
            ]
        }
        // Server/availability errors
        else if (
            errorMessage.includes("404") ||
            errorMessage.includes("not found")
        ) {
            errorType = "not_found"
            userMessage =
                "Update not found on the server. This might be temporary."
            troubleshooting = [
                "The update may have been removed or moved",
                "Try again later",
                "Check the app website for manual updates",
            ]
        }
        // Rate limiting
        else if (
            errorMessage.includes("429") ||
            errorMessage.includes("rate limit")
        ) {
            errorType = "rate_limit"
            userMessage =
                "Too many update requests. Please wait before trying again."
            troubleshooting = [
                "Wait a few minutes before checking again",
                "The server is limiting requests to prevent overload",
            ]
        }

        return {
            message: userMessage,
            technicalDetails: errorMessage,
            troubleshooting,
            errorType,
        }
    }

    async notifyUpdateAvailable(info) {
        const { response } = await dialog.showMessageBox(this.mainWindow, {
            type: "info",
            title: "Update Available",
            message: `A new version (${info.version}) is available!`,
            detail: `Current version: ${require("../package.json").version}\nNew version: ${info.version}\n\nWould you like to download it now?`,
            buttons: ["Download", "Later"],
            defaultId: 0,
            cancelId: 1,
        })

        if (response === 0) {
            // User clicked Download
            this.downloadUpdate()
        }
    }

    async notifyUpdateDownloaded(info) {
        const { response } = await dialog.showMessageBox(this.mainWindow, {
            type: "info",
            title: "Update Ready",
            message: `Version ${info.version} has been downloaded.`,
            detail: "The update will be installed when you restart the application. Would you like to restart now?",
            buttons: ["Restart Now", "Later"],
            defaultId: 0,
            cancelId: 1,
        })

        if (response === 0) {
            // User clicked Restart Now
            this.autoUpdater.quitAndInstall(false, true)
        }
    }

    async checkForUpdates(silent = false) {
        if (isDev) {
            logger.info("Auto-updater is disabled in development mode")
            if (!silent) {
                dialog.showMessageBox(this.mainWindow, {
                    type: "info",
                    title: "Updates Disabled",
                    message: "Auto-updates are disabled in development mode.",
                    buttons: ["OK"],
                })
            }
            return
        }

        try {
            await this.autoUpdater.checkForUpdates()
        } catch (error) {
            logger.error("Failed to check for updates:", error)
            if (!silent) {
                const errorInfo = this.parseUpdateError(error)
                const troubleshootingText = errorInfo.troubleshooting.length
                    ? `\n\nWhat to try:\n${errorInfo.troubleshooting.map((tip) => `• ${tip}`).join("\n")}`
                    : ""

                dialog.showMessageBox(this.mainWindow, {
                    type: "error",
                    title: "Update Check Failed",
                    message: errorInfo.message,
                    detail: `${troubleshootingText}\n\nTechnical details:\n${errorInfo.technicalDetails}`,
                    buttons: ["OK"],
                })
            }
        }
    }

    downloadUpdate() {
        logger.info("Starting update download...")
        this.sendStatusToWindow("download-started")
        this.autoUpdater.downloadUpdate()
    }

    quitAndInstall() {
        this.autoUpdater.quitAndInstall(false, true)
    }

    // Check for updates on app startup
    checkOnStartup() {
        if (isDev) {
            logger.info("Skipping update check in development mode")
            return
        }

        // Check for updates 5 seconds after startup
        setTimeout(() => {
            logger.info("Running startup update check...")
            this.checkForUpdates(true) // Silent check
        }, 5000)
    }

    // Set up periodic update checks (every 4 hours)
    startPeriodicChecks() {
        if (isDev) {
            logger.info("Periodic update checks disabled in development mode")
            return
        }

        const CHECK_INTERVAL = 4 * 60 * 60 * 1000 // 4 hours in milliseconds

        this.updateCheckInterval = setInterval(() => {
            logger.info("Running periodic update check...")
            this.checkForUpdates(true) // Silent check
        }, CHECK_INTERVAL)
    }

    // Stop periodic update checks
    stopPeriodicChecks() {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval)
            this.updateCheckInterval = null
        }
    }
}

module.exports = { AutoUpdater }
