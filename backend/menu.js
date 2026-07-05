const { Menu, shell } = require("electron")
const {
    loadPackage,
    importPackage,
    savePackageAsBpee,
    exportPackageAsBeePack,
    clearPackagesDirectory,
    closePackage,
    getCurrentPackageDir,
} = require("./packageManager")
const { app, dialog, BrowserWindow } = require("electron")
const path = require("path")
const fs = require("fs")
const { exec } = require("child_process")

// Helper to kill BEE2.exe process if running
function killBeemod() {
    return new Promise((resolve) => {
        exec('taskkill /F /IM BEE2.exe', (err) => {
            // Ignore errors (process might not be running)
            if (err) {
                console.log("BEE2.exe not running or could not be killed:", err.message)
            } else {
                console.log("BEE2.exe process killed")
            }
            // Small delay to ensure file locks are released
            setTimeout(resolve, 500)
        })
    })
}
const {
    createPackageCreationWindow,
    createPackageInformationWindow,
    createChangelogWindow,
    createCrashReportWindow,
    createBeePackageWindow,
    createSettingsWindow,
    createImportItemsWindow,
} = require("./items/itemEditor")
const { isDev } = require("./utils/isDev.js")
const { ensurePackagesDir } = require("./utils/packagesDir")
const { logger } = require("./utils/logger")
const { getSetting } = require("./utils/settings")

// Track last saved .bpee path in memory
let lastSavedBpeePath = null

// Window the menu was built for (needed to rebuild when settings change)
let menuMainWindow = null

// Menu items that only make sense with a package loaded
const PACKAGE_MENU_IDS = [
    "close-package",
    "save-package",
    "save-package-as",
    "export-package",
    "package-information",
    "beepm-package-info",
    "import-items",
]

// Enable/disable package-dependent menu items based on whether a package is loaded
function updateMenuState() {
    const menu = Menu.getApplicationMenu()
    if (!menu) return
    const hasPackage = !!getCurrentPackageDir()
    for (const id of PACKAGE_MENU_IDS) {
        const item = menu.getMenuItemById(id)
        if (item) item.enabled = hasPackage
    }
}

// Rebuild the menu from scratch (e.g. when the devMode setting changes)
function rebuildMenu() {
    if (menuMainWindow && !menuMainWindow.isDestroyed()) {
        createMainMenu(menuMainWindow)
    }
}

// Helper to get the current package name for saving
function getCurrentPackageName() {
    const currentPackageDir = getCurrentPackageDir()
    if (currentPackageDir) {
        // Try to get the actual package name from info.json
        try {
            const infoPath = path.join(currentPackageDir, "info.json")
            if (fs.existsSync(infoPath)) {
                const packageInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"))
                if (packageInfo.Name) {
                    // Sanitize the name for use as filename
                    return packageInfo.Name.replace(/[^a-zA-Z0-9_ -]/g, "_")
                }
            }
        } catch (err) {
            // Fall back to folder name if info.json can't be read
        }
        return path.basename(currentPackageDir)
    }
    return "package"
}

function createMainMenu(mainWindow) {
    menuMainWindow = mainWindow
    const template = [
        {
            label: "File",
            submenu: [
                {
                    label: "New Package",
                    accelerator: "Ctrl+N",
                    click: async () => {
                        // Check if a package is currently loaded
                        const currentPackageDir = getCurrentPackageDir()
                        if (currentPackageDir) {
                            // Show confirmation dialog with save option
                            const { response } = await dialog.showMessageBox(
                                mainWindow,
                                {
                                    type: "warning",
                                    buttons: ["Discard", "Save", "Cancel"],
                                    defaultId: 2,
                                    cancelId: 0,
                                    title: "Save Changes?",
                                    message:
                                        "Do you want to save the current package before creating a new one?",
                                    detail: "Your changes will be lost if you don't save them.",
                                },
                            )

                            if (response === 3) {
                                // User chose 'Cancel'
                                return
                            }

                            if (response === 2) {
                                // User chose 'Save & Continue' - save first
                                try {
                                    if (!lastSavedBpeePath) {
                                        // Prompt for path if not previously saved
                                        const { canceled, filePath } =
                                            await dialog.showSaveDialog(
                                                mainWindow,
                                                {
                                                    title: "Save Package As",
                                                    defaultPath:
                                                        getCurrentPackageName() +
                                                        ".bpee",
                                                    filters: [
                                                        {
                                                            name: "BeePEE Package",
                                                            extensions: [
                                                                "bpee",
                                                            ],
                                                        },
                                                    ],
                                                },
                                            )
                                        if (canceled || !filePath) return
                                        lastSavedBpeePath = filePath
                                    }
                                    await savePackageAsBpee(
                                        currentPackageDir,
                                        lastSavedBpeePath,
                                    )
                                } catch (err) {
                                    dialog.showErrorBox(
                                        "Save Failed",
                                        err.message,
                                    )
                                    return
                                }
                            }

                            // Close current package (response === 1 "Don't Save" or response === 2 after saving)
                            try {
                                await closePackage()
                                lastSavedBpeePath = null
                                mainWindow.webContents.send("package:closed")
                            } catch (error) {
                                dialog.showErrorBox(
                                    "Close Failed",
                                    `Failed to close package: ${error.message}`,
                                )
                                return
                            }
                        }
                        // Open create package window
                        createPackageCreationWindow(mainWindow)
                    },
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
                            ensurePackagesDir()

                            const pkg = await loadPackage(result.filePaths[0])
                            // currentPackageDir is now managed in packageManager.js
                            mainWindow.webContents.send("package:loaded", {
                                items: pkg.items,
                                signages: pkg.signages,
                            })
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
                            // currentPackageDir is now managed in packageManager.js

                            // Send final completion message
                            mainWindow.webContents.send(
                                "package-loading-progress",
                                {
                                    progress: 100,
                                    message:
                                        "Package imported and loaded successfully!",
                                },
                            )

                            mainWindow.webContents.send("package:loaded", {
                                items: pkg.items,
                                signages: pkg.signages,
                            })
                        } catch (error) {
                            // Error is already sent to frontend via progress update
                            // No need for additional dialog since we show it in the loading popup
                        }
                    },
                },
                {
                    id: "import-items",
                    label: "Import from Package...",
                    click: () => createImportItemsWindow(mainWindow),
                },
                {
                    label: "Restore Backup...",
                    click: async () => {
                        // Pre-export snapshots live in userData/backups
                        // (newest 10 kept) — open the picker right there
                        const backupsDir = path.join(
                            app.getPath("userData"),
                            "backups",
                        )
                        try {
                            fs.mkdirSync(backupsDir, { recursive: true })
                        } catch {
                            /* picker still opens at its default location */
                        }
                        const result = await dialog.showOpenDialog(mainWindow, {
                            title: "Restore Package Backup",
                            defaultPath: backupsDir,
                            properties: ["openFile"],
                            filters: [
                                { name: "BeePEE Package", extensions: ["bpee"] },
                            ],
                        })
                        if (result.canceled || !result.filePaths.length) return
                        const backupPath = result.filePaths[0]

                        // Ask where the restored copy should live: working
                        // directly out of the backups folder would make the
                        // next Save overwrite the backup itself
                        const baseName = path
                            .basename(backupPath, ".bpee")
                            // strip the -<ISO timestamp> suffix backups carry
                            .replace(/-\d{4}-\d{2}-\d{2}T[\d-]+Z$/, "")
                        const saveTo = await dialog.showSaveDialog(mainWindow, {
                            title: "Save Restored Package As",
                            defaultPath: path.join(
                                app.getPath("documents"),
                                `${baseName} (restored).bpee`,
                            ),
                            filters: [
                                { name: "BeePEE Package", extensions: ["bpee"] },
                            ],
                        })
                        if (saveTo.canceled || !saveTo.filePath) return
                        try {
                            fs.copyFileSync(backupPath, saveTo.filePath)
                            ensurePackagesDir()
                            const pkg = await loadPackage(saveTo.filePath)
                            // Future saves target the restored copy
                            lastSavedBpeePath = saveTo.filePath
                            mainWindow.webContents.send("package:loaded", {
                                items: pkg.items,
                                signages: pkg.signages,
                            })
                        } catch (error) {
                            dialog.showErrorBox(
                                "Restore Failed",
                                `Failed to restore backup: ${error.message}`,
                            )
                        }
                    },
                },
                { type: "separator" },
                {
                    id: "close-package",
                    label: "Close Package",
                    accelerator: "Ctrl+W",
                    click: async () => {
                        try {
                            await closePackage()
                            // currentPackageDir is now managed in packageManager.js
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
                    id: "save-package",
                    label: "Save Package",
                    accelerator: "Ctrl+S",
                    click: async () => {
                        try {
                            const currentPackageDir = getCurrentPackageDir()
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
                    id: "save-package-as",
                    label: "Save Package As...",
                    accelerator: "Ctrl+Shift+S",
                    click: async () => {
                        try {
                            const currentPackageDir = getCurrentPackageDir()
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
                    id: "export-package",
                    label: "Export Package...",
                    accelerator: "Ctrl+E",
                    click: async () => {
                        try {
                            const currentPackageDir = getCurrentPackageDir()
                            if (!currentPackageDir)
                                throw new Error("No package loaded")

                            // When "Launch BEEMod after export" is on, the export
                            // is sent straight to the BEEMod packages folder (no
                            // save dialog) and BEE2 is launched afterwards.
                            const launchBeemod = getSetting("launchBeemodAfterExport", false)
                            const beemodPath = getSetting("beemodPath", null)
                            const exportToBeemod = launchBeemod && !!beemodPath

                            if (launchBeemod && !beemodPath) {
                                console.warn(
                                    "Launch BEEMod after export is on, but no BEEMod path is set — falling back to a save dialog.",
                                )
                            }

                            let filePath

                            if (exportToBeemod) {
                                // Read BEEMod config to find packages directory
                                let packagesDir = path.join(beemodPath, "packages") // default

                                try {
                                    const configPath = path.join(
                                        process.env.APPDATA || "",
                                        "BEEMOD2",
                                        "config",
                                        "config.cfg"
                                    )
                                    if (fs.existsSync(configPath)) {
                                        const configContent = fs.readFileSync(configPath, "utf-8")
                                        const packageMatch = configContent.match(/^package=(.+)$/m)
                                        if (packageMatch) {
                                            const packageSetting = packageMatch[1].trim()
                                            // Check if it's absolute or relative
                                            if (path.isAbsolute(packageSetting)) {
                                                packagesDir = packageSetting
                                            } else {
                                                // Relative to BEEMod folder
                                                packagesDir = path.join(beemodPath, packageSetting)
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.warn("Could not read BEEMod config, using default packages path:", err.message)
                                }

                                // Export to packages/BeePEE subfolder
                                const beemodPackagesDir = path.join(packagesDir, "BeePEE")
                                if (!fs.existsSync(beemodPackagesDir)) {
                                    fs.mkdirSync(beemodPackagesDir, { recursive: true })
                                }
                                filePath = path.join(beemodPackagesDir, getCurrentPackageName() + ".bee_pack")

                                // Kill BEE2.exe if running to release file locks
                                await killBeemod()
                            } else {
                                // Show save dialog (preferred format from settings)
                                const exportFormat = getSetting("exportFormat", "bee_pack")
                                const formatFilters = [
                                    {
                                        name: "BEEmod Package",
                                        extensions: ["bee_pack"],
                                    },
                                    {
                                        name: "Zip Archive",
                                        extensions: ["zip"],
                                    },
                                ]
                                if (exportFormat === "zip") formatFilters.reverse()

                                const result = await dialog.showSaveDialog(mainWindow, {
                                    title: "Export Package",
                                    defaultPath:
                                        getCurrentPackageName() +
                                        (exportFormat === "zip" ? ".zip" : ".bee_pack"),
                                    filters: formatFilters,
                                })
                                if (result.canceled || !result.filePath) return
                                filePath = result.filePath
                            }

                            // Auto-backup the package as .bpee before exporting
                            if (getSetting("autoBackupBeforeExport", true)) {
                                try {
                                    const backupsDir = path.join(
                                        app.getPath("userData"),
                                        "backups",
                                    )
                                    fs.mkdirSync(backupsDir, { recursive: true })
                                    const stamp = new Date()
                                        .toISOString()
                                        .replace(/[:.]/g, "-")
                                    const backupPath = path.join(
                                        backupsDir,
                                        `${getCurrentPackageName()}-${stamp}.bpee`,
                                    )
                                    await savePackageAsBpee(
                                        currentPackageDir,
                                        backupPath,
                                    )
                                    console.log("Pre-export backup saved:", backupPath)

                                    // Keep only the 10 most recent backups
                                    const backups = fs
                                        .readdirSync(backupsDir)
                                        .filter((f) => f.endsWith(".bpee"))
                                        .map((f) => ({
                                            name: f,
                                            path: path.join(backupsDir, f),
                                            time: fs
                                                .statSync(path.join(backupsDir, f))
                                                .mtime.getTime(),
                                        }))
                                        .sort((a, b) => b.time - a.time)
                                    for (const old of backups.slice(10)) {
                                        try {
                                            fs.unlinkSync(old.path)
                                        } catch (err) {
                                            console.warn(
                                                "Failed to prune old backup:",
                                                old.name,
                                            )
                                        }
                                    }
                                } catch (err) {
                                    console.warn(
                                        "Pre-export backup failed (continuing with export):",
                                        err.message,
                                    )
                                }
                            }

                            await exportPackageAsBeePack(currentPackageDir, filePath)

                            // Open folder or launch BEEMod based on settings
                            const openFolder = getSetting("openFolderAfterExport", true)

                            if (exportToBeemod) {
                                // Launch BEE2.exe
                                const bee2Exe = path.join(beemodPath, "BEE2.exe")
                                console.log("Looking for BEE2.exe at:", bee2Exe)
                                if (fs.existsSync(bee2Exe)) {
                                    console.log("Launching BEE2.exe...")
                                    // Use exec with start command for Windows
                                    exec(`start "" "${bee2Exe}"`, { cwd: beemodPath }, (err) => {
                                        if (err) console.error("Failed to launch BEE2:", err)
                                    })
                                } else {
                                    console.warn("BEE2.exe not found at:", bee2Exe)
                                }
                                dialog.showMessageBox(mainWindow, {
                                    message: `Package exported to BEEMod packages folder!`,
                                    type: "info",
                                })
                            } else if (openFolder) {
                                shell.showItemInFolder(filePath)
                            } else {
                                dialog.showMessageBox(mainWindow, {
                                    message: `Package exported to: ${filePath}`,
                                    type: "info",
                                })
                            }
                        } catch (err) {
                            // The in-app export progress dialog already
                            // reported this failure — a native error box on
                            // top of it is just noise
                            console.error("Export failed:", err.message)
                        }
                    },
                },
                { type: "separator" },
                {
                    label: "Preferences...",
                    accelerator: "Ctrl+,",
                    click: () => {
                        createSettingsWindow(mainWindow)
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
                { type: "separator" },
                {
                    id: "package-information",
                    label: "Package Information...",
                    accelerator: "Ctrl+Shift+I",
                    click: () => {
                        const currentPackageDir = getCurrentPackageDir()
                        if (!currentPackageDir) {
                            dialog.showMessageBox(mainWindow, {
                                type: "info",
                                message: "No package is currently open",
                                detail: "Please open or create a package first",
                            })
                            return
                        }
                        createPackageInformationWindow(mainWindow)
                    },
                },
                {
                    id: "beepm-package-info",
                    label: "BeePM Package Info...",
                    accelerator: "Ctrl+Shift+B",
                    click: () => {
                        const currentPackageDir = getCurrentPackageDir()
                        if (!currentPackageDir) {
                            dialog.showMessageBox(mainWindow, {
                                type: "info",
                                message: "No package is currently open",
                                detail: "Please open or create a package first",
                            })
                            return
                        }
                        createBeePackageWindow(mainWindow)
                    },
                },
            ],
        },
        {
            label: "Help",
            submenu: [
                {
                    label: "GitHub Repository",
                    click: () => {
                        shell.openExternal(
                            "https://github.com/BeemodTools/BeePEE",
                        )
                    },
                },
                {
                    label: "Tutorial",
                    click: () => {
                        shell.openExternal(
                            "https://github.com/BeemodTools/BeePEE/wiki",
                        )
                    },
                },
                {
                    label: "Discord Server",
                    click: () => {
                        shell.openExternal("https://discord.gg/WPzDn4sZY3")
                    },
                },
                { type: "separator" },
                {
                    label: "Report Bug...",
                    click: () => {
                        createCrashReportWindow(null)
                    },
                },
                {
                    label: "Open Logs Folder",
                    click: () => {
                        const logsDir = logger.getLogsDirectory()
                        if (logsDir) {
                            shell.openPath(logsDir)
                        }
                    },
                },
                { type: "separator" },
                {
                    label: "What's New...",
                    click: () => {
                        createChangelogWindow(mainWindow)
                    },
                },
                {
                    label: "Check for Updates...",
                    click: () => {
                        if (global.updaterInstance) {
                            global.updaterInstance.checkForUpdates(false) // Non-silent check
                        } else {
                            dialog.showMessageBox({
                                type: "error",
                                title: "Error",
                                message: "Update checker is not available.",
                                buttons: ["OK"],
                            })
                        }
                    },
                },
            ],
        },
    ]

    // Add developer tools in development mode, or when the Developer mode setting is on
    if (isDev || getSetting("devMode", false)) {
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
                                // currentPackageDir is now managed in packageManager.js
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
    updateMenuState()
    return menu
}

module.exports = { createMainMenu, updateMenuState, rebuildMenu }
