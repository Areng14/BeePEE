/**
 * Property handlers - inputs, outputs, variables, entities
 */

const { dialog } = require("electron")
const { packages } = require("../packageManager")
const { sendItemUpdateToEditor } = require("../items/itemEditor")

function register(ipcMain, mainWindow) {
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
                    Object.assign(allEntities, entities)
                }
            }

            return { success: true, entities: allEntities }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Variables management handlers
    ipcMain.handle("get-variables", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, variables: item.getVariables() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("save-variables", async (event, { itemId, variables }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const success = item.saveVariables(variables)
            if (!success) {
                throw new Error("Failed to save variables to editoritems.json")
            }

            // Send updated item data to frontend
            const updatedItem = item.toJSONWithExistence()
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Save Variables", error.message)
            return { success: false, error: error.message }
        }
    })

    // Instance names handlers
    ipcMain.handle("get-instance-names", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)

            if (!item) {
                throw new Error(`Item ${itemId} not found`)
            }

            const names = item.getInstanceNames()
            return { success: true, names }
        } catch (error) {
            console.error("Error getting instance names:", error)
            return { success: false, error: error.message }
        }
    })
}

module.exports = { register }
