function createItemEditor(item, mainWindow) {
    if (openEditors.has(item.id)) {
        openEditors.get(item.id).focus()
        return
    }

    const window = new BrowserWindow({
        width: 1200,
        height: 800,
        parent: mainWindow,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    })

    openEditors.set(item.id, window)

    window.on("closed", () => {
        openEditors.delete(item.id)
    })

    window.loadFile("editor.html")
    window.webContents.once("did-finish-load", () => {
        window.webContents.send("load-item", item)
    })
}

module.exports = { createItemEditor }
