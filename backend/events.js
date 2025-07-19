const { reg_loadPackagePopup } = require("./packageManager")
const { createItemEditor } = require("./itemEditor")
const { ipcMain } = require("electron")

function reg_events(win) {
    reg_loadPackagePopup()
    ipcMain.handle("open-item-editor", async (event, item) => {
        createItemEditor(item, win)
    })
}

module.exports = { reg_events }
