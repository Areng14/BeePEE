const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const { reg_loadPackagePopup } = require("./packageManager")
const { createMainMenu } = require("./menu.js")
const fs = require("fs")

const createWindow = () => {
    const win = new BrowserWindow({
        title: "BeePEE",
        width: 1024,
        height: 512,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    })

    createMainMenu(win)

    const isDev = !app.isPackaged

    if (isDev) {
        win.loadURL("http://localhost:5173")
        win.webContents.openDevTools()
    } else {
        win.loadFile(path.join(__dirname, "../dist/index.html"))
    }
}

//register stuff
reg_loadPackagePopup()

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
