/**
 * Portal 2 resources, FGD data, and file utility handlers
 */

const fs = require("fs")
const path = require("path")
const { setExtraResourcePaths, getExtraResourcePaths } = require("../utils/vmf2obj")
const { findPortal2Resources } = require("../data")

function register(ipcMain, mainWindow) {
    // Allow configuring extra resource paths (folders or VPKs)
    ipcMain.handle("set-extra-resource-paths", async (event, { paths }) => {
        try {
            setExtraResourcePaths(paths)
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("get-extra-resource-paths", async () => {
        try {
            const paths = getExtraResourcePaths()
            return { success: true, paths }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("find-portal2-resources", async () => {
        try {
            const resources = await findPortal2Resources(console)
            return { success: true, ...resources }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Get Portal 2 installation status
    ipcMain.handle("get-portal2-status", async () => {
        try {
            const resources = await findPortal2Resources(console)

            // Check if Portal 2 is installed and what features are available
            const isInstalled = resources !== null && resources.root !== null

            return {
                success: true,
                isInstalled,
                features: {
                    modelGeneration: isInstalled && resources.root !== null,
                    autopacking: isInstalled && resources.root !== null,
                    fgdData: isInstalled && resources.entities !== null,
                    hammerEditor: isInstalled && resources.hammer !== null,
                },
                portal2Path: resources?.root || null,
            }
        } catch (error) {
            return {
                success: true,
                isInstalled: false,
                features: {
                    modelGeneration: false,
                    autopacking: false,
                    fgdData: false,
                    hammerEditor: false,
                },
                portal2Path: null,
            }
        }
    })

    // Get Portal 2 FGD data for entity inputs/outputs
    ipcMain.handle("get-fgd-data", async () => {
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

    // Get file stats (size, modified date, etc.)
    ipcMain.handle("get-file-stats", async (event, { filePath }) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: "File not found" }
            }
            const stats = fs.statSync(filePath)
            return {
                success: true,
                size: stats.size,
                modified: stats.mtime,
                created: stats.ctime,
            }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Show file in file explorer
    ipcMain.handle("show-item-in-folder", async (event, { filePath }) => {
        try {
            const { shell } = require("electron")
            if (!fs.existsSync(filePath)) {
                // If file doesn't exist, show the directory instead
                const dir = path.dirname(filePath)
                if (fs.existsSync(dir)) {
                    shell.showItemInFolder(dir)
                    return { success: true }
                } else {
                    return { success: false, error: "Directory not found" }
                }
            }
            shell.showItemInFolder(filePath)
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })
}

module.exports = { register }
