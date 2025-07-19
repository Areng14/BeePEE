const openEditors = new Map()
const { BrowserWindow } = require("electron")
const path = require("path")

function createItemEditor(item, mainWindow) {
    if (openEditors.has(item.id)) {
        openEditors.get(item.id).focus()
        return
    }

    const isDev = !require("electron").app.isPackaged

    const window = new BrowserWindow({
        width: 384,
        height: 512,
        parent: mainWindow,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        devTools: isDev,
    })

    openEditors.set(item.id, window)

    window.on("closed", () => {
        openEditors.delete(item.id)
    })

    if (isDev) {
        window.loadURL(`http://localhost:5173/editor`)
    } else {
        window.loadFile(path.join(__dirname, "../dist/index.html"))
    }

    window.webContents.once("did-finish-load", () => {
        setTimeout(() => {
            window.webContents.send("load-item", item)
        }, 100)
    })
}

module.exports = { createItemEditor }