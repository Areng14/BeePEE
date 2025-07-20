const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("package", {
    loadPackage: () => ipcRenderer.invoke("dialog:loadPackage"),
    loadFile: (path) => ipcRenderer.invoke("api:loadImage", path),
    onPackageLoaded: (callback) =>
        ipcRenderer.on("package:loaded", (event, items) => callback(items)),
    onPackageClosed: (callback) =>
        ipcRenderer.on("package:closed", () => callback()),
    openItemEditor: (item) => ipcRenderer.invoke("open-item-editor", item),
    onItemLoaded: (callback) =>
        ipcRenderer.on("load-item", (event, item) => callback(event, item)),
    editorReady: () => ipcRenderer.send("editor-ready"),
    saveItem: (itemData) => ipcRenderer.invoke("save-item", itemData),
    onItemUpdated: (callback) =>
        ipcRenderer.on("item-updated", (event, item) => callback(event, item)),
    editInstance: (instancePath) => ipcRenderer.invoke("edit-instance", instancePath),
    addInstance: (itemId, instanceName) => ipcRenderer.invoke("add-instance", { itemId, instanceName }),
    removeInstance: (itemId, instanceIndex) => ipcRenderer.invoke("remove-instance", { itemId, instanceIndex }),
})
