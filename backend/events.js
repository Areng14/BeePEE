const { reg_loadPackagePopup, packages } = require("./packageManager")
const { createItemEditor } = require("./items/itemEditor")
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
            return { success: true, index: newIndex }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Add Instance",
                `Could not add instance: ${error.message}`
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
