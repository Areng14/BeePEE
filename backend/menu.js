const { Menu } = require("electron")
const { loadPackage } = require("./loadPackage")
const { dialog, BrowserWindow } = require("electron")

const template = [
    {
        label: "File",
        submenu: [
            {
                label: "Import Package",
                click: async () => {
                    const result = await dialog.showOpenDialog({
                        properties: ["openFile"],
                    })

                    if (result.canceled) return null

                    //Load the package
                    const items = await loadPackage(result.filePaths[0])

                    BrowserWindow.getFocusedWindow().webContents.send(
                        "package:loaded",
                        items,
                    )
                },
            },
        ],
    },
]

Menu.setApplicationMenu(Menu.buildFromTemplate(template))
