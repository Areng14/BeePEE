const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const { createMainMenu } = require("./menu.js")
const fs = require("fs")
const { reg_events } = require("./events.js")
const { WindowTitleManager } = require("./windowTitleManager.js")
const { setMainWindow, clearPackagesDirectory } = require("./packageManager.js")

const createWindow = () => {
    const isDev = !app.isPackaged

    const win = new BrowserWindow({
        title: "BeePEE",
        width: 1024,
        height: 512,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
        devTools: isDev,
    })

    // Initialize window title manager
    const titleManager = new WindowTitleManager(win)
    global.titleManager = titleManager

    // Set main window reference for progress updates
    setMainWindow(win)

    createMainMenu(win)

    if (isDev) {
        win.loadURL("http://localhost:5173")
    } else {
        win.loadFile(path.join(__dirname, "../dist/index.html"))
    }

    //register stuff
    reg_events(win)
}

ipcMain.handle("api:loadImage", async (event, filePath) => {
    try {
        const imageBuffer = fs.readFileSync(filePath)
        const base64 = imageBuffer.toString("base64")
        const ext = path.extname(filePath).toLowerCase()

        // Determine MIME type
        let mimeType = "image/png"
        if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg"
        if (ext === ".gif") mimeType = "image/gif"
        if (ext === ".svg") mimeType = "image/svg+xml"

        return `data:${mimeType};base64,${base64}`
    } catch (error) {
        console.error("Error loading image:", error)
        return null
    }
})

app.whenReady().then(createWindow)

// Clean up packages directory when app exits
app.on('before-quit', async () => {
    try {
        console.log("Cleaning up packages directory...")
        await clearPackagesDirectory()
        console.log("Packages directory cleaned up successfully")
    } catch (error) {
        console.error("Failed to clean up packages directory:", error.message)
    }
})
