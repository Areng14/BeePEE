const openEditors = new Map()
let createItemWindow = null // Track the create item window
let createPackageWindow = null // Track the create package window
let packageInformationWindow = null // Track the package information window
const { BrowserWindow } = require("electron")
const path = require("path")

function createItemEditor(item, mainWindow) {
    if (openEditors.has(item.id)) {
        openEditors.get(item.id).focus()
        return
    }

    const isDev = !require("electron").app.isPackaged

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
        window.loadURL(`http://localhost:5173/editor`)
    } else {
        window.loadFile(path.join(__dirname, "../dist/index.html"), {
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

    const isDev = !require("electron").app.isPackaged

    createItemWindow = new BrowserWindow({
        width: 600,
        height: 900,
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
        createItemWindow.loadURL(`http://localhost:5173/create-item`)
    } else {
        createItemWindow.loadFile(path.join(__dirname, "../dist/index.html"), {
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

    const isDev = !require("electron").app.isPackaged

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
        createPackageWindow.loadURL(`http://localhost:5173/create-package`)
    } else {
        createPackageWindow.loadFile(
            path.join(__dirname, "../dist/index.html"),
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

    const isDev = !require("electron").app.isPackaged

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
            `http://localhost:5173/package-information`,
        )
    } else {
        packageInformationWindow.loadFile(
            path.join(__dirname, "../dist/index.html"),
            {
                query: { route: "package-information" },
            },
        )
    }

    packageInformationWindow.setMenuBarVisibility(false)
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
}
