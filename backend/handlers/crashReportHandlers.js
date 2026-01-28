const { submitCrashReport } = require("../utils/crashReporter")
const { getCrashReportEndpoint } = require("../utils/crashReportConfig")

/**
 * Register crash report IPC handlers
 * @param {Electron.IpcMain} ipcMain
 * @param {Electron.BrowserWindow} mainWindow
 */
function register(ipcMain, mainWindow) {
    ipcMain.handle("submit-crash-report", async (event, { userDescription, errorDetails }) => {
        try {
            return await submitCrashReport({ userDescription, errorDetails })
        } catch (error) {
            console.error("Failed to submit crash report:", error)
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("get-crash-report-status", async () => {
        const endpoint = getCrashReportEndpoint()
        return { configured: !!endpoint }
    })

    ipcMain.handle("is-update-available", async () => {
        const updater = global.updaterInstance
        if (updater && updater.updateAvailableVersion) {
            return {
                updateAvailable: true,
                latestVersion: updater.updateAvailableVersion,
                currentVersion: require("../../package.json").version,
            }
        }
        return { updateAvailable: false }
    })
}

module.exports = { register }
