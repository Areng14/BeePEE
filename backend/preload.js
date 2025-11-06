const { contextBridge, ipcRenderer } = require("electron")

// Expose general electron API
contextBridge.exposeInMainWorld("electron", {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    showOpenDialog: (options) =>
        ipcRenderer.invoke("show-open-dialog", options),
    showMessageBox: (options) =>
        ipcRenderer.invoke("show-message-box", options),
})

// Expose general event API for progress updates, etc.
contextBridge.exposeInMainWorld("api", {
    on: (channel, callback) => {
        const subscription = (event, ...args) => callback(event, ...args)
        ipcRenderer.on(channel, subscription)
        return subscription
    },
    off: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback)
    },
})

contextBridge.exposeInMainWorld("package", {
    // ========================================
    // PACKAGE MANAGEMENT FUNCTIONS
    // ========================================
    loadPackage: () => ipcRenderer.invoke("dialog:loadPackage"),
    loadFile: (path) => ipcRenderer.invoke("api:loadImage", path),
    getCurrentItems: () => ipcRenderer.invoke("get-current-items"),
    onPackageLoaded: (callback) => {
        // Note: We DON'T remove all listeners here because multiple components need to listen
        // (App.jsx for navigation, ItemBrowser for loading items)
        ipcRenderer.on("package:loaded", (event, items) => {
            console.log(
                "preload.js: Received package:loaded event with items:",
                items?.length,
            )
            callback(items)
        })
    },
    onPackageClosed: (callback) => {
        // Note: We DON'T remove all listeners here because multiple components need to listen
        // (App.jsx for navigation, ItemBrowser for clearing items)
        ipcRenderer.on("package:closed", () => {
            console.log("preload.js: Received package:closed event")
            callback()
        })
    },

    // ========================================
    // ITEM EDITING FUNCTIONS
    // ========================================
    openItemEditor: (item) => ipcRenderer.invoke("open-item-editor", item),
    onItemLoaded: (callback) => {
        if (callback) {
            ipcRenderer.on("load-item", (event, item) => callback(event, item))
        } else {
            ipcRenderer.removeAllListeners("load-item")
        }
    },
    editorReady: () => ipcRenderer.send("editor-ready"),
    showIconPreview: (iconPath, itemName) =>
        ipcRenderer.invoke("show-icon-preview", { iconPath, itemName }),
    browseForIcon: (itemId) =>
        ipcRenderer.invoke("browse-for-icon", { itemId }),
    browseForIconFile: () => ipcRenderer.invoke("browse-for-icon-file"),
    saveItem: (itemData) => ipcRenderer.invoke("save-item", itemData),
    onItemUpdated: (callback) => {
        // Remove existing listeners to prevent stacking
        ipcRenderer.removeAllListeners("item-updated")
        if (callback) {
            ipcRenderer.on("item-updated", (event, item) =>
                callback(event, item),
            )
        }
    },

    // ========================================
    // INSTANCE MANAGEMENT FUNCTIONS
    // ========================================
    editInstance: (instancePath) =>
        ipcRenderer.invoke("edit-instance", instancePath),
    addInstance: (itemId, instanceName) =>
        ipcRenderer.invoke("add-instance", { itemId, instanceName }),
    addInstanceFromFile: (itemId, filePath, instanceName) =>
        ipcRenderer.invoke("add-instance-from-file", {
            itemId,
            filePath,
            instanceName,
        }),
    addInstanceFileDialog: (itemId) =>
        ipcRenderer.invoke("add-instance-file-dialog", { itemId }),
    selectInstanceFile: (itemId) =>
        ipcRenderer.invoke("select-instance-file", { itemId }),
    replaceInstanceFileDialog: (itemId, instanceIndex) =>
        ipcRenderer.invoke("replace-instance-file-dialog", {
            itemId,
            instanceIndex,
        }),
    removeInstance: (itemId, instanceIndex) =>
        ipcRenderer.invoke("remove-instance", { itemId, instanceIndex }),
    getInstanceMetadata: (itemId, instanceIndex) =>
        ipcRenderer.invoke("get-instance-metadata", { itemId, instanceIndex }),

    // ========================================
    // INSTANCE NAMING FUNCTIONS
    // ========================================
    getInstanceName: (itemId, instanceIndex) =>
        ipcRenderer.invoke("get-instance-name", { itemId, instanceIndex }),
    setInstanceName: (itemId, instanceIndex, name) =>
        ipcRenderer.invoke("set-instance-name", {
            itemId,
            instanceIndex,
            name,
        }),
    getInstanceNames: (itemId) =>
        ipcRenderer.invoke("get-instance-names", { itemId }),
    removeInstanceName: (itemId, instanceIndex) =>
        ipcRenderer.invoke("remove-instance-name", { itemId, instanceIndex }),

    // ========================================
    // INPUT MANAGEMENT FUNCTIONS
    // ========================================
    getInputs: (itemId) => ipcRenderer.invoke("get-inputs", { itemId }),
    addInput: (itemId, inputName, inputConfig) =>
        ipcRenderer.invoke("add-input", { itemId, inputName, inputConfig }),
    updateInput: (itemId, inputName, inputConfig) =>
        ipcRenderer.invoke("update-input", { itemId, inputName, inputConfig }),
    removeInput: (itemId, inputName) =>
        ipcRenderer.invoke("remove-input", { itemId, inputName }),

    // ========================================
    // OUTPUT MANAGEMENT FUNCTIONS
    // ========================================
    getOutputs: (itemId) => ipcRenderer.invoke("get-outputs", { itemId }),
    addOutput: (itemId, outputName, outputConfig) =>
        ipcRenderer.invoke("add-output", { itemId, outputName, outputConfig }),
    updateOutput: (itemId, outputName, outputConfig) =>
        ipcRenderer.invoke("update-output", {
            itemId,
            outputName,
            outputConfig,
        }),
    removeOutput: (itemId, outputName) =>
        ipcRenderer.invoke("remove-output", { itemId, outputName }),

    // ========================================
    // VARIABLES MANAGEMENT FUNCTIONS
    // ========================================
    getVariables: (itemId) => ipcRenderer.invoke("get-variables", { itemId }),
    saveVariables: (itemId, variables) =>
        ipcRenderer.invoke("save-variables", { itemId, variables }),

    // ========================================
    // CONDITIONS MANAGEMENT FUNCTIONS
    // ========================================
    getConditions: (itemId) => ipcRenderer.invoke("get-conditions", { itemId }),
    saveConditions: (itemId, conditions) =>
        ipcRenderer.invoke("save-conditions", { itemId, conditions }),
    convertBlocksToVbsp: (blocks) =>
        ipcRenderer.invoke("convert-blocks-to-vbsp", { blocks }),

    // ========================================
    // VMF2OBJ CONVERSION
    // ========================================
    convertVmfToObj: (vmfPath, outputDir) =>
        ipcRenderer.invoke("convert-vmf-to-obj", { vmfPath, outputDir }),
    convertInstanceToObj: (itemId, instanceKey, options = {}) =>
        ipcRenderer.invoke("convert-instance-to-obj", {
            itemId,
            instanceKey,
            options,
        }),
    setExtraResourcePaths: (paths) =>
        ipcRenderer.invoke("set-extra-resource-paths", { paths }),
    getExtraResourcePaths: () => ipcRenderer.invoke("get-extra-resource-paths"),
    findPortal2Resources: () => ipcRenderer.invoke("find-portal2-resources"),
    getFileStats: (filePath) =>
        ipcRenderer.invoke("get-file-stats", { filePath }),
    showItemInFolder: (filePath) =>
        ipcRenderer.invoke("show-item-in-folder", { filePath }),
    showModelPreview: (objPath, mtlPath, title) =>
        ipcRenderer.invoke("show-model-preview", { objPath, mtlPath, title }),

    // ========================================
    // PORTAL 2 DETECTION
    // ========================================
    getPortal2Status: () => ipcRenderer.invoke("get-portal2-status"),

    // ========================================
    // ENTITY AND FGD DATA FUNCTIONS
    // ========================================
    getItemEntities: (itemId) =>
        ipcRenderer.invoke("get-item-entities", { itemId }),
    getValidInstances: (itemId) =>
        ipcRenderer.invoke("get-valid-instances", { itemId }),
    getFgdData: () => ipcRenderer.invoke("get-fgd-data"),

    // ========================================
    // METADATA MANAGEMENT FUNCTIONS
    // ========================================
    getItemMetadata: (itemId) =>
        ipcRenderer.invoke("get-item-metadata", { itemId }),
    updateItemMetadata: (itemId, metadata) =>
        ipcRenderer.invoke("update-item-metadata", { itemId, metadata }),

    // ========================================
    // WINDOW TITLE MANAGEMENT
    // ========================================
    setUnsavedChanges: (hasChanges) =>
        ipcRenderer.invoke("set-unsaved-changes", hasChanges),

    // ========================================
    // PACKAGE MANAGEMENT FUNCTIONS
    // ========================================
    reloadPackage: () => ipcRenderer.invoke("reload-package"),

    // ========================================
    // PACKAGE LOADING PROGRESS
    // ========================================
    onPackageLoadingProgress: (callback) =>
        ipcRenderer.on("package-loading-progress", (event, data) =>
            callback(data),
        ),

    // ========================================
    // AUTO-UPDATER FUNCTIONS
    // ========================================
    checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
    downloadUpdate: () => ipcRenderer.invoke("download-update"),
    quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
    onUpdateStatus: (callback) => {
        ipcRenderer.removeAllListeners("update-status")
        ipcRenderer.on("update-status", (event, data) => callback(data))
    },
})
