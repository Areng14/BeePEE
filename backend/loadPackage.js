const fs = require("fs")
const vdf = require("vdf-parser")
const path = require("path")
const path7za = require('7zip-bin').path7za
const { extractFull } = require('node-7z')
const { dialog, ipcMain } = require("electron")
const { addItem, removeAllItems, items } = require("./models/items")

const loadPackage = async (pathToPackage) => {
    let packageDir = null

    try {
        // Extract package
        const packageName = path.parse(pathToPackage).name
        packageDir = path.join(__dirname, "..", "packages", packageName)
        fs.mkdirSync(packageDir, { recursive: true })

        const stream = extractFull(pathToPackage, packageDir, {
            $bin: path7za,
            recursive: true
        })

        await new Promise((resolve, reject) => {
            stream.on('end', resolve)
            stream.on('error', reject)
        })

        const infoPath = path.join(packageDir, "info.txt")

        if (!fs.existsSync(infoPath)) {
            throw new Error("Package missing info.txt file")
        }

        const rawInfo = fs.readFileSync(infoPath, "utf-8")
        let emptyKeyCounter = 0
        const fixedInfo = rawInfo.replace(
            /""\s+"/g,
            () => `"desc_${emptyKeyCounter++}" "`,
        )
        const parsedInfo = vdf.parse(fixedInfo)

        // Items
        // Remove existing items
        removeAllItems()

        // Add new ones
        const rawitems = parsedInfo["Item"]
        if (!rawitems || !Array.isArray(rawitems)) {
            throw new Error("Invalid package format - no items found")
        }

        rawitems.forEach((element) => {
            addItem(packageDir, element)
        })

        return items
    } catch (error) {
        console.error("Failed to load package:", error.message)

        // Cleanup on failure
        if (packageDir && fs.existsSync(packageDir)) {
            try {
                fs.rmSync(packageDir, { recursive: true, force: true })
                console.log("Cleaned up failed package directory")
            } catch (cleanupError) {
                console.error(
                    "Failed to cleanup package directory:",
                    cleanupError.message,
                )
            }
        }

        // Reset items state
        removeAllItems()

        dialog.showErrorBox(
            "Package Load Failed",
            `Failed to load package ${path.parse(pathToPackage).name}: ${error.message}`,
        )
    }
}

const reg_loadPackagePopup = () => {
    ipcMain.handle("dialog:loadPackage", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
        })

        if (result.canceled) return null

        //Load the package
        await loadPackage(result.filePaths[0])
        return items
    })
}

module.exports = { reg_loadPackagePopup, loadPackage }
