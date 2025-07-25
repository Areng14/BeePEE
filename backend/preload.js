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
    addInstanceFileDialog: (itemId) => ipcRenderer.invoke("add-instance-file-dialog", { itemId }),
    replaceInstanceFileDialog: (itemId, instanceIndex) => ipcRenderer.invoke("replace-instance-file-dialog", { itemId, instanceIndex }),
    removeInstance: (itemId, instanceIndex) => ipcRenderer.invoke("remove-instance", { itemId, instanceIndex }),

    // Input management functions
    getInputs: (itemId) => ipcRenderer.invoke("get-inputs", { itemId }),
    addInput: (itemId, inputName, inputConfig) => ipcRenderer.invoke("add-input", { itemId, inputName, inputConfig }),
    updateInput: (itemId, inputName, inputConfig) => ipcRenderer.invoke("update-input", { itemId, inputName, inputConfig }),
    removeInput: (itemId, inputName) => ipcRenderer.invoke("remove-input", { itemId, inputName }),

    // Output management functions
    getOutputs: (itemId) => ipcRenderer.invoke("get-outputs", { itemId }),
    addOutput: (itemId, outputName, outputConfig) => ipcRenderer.invoke("add-output", { itemId, outputName, outputConfig }),
    updateOutput: (itemId, outputName, outputConfig) => ipcRenderer.invoke("update-output", { itemId, outputName, outputConfig }),
    removeOutput: (itemId, outputName) => ipcRenderer.invoke("remove-output", { itemId, outputName }),

    // Entity and FGD data functions
    getItemEntities: (itemId) => ipcRenderer.invoke("get-item-entities", { itemId }),
    getFgdData: () => ipcRenderer.invoke("get-fgd-data"),
})
