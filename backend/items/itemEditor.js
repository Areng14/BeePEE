const openEditors = new Map()
let createItemWindow = null // Track the create item window
let createPackageWindow = null // Track the create package window
let packageInformationWindow = null // Track the package information window
let changelogWindow = null // Track the changelog window
const { BrowserWindow, app } = require("electron")
const path = require("path")
const isDev = require("../utils/isDev.js")

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
}
