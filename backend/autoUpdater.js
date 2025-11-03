const { autoUpdater } = require("electron-updater")
const { dialog } = require("electron")
const { logger } = require("./utils/logger")
const isDev = require("./utils/isDev")

class AutoUpdater {
    constructor(mainWindow) {
        this.mainWindow = mainWindow
        this.updateCheckInterval = null

        // Configure auto-updater
        autoUpdater.logger = logger
        autoUpdater.autoDownload = false // Don't auto-download, ask user first
        autoUpdater.autoInstallOnAppQuit = true

        // Set up event listeners
        this.setupEventListeners()
    }

    setupEventListeners() {
        // Checking for updates
        autoUpdater.on("checking-for-update", () => {
            logger.info("Checking for updates...")
            this.sendStatusToWindow("checking-for-update")
        })

        // Update available
        autoUpdater.on("update-available", (info) => {
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
        autoUpdater.on("update-not-available", (info) => {
            logger.info("Update not available. Current version is the latest.")
            this.sendStatusToWindow("update-not-available", {
                version: info.version,
            })
        })

        // Update error
        autoUpdater.on("error", (err) => {
            logger.error("Error in auto-updater:", err)
            this.sendStatusToWindow("update-error", {
                message: err.message || err.toString(),
            })
        })

        // Download progress
        autoUpdater.on("download-progress", (progressObj) => {
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
        autoUpdater.on("update-downloaded", (info) => {
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
            autoUpdater.quitAndInstall(false, true)
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
            await autoUpdater.checkForUpdates()
        } catch (error) {
            logger.error("Failed to check for updates:", error)
            if (!silent) {
                dialog.showErrorBox(
                    "Update Check Failed",
                    `Failed to check for updates: ${error.message}`
                )
            }
        }
    }

    downloadUpdate() {
        logger.info("Starting update download...")
        this.sendStatusToWindow("download-started")
        autoUpdater.downloadUpdate()
    }

    quitAndInstall() {
        autoUpdater.quitAndInstall(false, true)
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
