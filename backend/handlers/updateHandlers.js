/**
 * Auto-updater and changelog handlers
 */

const { dialog, BrowserWindow, app } = require("electron")
const fs = require("fs")
const path = require("path")
const { createChangelogWindow } = require("../items/itemEditor")

function register(ipcMain, mainWindow) {
    // Check for updates manually (triggered by user)
    ipcMain.handle("check-for-updates", async () => {
        if (global.updaterInstance) {
            await global.updaterInstance.checkForUpdates(false)
            return { success: true }
        }
        return { success: false, error: "Updater not initialized" }
    })

    // Download update
    ipcMain.handle("download-update", async () => {
        if (global.updaterInstance) {
            global.updaterInstance.downloadUpdate()
            return { success: true }
        }
        return { success: false, error: "Updater not initialized" }
    })

    // Install update and restart
    ipcMain.handle("quit-and-install", async () => {
        if (global.updaterInstance) {
            global.updaterInstance.quitAndInstall()
            return { success: true }
        }
        return { success: false, error: "Updater not initialized" }
    })

    // Show native message box
    ipcMain.handle("show-message-box", async (event, options) => {
        try {
            const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), options)
            return { success: true, response: result.response, checkboxChecked: result.checkboxChecked }
        } catch (error) {
            console.error("Failed to show message box:", error)
            return { success: false, error: error.message }
        }
    })

    // Open changelog window
    ipcMain.handle("open-changelog-window", async () => {
        try {
            createChangelogWindow(mainWindow)
            return { success: true }
        } catch (error) {
            console.error("Failed to open changelog window:", error)
            throw error
        }
    })

    // Load changelog data
    ipcMain.handle("load-changelog", async () => {
        try {
            const changelogPath = path.join(app.getAppPath(), "changelog.json")
            if (!fs.existsSync(changelogPath)) {
                throw new Error("Changelog file not found")
            }
            const changelogData = JSON.parse(fs.readFileSync(changelogPath, "utf-8"))
            return changelogData
        } catch (error) {
            console.error("Failed to load changelog:", error)
            throw error
        }
    })
}

module.exports = { register }
