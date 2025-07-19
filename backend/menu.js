const { Menu } = require("electron")
const { loadPackage } = require("./packageManager")
const { dialog, BrowserWindow } = require("electron")

function createMainMenu(mainWindow) {
    const isDev = !require("electron").app.isPackaged

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
                        const package = await loadPackage(result.filePaths[0])

                        mainWindow.webContents.send(
                            "package:loaded",
                            package.items,
                        )
                    },
                },
            ],
        },
    ]

    // Only add Edit menu in development
    if (isDev) {
        template.push({
            label: "Dev",
            submenu: [
                {
                    label: "Toggle Developer Tools",
                    accelerator: "F12",
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow()
                        if (focusedWindow) {
                            focusedWindow.webContents.toggleDevTools()
                        }
                    },
                },
            ],
        })
    }

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    return menu
}

module.exports = { createMainMenu }
