/**
 * Model name, metadata, and save handlers
 */

const { dialog, BrowserWindow } = require("electron")
const fs = require("fs")
const path = require("path")
const { packages } = require("../packageManager")
const { sendItemUpdateToEditor } = require("../items/itemEditor")
const { handleItemSave } = require("./shared")

function register(ipcMain, mainWindow) {
    // Save item handler
    // Note: Frontend passes itemData directly (not wrapped in object)
    ipcMain.handle("save-item", async (event, itemData) => {
        return handleItemSave(itemData, event, mainWindow)
    })

    // Model name management handlers
    ipcMain.handle("get-model-name", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, modelName: item.getModelName() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("save-model-name", async (event, { itemId, modelName }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const success = item.setModelName(modelName)
            if (!success) {
                throw new Error("Failed to save model name to editoritems.json")
            }

            const updatedItem = item.toJSONWithExistence()
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Save Model Name", error.message)
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
                    const updatedItem = item.toJSONWithExistence()
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

    // Instance metadata handler
    ipcMain.handle(
        "get-instance-metadata",
        async (event, { itemId, instanceIndex }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                const metadata = item.getInstanceMetadata(instanceIndex)
                return { success: true, metadata }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },
    )

    // Save staged editoritems (from model generation)
    ipcMain.handle("save-staged-editoritems", async (event, { itemId, stagedEditorItems, hasObjFiles = false }) => {
        try {
            console.log(`🔍 save-staged-editoritems called with:`)
            console.log(`   itemId: ${itemId}`)
            console.log(`   hasObjFiles: ${hasObjFiles}`)
            console.log(`   stagedEditorItems: ${stagedEditorItems ? 'provided' : 'null'}`)

            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            if (!stagedEditorItems) {
                throw new Error("No staged editoritems provided")
            }

            item.saveEditorItems(stagedEditorItems)
            console.log(`✅ Saved staged editoritems for item: ${item.name}`)

            // Check if a custom model was added
            const subType = stagedEditorItems?.Item?.Editor?.SubType
            const subTypes = Array.isArray(subType) ? subType : [subType]

            console.log(`🔍 Checking ${subTypes.length} SubType(s) for custom model`)

            let hasValidCustomModel = false
            for (const st of subTypes) {
                console.log(`   SubType Model: ${JSON.stringify(st?.Model)}`)
                if (!st?.Model?.ModelName) {
                    console.log(`   ⏭️ Skipping SubType - no ModelName`)
                    continue
                }

                const modelName = st.Model.ModelName
                console.log(`   ModelName: ${modelName}`)
                console.log(`   Starts with 'bpee/': ${typeof modelName === 'string' && modelName.startsWith('bpee/')}`)

                if (typeof modelName === 'string' && modelName.startsWith('bpee/')) {
                    // Model files are stored in props_map_editor/bpee/... but editoritems references bpee/...
                    const modelPath = path.join(item.packagePath, "resources", "models", "props_map_editor", modelName)
                    console.log(`   Full model path: ${modelPath}`)
                    console.log(`   File exists: ${fs.existsSync(modelPath)}`)
                    console.log(`   hasObjFiles: ${hasObjFiles}`)

                    if (fs.existsSync(modelPath) && hasObjFiles) {
                        hasValidCustomModel = true
                        console.log(`✅ Found custom model file: ${modelPath} (OBJ files confirmed)`)
                        break
                    } else if (fs.existsSync(modelPath) && !hasObjFiles) {
                        console.log(`⚠️ Model file exists but no OBJ files found - not marking as custom model: ${modelPath}`)
                    } else {
                        console.log(`⚠️ Custom model path found in editoritems but file doesn't exist: ${modelPath}`)
                    }
                }
            }

            console.log(`🔍 hasValidCustomModel result: ${hasValidCustomModel}`)

            if (hasValidCustomModel) {
                item.updateMetadata({ hasCustomModel: true })
                console.log(`✅ Updated meta.json: marked item as having custom model`)
            } else {
                console.log(`⚠️ Not marking as custom model - conditions not met`)
            }

            const updatedItem = item.toJSONWithExistence()
            console.log(`📤 Sending item-updated with metadata:`, updatedItem.metadata)
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true }
        } catch (error) {
            console.error("Failed to save staged editoritems:", error)
            return { success: false, error: error.message }
        }
    })

    // Copy staged model/material files from .bpee/ to resources/
    ipcMain.handle("copy-staged-model-files", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const packagePath = item.packagePath
            const stagingDir = path.join(packagePath, ".bpee")

            if (!fs.existsSync(stagingDir)) {
                console.log("No staged files found, skipping copy")
                return { success: true, copied: false }
            }

            console.log(`📋 Copying staged files from .bpee/ to resources/...`)

            // Copy staged models
            const stagedModelsDir = path.join(stagingDir, "models")
            if (fs.existsSync(stagedModelsDir)) {
                const targetModelsDir = path.join(packagePath, "resources", "models")
                copyRecursive(stagedModelsDir, targetModelsDir, packagePath)
            }

            // Copy staged materials
            const stagedMaterialsDir = path.join(stagingDir, "materials")
            if (fs.existsSync(stagedMaterialsDir)) {
                const targetMaterialsDir = path.join(packagePath, "resources", "materials")
                copyRecursive(stagedMaterialsDir, targetMaterialsDir, packagePath)
            }

            // Check if OBJ files exist in .bpee/{itemName}/models/
            const itemName = item.id.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()
            const objModelsDir = path.join(stagingDir, itemName, "models")
            let hasObjFiles = false

            if (fs.existsSync(objModelsDir)) {
                const files = fs.readdirSync(objModelsDir)
                hasObjFiles = files.some(file => file.endsWith('.obj'))
                if (hasObjFiles) {
                    console.log(`✅ Found OBJ files in ${objModelsDir}`)
                }
            }
            console.log(`   hasObjFiles: ${hasObjFiles}`)

            // Clean up staging directory after successful copy
            console.log(`🧹 Cleaning up staging directory...`)
            if (fs.existsSync(stagedModelsDir)) {
                fs.rmSync(stagedModelsDir, { recursive: true, force: true })
            }
            if (fs.existsSync(stagedMaterialsDir)) {
                fs.rmSync(stagedMaterialsDir, { recursive: true, force: true })
            }
            // Clean up tempmdl directory if it exists
            const tempmdlDir = path.join(stagingDir, "tempmdl")
            if (fs.existsSync(tempmdlDir)) {
                fs.rmSync(tempmdlDir, { recursive: true, force: true })
            }

            console.log(`✅ Staged files copied successfully`)
            return { success: true, copied: true, hasObjFiles }
        } catch (error) {
            console.error("Failed to copy staged files:", error)
            return { success: false, error: error.message }
        }
    })
}

/**
 * Recursively copy files from source to destination
 */
function copyRecursive(src, dest, packagePath) {
    if (!fs.existsSync(src)) return

    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true })
        }
        for (const file of fs.readdirSync(src)) {
            copyRecursive(path.join(src, file), path.join(dest, file), packagePath)
        }
    } else {
        fs.copyFileSync(src, dest)
        console.log(`  Copied: ${path.relative(packagePath, dest)}`)
    }
}

module.exports = { register }
