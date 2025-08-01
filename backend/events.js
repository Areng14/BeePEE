const { reg_loadPackagePopup, packages } = require("./packageManager")
const { createItemEditor, sendItemUpdateToEditor } = require("./items/itemEditor")
const { ipcMain, dialog, BrowserWindow } = require("electron")
const fs = require("fs")
const path = require("path")
const { saveItem } = require("./saveItem") // Import the new saveItem function
const { Item } = require("./models/items") // Import the Item class
const { savePackageAsBpee } = require("./packageManager")
const { findPortal2Resources, getHammerPath, getHammerAvailability } = require("./data")
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
    findPortal2Resources().catch(error => {
        console.error("Failed to find Portal 2 resources:", error)
    })

    // Register package loading
    reg_loadPackagePopup()

    // Register item editor opening
    ipcMain.handle("open-item-editor", async (event, item) => {
        createItemEditor(item, mainWindow)
    })

    // Register item saving
    ipcMain.handle("save-item", async (event, itemData) => {
        return handleItemSave(itemData, event, mainWindow)
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
        } catch (err) {
            dialog.showErrorBox("Save As Failed", err.message)
        }
    })

    // Add instance
    ipcMain.handle("add-instance", async (event, { itemId, instanceName }) => {
        try {
            // Find the item in any loaded package
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            const newIndex = item.addInstance(instanceName)
            
            // Send updated item data to frontend
            const updatedItem = item.toJSON()
            console.log('Sending updated item after add instance:', {
                id: updatedItem.id,
                instances: updatedItem.instances
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)
            
            return { success: true, index: newIndex }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Add Instance",
                `Could not add instance: ${error.message}`
            )
            return { success: false, error: error.message }
        }
    })

    // Helper function to fix instance paths by removing BEE2/ prefix
    function fixInstancePath(instancePath) {
        if (instancePath.startsWith('instances/BEE2/')) {
            return instancePath.replace('instances/BEE2/', 'instances/')
        }
        if (instancePath.startsWith('instances/bee2/')) {
            return instancePath.replace('instances/bee2/', 'instances/')
        }
        return instancePath
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
                for (const [index, instanceData] of Object.entries(editoritems.Item.Exporting.Instances)) {
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
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
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
                        extensions: ["vmf"]
                    },
                    {
                        name: "All Files",
                        extensions: ["*"]
                    }
                ]
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)
            
            // Check if it's a VMF file
            if (!fileName.toLowerCase().endsWith('.vmf')) {
                throw new Error("Selected file must be a VMF file")
            }

            // Always save new instances in the instances/ directory directly
            // Strip out BEE2/ from the path if it exists
            let instanceName = path.join("instances", fileName)
            
            // If the original file was in a BEE2 subdirectory, preserve the rest of the path
            const selectedDir = path.dirname(selectedFilePath)
            const pathParts = selectedDir.split(path.sep)
            
            // Find the index of 'BEE2' in the path
            const bee2Index = pathParts.findIndex(part => part.toLowerCase() === 'bee2')
            
            if (bee2Index !== -1) {
                // Remove BEE2 from the path and get everything after it
                const pathAfterBee2 = pathParts.slice(bee2Index + 1)
                if (pathAfterBee2.length > 0) {
                    // Reconstruct the path without BEE2
                    instanceName = path.join("instances", ...pathAfterBee2, fileName)
                }
            }
            
            // Copy the file to the package resources directory
            const targetPath = path.join(item.packagePath, "resources", instanceName)
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
            console.log('Sending updated item after file dialog add instance:', {
                id: updatedItem.id,
                instances: updatedItem.instances
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)
            
            return { success: true, index: newIndex, instanceName: instanceName }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Add Instance",
                `Could not add instance: ${error.message}`
            )
            return { success: false, error: error.message }
        }
    })

    // Replace instance with file dialog
    ipcMain.handle("replace-instance-file-dialog", async (event, { itemId, instanceIndex }) => {
        try {
            // Find the item in any loaded package
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
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
                        extensions: ["vmf"]
                    },
                    {
                        name: "All Files",
                        extensions: ["*"]
                    }
                ]
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)
            
            // Check if it's a VMF file
            if (!fileName.toLowerCase().endsWith('.vmf')) {
                throw new Error("Selected file must be a VMF file")
            }

            // Get the current instance file path
            const currentInstancePath = Instance.getCleanPath(item.packagePath, instanceData.Name)
            
            // Copy the new file over the existing one
            fs.copyFileSync(selectedFilePath, currentInstancePath)

            // Clear the cached instance so it gets reloaded
            item._loadedInstances.delete(instanceIndex)
            
            // Send updated item data to frontend
            const updatedItem = item.toJSON()
            console.log('Sending updated item after replace instance:', {
                id: updatedItem.id,
                instances: updatedItem.instances
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)
            
            return { success: true, instanceName: instanceData.Name }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Replace Instance",
                `Could not replace instance: ${error.message}`
            )
            return { success: false, error: error.message }
        }
    })

    // Remove instance
    ipcMain.handle("remove-instance", async (event, { itemId, instanceIndex }) => {
        try {
            // Find the item in any loaded package
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            item.removeInstance(instanceIndex)
            
            // Send updated item data to frontend
            const updatedItem = item.toJSON()
            console.log('Sending updated item after remove instance:', {
                id: updatedItem.id,
                instances: updatedItem.instances
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)
            
            return { success: true }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Remove Instance",
                `Could not remove instance: ${error.message}`
            )
            return { success: false, error: error.message }
        }
    })

    // Input management handlers
    ipcMain.handle("get-inputs", async (event, { itemId }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            return { success: true, inputs: item.getInputs() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("add-input", async (event, { itemId, inputName, inputConfig }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            item.addInput(inputName, inputConfig)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Add Input", error.message)
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("update-input", async (event, { itemId, inputName, inputConfig }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            item.updateInput(inputName, inputConfig)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Update Input", error.message)
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("remove-input", async (event, { itemId, inputName }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
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
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            return { success: true, outputs: item.getOutputs() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("add-output", async (event, { itemId, outputName, outputConfig }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            item.addOutput(outputName, outputConfig)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Add Output", error.message)
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("update-output", async (event, { itemId, outputName, outputConfig }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            item.updateOutput(outputName, outputConfig)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Update Output", error.message)
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("remove-output", async (event, { itemId, outputName }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
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
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            const allEntities = {}
            
            // Get entities from all instances
            for (const [instanceIndex, instanceData] of Object.entries(item.instances)) {
                const instance = item.getInstance(instanceIndex)
                if (instance) {
                    // Check if instance file actually exists
                    if (!require('fs').existsSync(instance.path)) {
                        continue
                    }
                    
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

    // Get Portal 2 FGD data for entity inputs/outputs
    ipcMain.handle("get-fgd-data", async (event) => {
        try {
            const resources = await findPortal2Resources()
            if (!resources || !resources.entities) {
                return { success: false, error: "Portal 2 FGD data not available" }
            }
            
            return { success: true, entities: resources.entities }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Metadata management handlers
    ipcMain.handle("get-item-metadata", async (event, { itemId }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) throw new Error("Item not found")
            
            return { success: true, metadata: item.getMetadata() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("update-item-metadata", async (event, { itemId, metadata }) => {
        try {
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
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
    })

    // Register instance editing in Hammer
    ipcMain.handle("edit-instance", async (event, { packagePath, instanceName, itemId }) => {
        try {
            const hammerStatus = getHammerAvailability()
            if (!hammerStatus.available) {
                throw new Error("Neither Hammer++ nor Hammer was found in Portal 2's bin directory")
            }

            // Find the item to get all its instances
            const item = packages.flatMap(p => p.items).find(i => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            // Build absolute path to instance file
            const instancePath = path.normalize(Instance.getCleanPath(packagePath, instanceName))
            
            // Verify the path is within the package resources directory
            const resourcesDir = path.normalize(path.join(packagePath, "resources"))
            if (!instancePath.startsWith(resourcesDir)) {
                throw new Error(`Invalid instance path: ${instancePath} (must be within package resources directory)`)
            }

            if (!fs.existsSync(instancePath)) {
                throw new Error(`Instance file not found: ${instancePath}`)
            }

            // Launch Hammer with the instance file
            const hammer = spawn(getHammerPath(), [instancePath], {
                detached: true,
                stdio: 'ignore'
            })
            
            hammer.unref()

            return { success: true, editorType: hammerStatus.type }
        } catch (error) {
            const errorMessage = `Could not open instance in Hammer: ${error.message}`
            dialog.showErrorBox(
                "Failed to Launch Hammer",
                errorMessage
            )
            return { success: false, error: errorMessage }
        }
    })
}

module.exports = { reg_events }
