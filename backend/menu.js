const { Menu } = require("electron")
const {
    loadPackage,
    importPackage,
    savePackageAsBpee,
    clearPackagesDirectory,
    closePackage,
} = require("./packageManager")
const { dialog, BrowserWindow } = require("electron")
const path = require("path")
const fs = require("fs")

// Track last saved .bpee path and current package dir in memory
let lastSavedBpeePath = null
let currentPackageDir = null // This should be set when a package is loaded/imported

// Helper to get the current package name for saving
function getCurrentPackageName() {
    if (currentPackageDir) {
        return path.basename(currentPackageDir)
    }
    return "package"
}

function createMainMenu(mainWindow) {
    const isDev = !require("electron").app.isPackaged

    const template = [
        {
            label: "File",
            submenu: [
                {
                    label: "New Package",
                    accelerator: "Ctrl+N",
                    enabled: false,
                    click: () => {},
                },
                {
                    label: "Load Package...",
                    accelerator: "Ctrl+O",
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ["openFile"],
                            filters: [
                                {
                                    name: "BeePEE Package",
                                    extensions: ["bpee"],
                                },
                            ],
                        })
                        if (result.canceled) return null
                        try {
                            // Ensure packages directory exists
                            const packagesDir = path.join(
                                __dirname,
                                "..",
                                "packages",
                            )
                            if (!fs.existsSync(packagesDir)) {
                                fs.mkdirSync(packagesDir, { recursive: true })
                            }

                            const pkg = await loadPackage(result.filePaths[0])
                            currentPackageDir = pkg.packageDir
                            mainWindow.webContents.send(
                                "package:loaded",
                                pkg.items,
                            )
                        } catch (error) {
                            dialog.showErrorBox(
                                "Open Failed",
                                `Failed to open package: ${error.message}`,
                            )
                        }
                    },
                },
                {
                    label: "Import Package...",
                    accelerator: "Ctrl+I",
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ["openFile"],
                            filters: [
                                {
                                    name: "BEEmod Package",
                                    extensions: ["bee_pack", "zip"],
                                },
                            ],
                        })
                        if (result.canceled) return null
                        try {
                            await importPackage(result.filePaths[0])
                            // Continue progress from import (70%) to load (80%)
                            mainWindow.webContents.send(
                                "package-loading-progress",
                                {
                                    progress: 80,
                                    message: "Loading imported package...",
                                },
                            )
                            const pkg = await loadPackage(
                                result.filePaths[0],
                                true,
                            ) // Skip progress reset since we're continuing from import
                            currentPackageDir = pkg.packageDir

                            // Send final completion message
                            mainWindow.webContents.send(
                                "package-loading-progress",
                                {
                                    progress: 100,
                                    message:
                                        "Package imported and loaded successfully!",
                                },
                            )

                            mainWindow.webContents.send(
                                "package:loaded",
                                pkg.items,
                            )
                        } catch (error) {
                            // Error is already sent to frontend via progress update
                            // No need for additional dialog since we show it in the loading popup
                        }
                    },
                },
                { type: "separator" },
                {
                    label: "Close Package",
                    accelerator: "Ctrl+W",
                    click: async () => {
                        try {
                            await closePackage()
                            currentPackageDir = null
                            lastSavedBpeePath = null
                            mainWindow.webContents.send("package:closed")
                        } catch (error) {
                            dialog.showErrorBox(
                                "Close Failed",
                                `Failed to close package: ${error.message}`,
                            )
                        }
                    },
                },
                { type: "separator" },
                {
                    label: "Save Package",
                    accelerator: "Ctrl+S",
                    click: async () => {
                        try {
                            if (!currentPackageDir)
                                throw new Error("No package loaded")
                            if (!lastSavedBpeePath) {
                                // Prompt for path if not previously saved
                                const { canceled, filePath } =
                                    await dialog.showSaveDialog(mainWindow, {
                                        title: "Save Package As",
                                        defaultPath:
                                            getCurrentPackageName() + ".bpee",
                                        filters: [
                                            {
                                                name: "BeePEE Package",
                                                extensions: ["bpee"],
                                            },
                                        ],
                                    })
                                if (canceled || !filePath) return
                                lastSavedBpeePath = filePath
                            }
                            await savePackageAsBpee(
                                currentPackageDir,
                                lastSavedBpeePath,
                            )
                            dialog.showMessageBox(mainWindow, {
                                message: `Package saved to: ${lastSavedBpeePath}`,
                                type: "info",
                            })
                        } catch (err) {
                            dialog.showErrorBox("Save Failed", err.message)
                        }
                    },
                },
                {
                    label: "Save Package As...",
                    accelerator: "Ctrl+Shift+S",
                    click: async () => {
                        try {
                            if (!currentPackageDir)
                                throw new Error("No package loaded")
                            const { canceled, filePath } =
                                await dialog.showSaveDialog(mainWindow, {
                                    title: "Save Package As",
                                    defaultPath:
                                        getCurrentPackageName() + ".bpee",
                                    filters: [
                                        {
                                            name: "BeePEE Package",
                                            extensions: ["bpee"],
                                        },
                                    ],
                                })
                            if (canceled || !filePath) return
                            await savePackageAsBpee(currentPackageDir, filePath)
                            lastSavedBpeePath = filePath
                            dialog.showMessageBox(mainWindow, {
                                message: `Package saved to: ${filePath}`,
                                type: "info",
                            })
                        } catch (err) {
                            dialog.showErrorBox("Save As Failed", err.message)
                        }
                    },
                },
                { type: "separator" },
                {
                    label: process.platform === "darwin" ? "Quit" : "Exit",
                    accelerator:
                        process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
                    role: "quit",
                },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo", accelerator: "Ctrl+Z" },
                { role: "redo", accelerator: "Ctrl+Y" },
                { type: "separator" },
                { role: "cut", accelerator: "Ctrl+X" },
                { role: "copy", accelerator: "Ctrl+C" },
                { role: "paste", accelerator: "Ctrl+V" },
                { role: "selectAll", accelerator: "Ctrl+A" },
            ],
        },
    ]

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
                { type: "separator" },
                {
                    label: "Clear Packages Directory",
                    click: async () => {
                        const { response } = await dialog.showMessageBox(
                            mainWindow,
                            {
                                type: "warning",
                                buttons: ["Cancel", "Clear"],
                                defaultId: 0,
                                cancelId: 0,
                                title: "Clear Packages Directory",
                                message:
                                    "Are you sure you want to clear all contents of the packages directory? This cannot be undone.",
                            },
                        )
                        if (response === 1) {
                            // User chose 'Clear'
                            try {
                                // Close any open packages first
                                await closePackage()
                                currentPackageDir = null
                                lastSavedBpeePath = null
                                mainWindow.webContents.send("package:closed")

                                // Then clear the directory
                                await clearPackagesDirectory()
                                dialog.showMessageBox(mainWindow, {
                                    message: "Packages directory cleared.",
                                    type: "info",
                                })
                            } catch (err) {
                                dialog.showErrorBox("Clear Failed", err.message)
                            }
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
