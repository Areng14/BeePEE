const { reg_loadPackagePopup, packages } = require("./packageManager")
const {
    createItemEditor,
    sendItemUpdateToEditor,
} = require("./items/itemEditor")
const { ipcMain, dialog, BrowserWindow } = require("electron")
const fs = require("fs")
const path = require("path")
const { saveItem } = require("./saveItem") // Import the new saveItem function
const { Item } = require("./models/items") // Import the Item class
const { savePackageAsBpee } = require("./packageManager")
const {
    findPortal2Resources,
    getHammerPath,
    getHammerAvailability,
} = require("./data")
const { spawn } = require("child_process")
const { Instance } = require("./items/Instance")
const { getCleanInstancePath } = require("./utils/instancePaths")

// Track last saved .bpee path in memory (could be improved with persistent storage)
let lastSavedBpeePath = null
let currentPackageDir = null // This should be set when a package is loaded

// Helper to load original itemJSON from info.json
function loadOriginalItemJSON(packagePath, itemId) {
    // Try to find info.json in the packagePath or its parent
    let infoPath = fs.existsSync(path.join(packagePath, "info.json"))
        ? path.join(packagePath, "info.json")
        : path.join(path.dirname(packagePath), "info.json")
    if (!fs.existsSync(infoPath)) {
        throw new Error(`info.json not found for package: ${packagePath}`)
    }
    const parsedInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"))
    let rawitems = parsedInfo["Item"]
    if (!rawitems) throw new Error("Invalid package format - no items found")
    if (!Array.isArray(rawitems)) rawitems = [rawitems]
    const found = rawitems.find((el) => el.ID === itemId)
    if (!found) throw new Error(`Item with ID ${itemId} not found in info.json`)
    return found
}

// Track open preview windows to prevent duplicates
const openPreviewWindows = new Map()

function createIconPreviewWindow(iconPath, itemName, parentWindow) {
    // If a preview window is already open for this icon, focus it instead
    if (openPreviewWindows.has(iconPath)) {
        const existingWindow = openPreviewWindows.get(iconPath)
        if (!existingWindow.isDestroyed()) {
            existingWindow.focus()
            return
        }
        // Window was destroyed, remove from map
        openPreviewWindows.delete(iconPath)
    }

    const title = itemName ? `${itemName} - Icon Preview` : `Icon Preview`

    const previewWindow = new BrowserWindow({
        width: 296, // 256 + 40px padding for window chrome
        height: 336, // 256 + 80px for title bar and padding
        resizable: false,
        maximizable: false,
        minimizable: false,
        title: title,
        alwaysOnTop: true, // Keep preview on top without parent relationship
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Allow loading local files
        },
        icon: iconPath, // Set the window icon to the preview image
    })

    // Track the window
    openPreviewWindows.set(iconPath, previewWindow)

    // Clean up when window is closed
    previewWindow.on("closed", () => {
        openPreviewWindows.delete(iconPath)
    })

    // Create simple HTML to display the image
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Icon Preview</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                background: #2d2d2d;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: calc(100vh - 40px);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            img {
                width: 256px;
                height: 256px;
                object-fit: contain;
                border: 1px solid #555;
                background: #fff;
                image-rendering: pixelated;
            }
        </style>
    </head>
    <body>
        <img src="file://${iconPath.replace(/\\/g, "/")}" alt="Icon Preview" />
    </body>
    </html>
    `

    // Load the HTML content
    previewWindow.loadURL(
        `data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`,
    )

    // Remove menu bar
    previewWindow.setMenuBarVisibility(false)
}

async function handleItemSave(item, event, mainWindow) {
    try {
        // Validate input
        if (!item?.fullItemPath) {
            throw new Error("Invalid item path")
        }
        if (!item?.name?.trim()) {
            throw new Error("Item name cannot be empty")
        }

        // Use the new saveItem function to handle file operations
        const { editorItems, properties } = await saveItem(item)

        // Reconstruct the item from disk to ensure all fields are up to date
        const packagePath =
            item.packagePath || path.dirname(path.dirname(item.fullItemPath))
        let itemJSON
        try {
            itemJSON = loadOriginalItemJSON(packagePath, item.id)
        } catch (e) {
            // fallback to minimal itemJSON if info.json is missing or item not found
            const itemFolder =
                item.itemFolder || path.basename(item.fullItemPath)
            itemJSON = {
                ID: item.id,
                Version: { Styles: { BEE2_CLEAN: itemFolder } },
            }
        }
        const updatedItemInstance = new Item({ packagePath, itemJSON })
        const updatedItem = updatedItemInstance.toJSON()

        // Send the updated item data to both windows
        event.sender.send("item-updated", updatedItem) // Send to editor window
        mainWindow.webContents.send("item-updated", updatedItem) // Send to main window

        // Clear unsaved changes indicator
        if (global.titleManager) {
            global.titleManager.setUnsavedChanges(false)
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to save item:", error)
        dialog.showErrorBox(
            "Save Failed",
            `Failed to save item: ${error.message}\n\nPlease check the file permissions and try again.`,
        )
        throw error
    }
}

function reg_events(mainWindow) {
    // Initialize Portal 2 resources at startup
    findPortal2Resources().catch((error) => {
        console.error("Failed to find Portal 2 resources:", error)
    })

    // Register package loading
    reg_loadPackagePopup()

    // Register item editor opening
    ipcMain.handle("open-item-editor", async (event, item) => {
        // Find the actual Item instance from the packages
        const actualItem = packages
            .flatMap((p) => p.items)
            .find((i) => i.id === item.id)
        if (!actualItem) {
            throw new Error(`Item not found: ${item.id}`)
        }
        createItemEditor(actualItem, mainWindow)
    })

    // Register item saving
    ipcMain.handle("save-item", async (event, itemData) => {
        return handleItemSave(itemData, event, mainWindow)
    })

    // Register unsaved changes tracking
    ipcMain.handle("set-unsaved-changes", async (event, hasChanges) => {
        if (global.titleManager) {
            global.titleManager.setUnsavedChanges(hasChanges)
        }
        return { success: true }
    })

    // Register icon preview handler
    ipcMain.handle(
        "show-icon-preview",
        async (event, { iconPath, itemName }) => {
            try {
                if (!iconPath || !fs.existsSync(iconPath)) {
                    throw new Error("Icon file not found")
                }

                createIconPreviewWindow(iconPath, itemName, mainWindow)

                return { success: true }
            } catch (error) {
                console.error("Failed to show icon preview:", error)
                throw error
            }
        },
    )

    // Register icon browse handler
    ipcMain.handle("browse-for-icon", async (event, { itemId }) => {
        try {
            // Find the item in any loaded package
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            // Show file dialog to select image file
            const result = await dialog.showOpenDialog(mainWindow, {
                title: "Select Icon File",
                properties: ["openFile"],
                filters: [
                    {
                        name: "Image Files",
                        extensions: ["png", "jpg", "jpeg", "tga", "vtf"],
                    },
                    {
                        name: "All Files",
                        extensions: ["*"],
                    },
                ],
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)
            const fileExt = path.extname(fileName).toLowerCase()

            // Validate it's an image file
            const validExtensions = [".png", ".jpg", ".jpeg", ".tga", ".vtf"]
            if (!validExtensions.includes(fileExt)) {
                throw new Error("Selected file must be an image file (PNG, JPG, TGA, or VTF)")
            }

            // Get the current icon path or create a new one
            let targetIconPath
            if (item.icon && fs.existsSync(item.icon)) {
                // Replace existing icon - keep same path but update extension if needed
                const currentDir = path.dirname(item.icon)
                const currentBaseName = path.basename(item.icon, path.extname(item.icon))
                targetIconPath = path.join(currentDir, currentBaseName + fileExt)
                
                // Delete the old icon file if it's different from the new target
                if (item.icon !== targetIconPath && fs.existsSync(item.icon)) {
                    fs.unlinkSync(item.icon)
                }
            } else {
                // Create new icon path - use item name as filename in the BEE2/items structure
                const iconDir = path.join(item.packagePath, "resources", "BEE2", "items", "beepkg")
                if (!fs.existsSync(iconDir)) {
                    fs.mkdirSync(iconDir, { recursive: true })
                }
                const safeItemName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()
                targetIconPath = path.join(iconDir, safeItemName + fileExt)
            }

            // Copy the new icon file
            fs.copyFileSync(selectedFilePath, targetIconPath)

            // Update the item's icon path in the properties file (where Item class actually reads it)
            const propertiesPath = path.join(item.fullItemPath, "properties.json")
            if (fs.existsSync(propertiesPath)) {
                const properties = JSON.parse(fs.readFileSync(propertiesPath, "utf-8"))
                
                // Make path relative to resources/BEE2/items/ (as expected by Item class line 84)
                const bee2ItemsPath = path.join(item.packagePath, "resources", "BEE2", "items")
                const relativePath = path.relative(bee2ItemsPath, targetIconPath)
                
                if (!properties.Properties) properties.Properties = {}
                if (!properties.Properties.Icon) properties.Properties.Icon = {}
                properties.Properties.Icon["0"] = relativePath.replace(/\\/g, '/')
                
                fs.writeFileSync(propertiesPath, JSON.stringify(properties, null, 2))
            }

            // Reload the item to get updated data
            const updatedItemInstance = new Item({ 
                packagePath: item.packagePath, 
                itemJSON: loadOriginalItemJSON(item.packagePath, item.id) 
            })
            const updatedItem = updatedItemInstance.toJSON()

            // Send updated item data to frontend
            console.log('Sending updated item after icon change:', {
                id: updatedItem.id,
                icon: updatedItem.icon
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true, iconPath: targetIconPath }
        } catch (error) {
            console.error("Failed to browse for icon:", error)
            dialog.showErrorBox(
                "Failed to Set Icon",
                `Could not set icon: ${error.message}`
            )
            return { success: false, error: error.message }
        }
    })

    // IPC handler for Save Package
    ipcMain.on("save-package", async (event) => {
        try {
            if (!currentPackageDir) throw new Error("No package loaded")
            if (!lastSavedBpeePath) {
                // If no previous path, fall back to Save As
                event.sender.send("request-save-package-as")
                return
            }
            await savePackageAsBpee(currentPackageDir, lastSavedBpeePath)
            event.sender.send("package-saved", { path: lastSavedBpeePath })

            // Clear unsaved changes indicator
            if (global.titleManager) {
                global.titleManager.setUnsavedChanges(false)
            }
        } catch (err) {
            dialog.showErrorBox("Save Failed", err.message)
        }
    })

    // IPC handler for Save Package As
    ipcMain.on("save-package-as", async (event) => {
        try {
            if (!currentPackageDir) throw new Error("No package loaded")
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: "Save Package As",
                defaultPath: "package.bpee",
                filters: [{ name: "BeePEE Package", extensions: ["bpee"] }],
            })
            if (canceled || !filePath) return
            await savePackageAsBpee(currentPackageDir, filePath)
            lastSavedBpeePath = filePath
            event.sender.send("package-saved", { path: filePath })

            // Clear unsaved changes indicator
            if (global.titleManager) {
                global.titleManager.setUnsavedChanges(false)
            }
        } catch (err) {
            dialog.showErrorBox("Save As Failed", err.message)
        }
    })

    // Add instance
    ipcMain.handle("add-instance", async (event, { itemId, instanceName }) => {
        try {
            // Find the item in any loaded package
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            const newIndex = item.addInstance(instanceName)

            // Send updated item data to frontend
            const updatedItem = item.toJSON()
            console.log("Sending updated item after add instance:", {
                id: updatedItem.id,
                instances: updatedItem.instances,
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true, index: newIndex }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Add Instance",
                `Could not add instance: ${error.message}`,
            )
            return { success: false, error: error.message }
        }
    })

    // Helper function to fix instance paths by removing BEE2/ prefix
    function fixInstancePath(instancePath) {
        // Normalize path separators to forward slashes
        let normalizedPath = instancePath.replace(/\\/g, "/")

        if (normalizedPath.startsWith("instances/BEE2/")) {
            return normalizedPath.replace("instances/BEE2/", "instances/")
        }
        if (normalizedPath.startsWith("instances/bee2/")) {
            return normalizedPath.replace("instances/bee2/", "instances/")
        }
        return normalizedPath
    }

    // Helper function to fix all instances in an item
    function fixItemInstances(item) {
        let hasChanges = false

        // Fix instances in memory
        for (const [index, instanceData] of Object.entries(item.instances)) {
            const oldPath = instanceData.Name
            const newPath = fixInstancePath(oldPath)

            if (oldPath !== newPath) {
                console.log(`Fixing instance path: ${oldPath} -> ${newPath}`)
                instanceData.Name = newPath
                hasChanges = true
            }
        }

        // Fix instances in editoritems file
        if (hasChanges) {
            const editoritems = item.getEditorItems()
            if (editoritems.Item?.Exporting?.Instances) {
                for (const [index, instanceData] of Object.entries(
                    editoritems.Item.Exporting.Instances,
                )) {
                    const oldPath = instanceData.Name
                    const newPath = fixInstancePath(oldPath)

                    if (oldPath !== newPath) {
                        instanceData.Name = newPath
                    }
                }
                item.saveEditorItems(editoritems)
            }
        }

        return hasChanges
    }

    // Add instance with file dialog
    ipcMain.handle("add-instance-file-dialog", async (event, { itemId }) => {
        try {
            // Find the item in any loaded package
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            // Show file dialog to select VMF file
            const result = await dialog.showOpenDialog(mainWindow, {
                title: "Select VMF Instance File",
                properties: ["openFile"],
                filters: [
                    {
                        name: "VMF Files",
                        extensions: ["vmf"],
                    },
                    {
                        name: "All Files",
                        extensions: ["*"],
                    },
                ],
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)

            // Check if it's a VMF file
            if (!fileName.toLowerCase().endsWith(".vmf")) {
                throw new Error("Selected file must be a VMF file")
            }

            // Always save new instances in the instances/ directory directly
            // Use existing instance paths as template, or reconstruct from source file path
            let instanceName

            // Check if this item has existing instances to use as template
            const existingInstances = Object.values(item.instances)
            if (existingInstances.length > 0) {
                // Use the first existing instance path as template
                const templatePath = existingInstances[0].Name
                const templateDir = path.dirname(templatePath)

                // Create the new instance path using the template structure (keep BEE2/ for display)
                instanceName = templateDir + "/" + fileName
            } else {
                // No existing instances - reconstruct path from source file
                const selectedDir = path.dirname(selectedFilePath)
                const pathParts = selectedDir.split(path.sep)

                // Find the index of 'instances' in the source path
                const instancesIndex = pathParts.findIndex(
                    (part) => part.toLowerCase() === "instances",
                )

                if (
                    instancesIndex !== -1 &&
                    instancesIndex + 1 < pathParts.length
                ) {
                    // Get everything after 'instances' in the source path
                    const pathAfterInstances = pathParts.slice(
                        instancesIndex + 1,
                    )

                    // Skip 'bee' if it's the first part after instances
                    let finalPathParts = pathAfterInstances
                    if (
                        pathAfterInstances.length > 0 &&
                        pathAfterInstances[0].toLowerCase() === "bee"
                    ) {
                        finalPathParts = pathAfterInstances.slice(1)
                    }

                    if (finalPathParts.length > 0) {
                        // Reconstruct the path: instances/rest/of/path/filename
                        instanceName =
                            "instances/" +
                            finalPathParts.join("/") +
                            "/" +
                            fileName
                    } else {
                        // Fallback to simple instances/filename
                        instanceName = "instances/" + fileName
                    }
                } else {
                    // No instances found in path - create simple structure
                    const itemId = item.id.toLowerCase()
                    instanceName = `instances/${itemId}/${fileName}`
                }
            }

            // Copy the file to the package resources directory
            // Apply path fixing to remove BEE2/ prefix for actual file structure
            const actualFilePath = fixInstancePath(instanceName)
            const targetPath = path.join(
                item.packagePath,
                "resources",
                actualFilePath,
            )
            const targetDir = path.dirname(targetPath)

            // Ensure the instances directory exists
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true })
            }

            // Copy the file
            fs.copyFileSync(selectedFilePath, targetPath)

            // Add to editoritems
            const newIndex = item.addInstance(instanceName)

            // Send updated item data to frontend
            const updatedItem = item.toJSON()
            console.log(
                "Sending updated item after file dialog add instance:",
                {
                    id: updatedItem.id,
                    instances: updatedItem.instances,
                },
            )
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return {
                success: true,
                index: newIndex,
                instanceName: instanceName,
            }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Add Instance",
                `Could not add instance: ${error.message}`,
            )
            return { success: false, error: error.message }
        }
    })

    // Replace instance with file dialog
    ipcMain.handle(
        "replace-instance-file-dialog",
        async (event, { itemId, instanceIndex }) => {
            try {
                // Find the item in any loaded package
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) {
                    throw new Error("Item not found")
                }

                const instanceData = item.instances[instanceIndex]
                if (!instanceData) {
                    throw new Error(`Instance ${instanceIndex} not found`)
                }

                // Show file dialog to select new VMF file
                const result = await dialog.showOpenDialog(mainWindow, {
                    title: "Select Replacement VMF Instance File",
                    properties: ["openFile"],
                    filters: [
                        {
                            name: "VMF Files",
                            extensions: ["vmf"],
                        },
                        {
                            name: "All Files",
                            extensions: ["*"],
                        },
                    ],
                })

                if (result.canceled || result.filePaths.length === 0) {
                    return { success: false, canceled: true }
                }

                const selectedFilePath = result.filePaths[0]
                const fileName = path.basename(selectedFilePath)

                // Check if it's a VMF file
                if (!fileName.toLowerCase().endsWith(".vmf")) {
                    throw new Error("Selected file must be a VMF file")
                }

                // Get the current instance file path
                // Apply path fixing to remove BEE2/ prefix for actual file structure
                const actualInstancePath = fixInstancePath(instanceData.Name)
                const currentInstancePath = Instance.getCleanPath(
                    item.packagePath,
                    actualInstancePath,
                )

                // Copy the new file over the existing one
                fs.copyFileSync(selectedFilePath, currentInstancePath)

                // Clear the cached instance so it gets reloaded
                item._loadedInstances.delete(instanceIndex)

                // Send updated item data to frontend
                const updatedItem = item.toJSON()
                console.log("Sending updated item after replace instance:", {
                    id: updatedItem.id,
                    instances: updatedItem.instances,
                })
                mainWindow.webContents.send("item-updated", updatedItem)
                sendItemUpdateToEditor(itemId, updatedItem)

                return { success: true, instanceName: instanceData.Name }
            } catch (error) {
                dialog.showErrorBox(
                    "Failed to Replace Instance",
                    `Could not replace instance: ${error.message}`,
                )
                return { success: false, error: error.message }
            }
        },
    )

    // Remove instance
    ipcMain.handle(
        "remove-instance",
        async (event, { itemId, instanceIndex }) => {
            try {
                // Find the item in any loaded package
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) {
                    throw new Error("Item not found")
                }

                item.removeInstance(instanceIndex)

                // Send updated item data to frontend
                const updatedItem = item.toJSON()
                console.log("Sending updated item after remove instance:", {
                    id: updatedItem.id,
                    instances: updatedItem.instances,
                })
                mainWindow.webContents.send("item-updated", updatedItem)
                sendItemUpdateToEditor(itemId, updatedItem)

                return { success: true }
            } catch (error) {
                dialog.showErrorBox(
                    "Failed to Remove Instance",
                    `Could not remove instance: ${error.message}`,
                )
                return { success: false, error: error.message }
            }
        },
    )

    // Input management handlers
    ipcMain.handle("get-inputs", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, inputs: item.getInputs() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle(
        "add-input",
        async (event, { itemId, inputName, inputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.addInput(inputName, inputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Add Input", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle(
        "update-input",
        async (event, { itemId, inputName, inputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.updateInput(inputName, inputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Update Input", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle("remove-input", async (event, { itemId, inputName }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            item.removeInput(inputName)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Remove Input", error.message)
            return { success: false, error: error.message }
        }
    })

    // Output management handlers
    ipcMain.handle("get-outputs", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, outputs: item.getOutputs() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle(
        "add-output",
        async (event, { itemId, outputName, outputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.addOutput(outputName, outputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Add Output", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle(
        "update-output",
        async (event, { itemId, outputName, outputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.updateOutput(outputName, outputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Update Output", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle("remove-output", async (event, { itemId, outputName }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            item.removeOutput(outputName)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Remove Output", error.message)
            return { success: false, error: error.message }
        }
    })

    // Get entities from item instances for UI dropdowns
    ipcMain.handle("get-item-entities", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const allEntities = {}

            // Get entities from all valid instances only
            for (const [instanceIndex, instanceData] of Object.entries(
                item.instances,
            )) {
                // Only process instances that actually exist
                if (!item.instanceExists(instanceIndex)) {
                    continue
                }

                const instance = item.getInstance(instanceIndex)
                if (instance) {
                    const entities = instance.getAllEntities()

                    // Merge entities (Object.assign handles duplicates by overwriting)
                    Object.assign(allEntities, entities)
                }
            }

            return { success: true, entities: allEntities }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Get valid instances only (for UI filtering)
    ipcMain.handle("get-valid-instances", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const validInstances = item.getValidInstances()
            return { success: true, instances: validInstances }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Get Portal 2 FGD data for entity inputs/outputs
    ipcMain.handle("get-fgd-data", async (event) => {
        try {
            const resources = await findPortal2Resources()
            if (!resources || !resources.entities) {
                return {
                    success: false,
                    error: "Portal 2 FGD data not available",
                }
            }

            return { success: true, entities: resources.entities }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Metadata management handlers
    ipcMain.handle("get-item-metadata", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, metadata: item.getMetadata() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle(
        "update-item-metadata",
        async (event, { itemId, metadata }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                const success = item.updateMetadata(metadata)
                if (success) {
                    // Send updated item to frontend
                    const updatedItem = item.toJSON()
                    mainWindow.webContents.send("item-updated", updatedItem)
                    sendItemUpdateToEditor(itemId, updatedItem)
                }

                return { success }
            } catch (error) {
                dialog.showErrorBox("Failed to Update Metadata", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    // Register instance editing in Hammer
    ipcMain.handle(
        "edit-instance",
        async (event, { packagePath, instanceName, itemId }) => {
            try {
                const hammerStatus = getHammerAvailability()
                if (!hammerStatus.available) {
                    throw new Error(
                        "Neither Hammer++ nor Hammer was found in Portal 2's bin directory",
                    )
                }

                // Find the item to get all its instances
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) {
                    throw new Error("Item not found")
                }

                // Build absolute path to instance file
                // Apply path fixing to remove BEE2/ prefix for actual file structure
                const actualInstancePath = fixInstancePath(instanceName)
                const instancePath = path.normalize(
                    Instance.getCleanPath(packagePath, actualInstancePath),
                )

                // Verify the path is within the package resources directory
                const resourcesDir = path.normalize(
                    path.join(packagePath, "resources"),
                )
                if (!instancePath.startsWith(resourcesDir)) {
                    throw new Error(
                        `Invalid instance path: ${instancePath} (must be within package resources directory)`,
                    )
                }

                if (!fs.existsSync(instancePath)) {
                    throw new Error(`Instance file not found: ${instancePath}`)
                }

                // Launch Hammer with the instance file
                const hammer = spawn(getHammerPath(), [instancePath], {
                    detached: true,
                    stdio: "ignore",
                })

                hammer.unref()

                return { success: true, editorType: hammerStatus.type }
            } catch (error) {
                const errorMessage = `Could not open instance in Hammer: ${error.message}`
                dialog.showErrorBox("Failed to Launch Hammer", errorMessage)
                return { success: false, error: errorMessage }
            }
        },
    )
}

module.exports = { reg_events }
