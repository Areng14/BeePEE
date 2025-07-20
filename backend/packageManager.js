const { dialog, ipcMain } = require("electron")
const { Package } = require("./models/package")
const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")
const path7za = require("7zip-bin").path7za
const { extractFull } = require("node-7z")

var packages = []

// Helper function to convert VDF to JSON
function convertVdfToJson(filePath) {
    const rawData = fs.readFileSync(filePath, "utf-8")
    let emptyKeyCounter = 0
    const fixedData = rawData.replace(
        /""\s+"/g,
        () => `"desc_${emptyKeyCounter++}" "`,
    )
    return vdf.parse(fixedData)
}

// Helper function to recursively process VDF files
function processVdfFiles(directory) {
    const files = fs.readdirSync(directory)
    
    for (const file of files) {
        const fullPath = path.join(directory, file)
        const stat = fs.statSync(fullPath)
        
        if (stat.isDirectory()) {
            // Recursively process subdirectories
            processVdfFiles(fullPath)
        } else if (file.endsWith('.txt')) {
            // Convert VDF to JSON
            const jsonData = convertVdfToJson(fullPath)
            
            // Save as JSON file (same name but .json extension)
            const jsonPath = fullPath.replace('.txt', '.json')
            fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 4))
            
            // Delete the original .txt file
            fs.unlinkSync(fullPath)
        }
    }
}

const unloadPackage = async (packageName, remove = false) => {
    const index = packages.findIndex((pkg) => pkg.name === packageName)
    if (index !== -1) {
        if (remove) {
            const pkg = packages[index]
            // Delete the extracted files if remove is true
            if (pkg.packageDir && fs.existsSync(pkg.packageDir)) {
                fs.rmSync(pkg.packageDir, { recursive: true, force: true })
            }
        }
        return packages.splice(index, 1)[0]
    }
}

const importPackage = async (pathToPackage) => {
    try {
        // Create temporary package to get paths
        const tempPkg = new Package(pathToPackage)
        
        // Extract package
        fs.mkdirSync(tempPkg.packageDir, { recursive: true })

        const stream = extractFull(pathToPackage, tempPkg.packageDir, {
            $bin: path7za,
            recursive: true,
        })

        await new Promise((resolve, reject) => {
            stream.on("end", resolve)
            stream.on("error", reject)
        })

        const infoPath = path.join(tempPkg.packageDir, "info.txt")
        if (!fs.existsSync(infoPath)) {
            throw new Error("Package missing info.txt file")
        }

        // Process all VDF files recursively
        processVdfFiles(tempPkg.packageDir)

        return true
    } catch (error) {
        console.error("Failed to import package:", error.message)

        // Cleanup on failure
        if (tempPkg?.packageDir && fs.existsSync(tempPkg.packageDir)) {
            try {
                fs.rmSync(tempPkg.packageDir, { recursive: true, force: true })
                console.log("Cleaned up failed package directory")
            } catch (cleanupError) {
                console.error(
                    "Failed to cleanup package directory:",
                    cleanupError.message,
                )
            }
        }

        dialog.showErrorBox(
            "Package Import Failed",
            `Failed to import package ${path.parse(pathToPackage).name}: ${error.message}`,
        )

        throw error
    }
}

const loadPackage = async (pathToPackage) => {
    try {
        // Create package instance
        const pkg = new Package(pathToPackage)
        
        // Check if we need to import first
        const infoJsonPath = path.join(pkg.packageDir, "info.json")
        const infoTxtPath = path.join(pkg.packageDir, "info.txt")
        
        if (!fs.existsSync(infoJsonPath)) {
            if (fs.existsSync(infoTxtPath)) {
                // Need to import first
                await importPackage(pathToPackage)
            } else {
                throw new Error("Package not found or not imported")
            }
        }

        // Now load the package
        await pkg.load()
        packages.push(pkg)
        return pkg
    } catch (error) {
        console.error("Failed to load package:", error)
        throw error
    }
}

const reg_loadPackagePopup = () => {
    ipcMain.handle("dialog:loadPackage", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
        })

        if (result.canceled) return null

        const pkg = await loadPackage(result.filePaths[0])
        return pkg.items // return the package's items
    })
}

module.exports = {
    reg_loadPackagePopup,
    loadPackage,
    importPackage,
    unloadPackage,
    packages,
}
