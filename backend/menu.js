const { Menu } = require("electron")
const { loadPackage, importPackage } = require("./packageManager")
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
                            filters: [
                                { name: "BEE Package", extensions: ["bee_pack", "zip"] }
                            ]
                        })

                        if (result.canceled) return null

                        try {
                            // First import (convert VDF to JSON)
                            await importPackage(result.filePaths[0])
                            // Then load the converted package
                            const package = await loadPackage(result.filePaths[0])
                            mainWindow.webContents.send(
                                "package:loaded",
                                package.items,
                            )
                        } catch (error) {
                            dialog.showErrorBox(
                                "Import Failed",
                                `Failed to import package: ${error.message}`
                            )
                        }
                    },
                },
                {
                    label: "Load Package",
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ["openFile"],
                            filters: [
                                { name: "BEE Package", extensions: ["bpee"] }
                            ]
                        })

                        if (result.canceled) return null

                        try {
                            // Just load (assumes already imported/converted to JSON)
                            const package = await loadPackage(result.filePaths[0])
                            mainWindow.webContents.send(
                                "package:loaded",
                                package.items,
                            )
                        } catch (error) {
                            dialog.showErrorBox(
                                "Load Failed",
                                `Failed to load package: ${error.message}`
                            )
                        }
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
