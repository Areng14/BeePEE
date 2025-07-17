const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("package", {
    loadPackage: () => ipcRenderer.invoke("dialog:loadPackage"),
    loadFile: (path) => ipcRenderer.invoke("api:loadImage", path),
    onPackageLoaded: (callback) => ipcRenderer.on("package:loaded", (event, items) => callback(items))
})
