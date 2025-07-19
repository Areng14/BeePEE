const { Menu } = require("electron")
const { loadPackage } = require("./packageManager")
const { dialog, BrowserWindow } = require("electron")

function createMainMenu(mainWindow) {
    const template = [
        {
            label: "File",
            submenu: [
                {
                    label: "Import Package",
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ["openFile"],
                        })

                        if (result.canceled) return null

                        //Load the package
                        const items = await loadPackage(result.filePaths[0])

                        mainWindow.webContents.send("package:loaded", items)
                    },
                },
            ],
        },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    return menu
}

module.exports = { createMainMenu }
