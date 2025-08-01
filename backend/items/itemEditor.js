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
        width: 1056,
        height: 1024,
        parent: mainWindow,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload.js"),
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

    window.setMenuBarVisibility(false)

    window.webContents.once("did-finish-load", () => {
        setTimeout(() => {
            window.webContents.send("load-item", item)
        }, 100)
    })
}

// Function to send item-updated event to the correct editor window
function sendItemUpdateToEditor(itemId, updatedItem) {
    const editorWindow = openEditors.get(itemId)
    if (editorWindow && !editorWindow.isDestroyed()) {
        console.log(`Sending item-updated to editor window for item: ${itemId}`)
        editorWindow.webContents.send("item-updated", updatedItem)
    } else {
        console.log(`No open editor window found for item: ${itemId}`)
    }
}

module.exports = { createItemEditor, sendItemUpdateToEditor, openEditors }
