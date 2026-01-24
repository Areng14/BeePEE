const openEditors = new Map()
const openModelPreviewWindows = new Map() // Track model preview windows
let createItemWindow = null // Track the create item window
let createPackageWindow = null // Track the create package window
let packageInformationWindow = null // Track the package information window
let changelogWindow = null // Track the changelog window
const { BrowserWindow, app } = require("electron")
const path = require("path")
const { isDev } = require("../utils/isDev.js")

function createItemEditor(item, mainWindow) {
    if (openEditors.has(item.id)) {
        openEditors.get(item.id).focus()
        return
    }

    const window = new BrowserWindow({
        width: 960,
        height: 1024,
        title: `BeePEE - Edit ${item.name}`,
        // Remove parent to ensure separate taskbar entry
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload.js"),
        },
        devTools: isDev,
        // Ensure window shows in taskbar independently
        skipTaskbar: false,
        minimizable: true,
        maximizable: true,
        resizable: true,
    })

    openEditors.set(item.id, window)

    window.on("closed", () => {
        openEditors.delete(item.id)
    })

    if (isDev) {
        window.loadURL(`http://localhost:5173/?route=editor`)
    } else {
        // Use app.getAppPath() for reliable path resolution in packaged app
        const appPath = app.getAppPath()
        window.loadFile(path.join(appPath, "dist", "index.html"), {
            query: { route: "editor" },
        })
    }

    window.setMenuBarVisibility(false)

    window.webContents.once("did-finish-load", () => {
        setTimeout(() => {
            window.webContents.send("load-item", item.toJSONWithExistence())
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

function createItemCreationWindow(mainWindow) {
    // If window already exists, focus it
    if (createItemWindow && !createItemWindow.isDestroyed()) {
        createItemWindow.focus()
        return
    }

    createItemWindow = new BrowserWindow({
        width: 500,
        height: 500,
        title: "BeePEE - Create New Item",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload.js"),
        },
        devTools: isDev,
        skipTaskbar: false,
        minimizable: true,
        maximizable: false,
        resizable: false,
        autoHideMenuBar: true,
    })

    createItemWindow.on("closed", () => {
        createItemWindow = null
    })

    if (isDev) {
        createItemWindow.loadURL(`http://localhost:5173/?route=create-item`)
    } else {
        // Use app.getAppPath() for reliable path resolution in packaged app
        const appPath = app.getAppPath()
        createItemWindow.loadFile(path.join(appPath, "dist", "index.html"), {
            query: { route: "create-item" },
        })
    }

    createItemWindow.setMenuBarVisibility(false)
}

function createPackageCreationWindow(mainWindow) {
    // If window already exists, focus it
    if (createPackageWindow && !createPackageWindow.isDestroyed()) {
        createPackageWindow.focus()
        return
    }

    createPackageWindow = new BrowserWindow({
        width: 500,
        height: 650,
        title: "BeePEE - Create New Package",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload.js"),
        },
        devTools: isDev,
        skipTaskbar: false,
        minimizable: true,
        maximizable: false,
        resizable: false,
        autoHideMenuBar: true,
    })

    createPackageWindow.on("closed", () => {
        createPackageWindow = null
    })

    if (isDev) {
        createPackageWindow.loadURL(`http://localhost:5173/?route=create-package`)
    } else {
        // Use app.getAppPath() for reliable path resolution in packaged app
        const appPath = app.getAppPath()
        createPackageWindow.loadFile(
            path.join(appPath, "dist", "index.html"),
            {
                query: { route: "create-package" },
            },
        )
    }

    createPackageWindow.setMenuBarVisibility(false)
}

function createPackageInformationWindow(mainWindow) {
    // If window already exists, focus it
    if (packageInformationWindow && !packageInformationWindow.isDestroyed()) {
        packageInformationWindow.focus()
        return
    }

    packageInformationWindow = new BrowserWindow({
        width: 500,
        height: 650,
        title: "BeePEE - Package Information",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload.js"),
        },
        devTools: isDev,
        skipTaskbar: false,
        minimizable: true,
        maximizable: false,
        resizable: false,
        autoHideMenuBar: true,
    })

    packageInformationWindow.on("closed", () => {
        packageInformationWindow = null
    })

    if (isDev) {
        packageInformationWindow.loadURL(
            `http://localhost:5173/?route=package-information`,
        )
    } else {
        // Use app.getAppPath() for reliable path resolution in packaged app
        const appPath = app.getAppPath()
        packageInformationWindow.loadFile(
            path.join(appPath, "dist", "index.html"),
            {
                query: { route: "package-information" },
            },
        )
    }

    packageInformationWindow.setMenuBarVisibility(false)
}

function createChangelogWindow(mainWindow) {
    // If window already exists, focus it
    if (changelogWindow && !changelogWindow.isDestroyed()) {
        changelogWindow.focus()
        return
    }

    changelogWindow = new BrowserWindow({
        width: 800,
        height: 700,
        title: "BeePEE - What's New",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload.js"),
        },
        devTools: isDev,
        skipTaskbar: false,
        minimizable: true,
        maximizable: true,
        resizable: true,
        autoHideMenuBar: true,
    })

    changelogWindow.on("closed", () => {
        changelogWindow = null
    })

    if (isDev) {
        changelogWindow.loadURL(`http://localhost:5173/?route=changelog`)
    } else {
        // Use app.getAppPath() for reliable path resolution in packaged app
        const appPath = app.getAppPath()
        changelogWindow.loadFile(path.join(appPath, "dist", "index.html"), {
            query: { route: "changelog" },
        })
    }

    changelogWindow.setMenuBarVisibility(false)
}

/**
 * Create a 3D model preview window
 * @param {object} modelData - Object containing objUrl, mtlUrl, title, and optional segments
 */
function createModelPreviewWindow(modelData) {
    const { objPath, title = "Model Preview" } = modelData
    const windowKey = objPath || `preview-${Date.now()}`

    // If window already exists for this model, focus it
    if (openModelPreviewWindows.has(windowKey)) {
        const existingWindow = openModelPreviewWindows.get(windowKey)
        if (!existingWindow.isDestroyed()) {
            existingWindow.focus()
            return existingWindow
        }
        openModelPreviewWindows.delete(windowKey)
    }

    const previewWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload.js"),
            webSecurity: false, // Required for loading local files via beep://
        },
        devTools: isDev,
        skipTaskbar: false,
        minimizable: true,
        maximizable: true,
        resizable: true,
        autoHideMenuBar: true,
    })

    openModelPreviewWindows.set(windowKey, previewWindow)

    previewWindow.on("closed", () => {
        openModelPreviewWindows.delete(windowKey)
    })

    // Also clean up when window is about to close
    previewWindow.on("close", () => {
        try {
            if (previewWindow.webContents && !previewWindow.webContents.isDestroyed()) {
                previewWindow.webContents.session.clearStorageData({
                    storages: ["cachestorage", "filesystem", "indexdb", "localstorage", "shadercache", "websql", "serviceworkers"],
                })
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    })

    if (isDev) {
        previewWindow.loadURL(`http://localhost:5173/?route=model-preview`)
    } else {
        const appPath = app.getAppPath()
        previewWindow.loadFile(path.join(appPath, "dist", "index.html"), {
            query: { route: "model-preview" },
        })
    }

    previewWindow.setMenuBarVisibility(false)

    // Send model data after the window has finished loading
    previewWindow.webContents.once("did-finish-load", () => {
        setTimeout(() => {
            previewWindow.webContents.send("model-preview-data", modelData)
        }, 100)
    })

    return previewWindow
}

/**
 * Close all model preview windows to release file handles
 */
async function closeAllModelPreviewWindows() {
    const closePromises = []
    for (const [key, window] of openModelPreviewWindows) {
        if (window && !window.isDestroyed()) {
            // Clear all session caches before closing
            try {
                const session = window.webContents.session
                await session.clearCache()
                await session.clearStorageData({
                    storages: ["appcache", "cookies", "filesystem", "indexdb", "localstorage", "shadercache", "websql", "serviceworkers", "cachestorage"],
                })
            } catch (e) {
                // Ignore cleanup errors
            }

            closePromises.push(
                new Promise((resolve) => {
                    window.once("closed", resolve)
                    window.close()
                })
            )
        } else {
            openModelPreviewWindows.delete(key)
        }
    }

    if (closePromises.length > 0) {
        await Promise.all(closePromises)
        // Give more time for file handles to be released after cache clear
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Force garbage collection if available
        if (global.gc) {
            global.gc()
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
    }
}

/**
 * Close all item editor windows to release file handles
 */
async function closeAllEditorWindows() {
    const closePromises = []
    for (const [key, window] of openEditors) {
        if (window && !window.isDestroyed()) {
            // Clear all session caches before closing
            try {
                const session = window.webContents.session
                await session.clearCache()
                await session.clearStorageData({
                    storages: ["appcache", "cookies", "filesystem", "indexdb", "localstorage", "shadercache", "websql", "serviceworkers", "cachestorage"],
                })
            } catch (e) {
                // Ignore cleanup errors
            }

            closePromises.push(
                new Promise((resolve) => {
                    window.once("closed", resolve)
                    window.close()
                })
            )
        } else {
            openEditors.delete(key)
        }
    }

    if (closePromises.length > 0) {
        console.log(`Closing ${closePromises.length} editor window(s)...`)
        await Promise.all(closePromises)
        // Give time for file handles to be released
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Force garbage collection if available
        if (global.gc) {
            global.gc()
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
    }
}

/**
 * Close all windows (editors, model previews, etc.) to release all file handles
 */
async function closeAllWindows() {
    console.log('Closing all BeePEE windows to release file handles...')
    await closeAllEditorWindows()
    await closeAllModelPreviewWindows()

    // Also close create item and create package windows if open
    if (createItemWindow && !createItemWindow.isDestroyed()) {
        createItemWindow.close()
    }
    if (createPackageWindow && !createPackageWindow.isDestroyed()) {
        createPackageWindow.close()
    }

    // Give extra time for all handles to be released
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Force garbage collection
    if (global.gc) {
        global.gc()
        await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log('All BeePEE windows closed')
}

module.exports = {
    createItemEditor,
    sendItemUpdateToEditor,
    openEditors,
    createItemCreationWindow,
    getCreateItemWindow: () => createItemWindow,
    createPackageCreationWindow,
    getCreatePackageWindow: () => createPackageWindow,
    createPackageInformationWindow,
    getPackageInformationWindow: () => packageInformationWindow,
    createChangelogWindow,
    getChangelogWindow: () => changelogWindow,
    createModelPreviewWindow,
    closeAllModelPreviewWindows,
    closeAllEditorWindows,
    closeAllWindows,
    openModelPreviewWindows,
}
