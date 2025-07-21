const { dialog, ipcMain } = require("electron")
const { Package } = require("./models/package")
const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")
const path7za = require("7zip-bin").path7za
const { extractFull } = require("node-7z")
const { add } = require("node-7z")
const { timeOperation } = require("./utils/timing")

var packages = []

// Helper function to convert VDF to JSON
function convertVdfToJson(filePath) {
    const rawData = fs.readFileSync(filePath, "utf-8")
    let emptyKeyCounter = 0

    // Split into lines and process each line
    const lines = rawData.split("\n")
    const fixedLines = lines.map((line) => {
        return line.replace(/^(\s*)""\s+(".*")/, (match, indent, value) => {
            return `${indent}"desc_${emptyKeyCounter++}" ${value}`
        })
    })

    return vdf.parse(fixedLines.join("\n"))
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
        } else if (file.endsWith(".txt")) {
            // Convert VDF to JSON
            const jsonData = convertVdfToJson(fullPath)

            // Save as JSON file (same name but .json extension)
            const jsonPath = fullPath.replace(/\.txt$/i, ".json")
            fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 4))

            // Delete the original .txt file
            fs.unlinkSync(fullPath)
        } else if (file.endsWith(".vmx")) {
            // Delete .vmx files (not needed)
            fs.unlinkSync(fullPath)
        } else if (file === "editoritems.json") {
            // Ensure instance paths in editoritems.json use .vmf extension
            const jsonData = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
            if (jsonData.Item?.Exporting?.Instances) {
                for (const instance of Object.values(jsonData.Item.Exporting.Instances)) {
                    if (instance.Name) {
                        // Ensure instance paths use .vmf extension
                        instance.Name = instance.Name.replace(/\.json$/i, '.vmf')
                    }
                }
                fs.writeFileSync(fullPath, JSON.stringify(jsonData, null, 4))
            }
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

const extractPackage = async (pathToPackage, packageDir) => {
    console.log("Extracting package...")
    const stream = extractFull(pathToPackage, packageDir, {
        $bin: path7za,
        recursive: true,
    })

    await new Promise((resolve, reject) => {
        stream.on("end", resolve)
        stream.on("error", reject)
    })
    console.log("Extraction complete")
}

const importPackage = async (pathToPackage) => {
    return timeOperation("Import package", async () => {
        let tempPkg = null
        try {
            tempPkg = new Package(pathToPackage)

            // Extract package
            fs.mkdirSync(tempPkg.packageDir, { recursive: true })
            await extractPackage(pathToPackage, tempPkg.packageDir)

            // Process all VDF files recursively
            await timeOperation("Process VDF files", () => {
                processVdfFiles(tempPkg.packageDir)
                return Promise.resolve()
            })

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
    })
}

const loadPackage = async (pathToPackage) => {
    return timeOperation("Load package", async () => {
        try {
            // Create package instance
            const pkg = new Package(pathToPackage)

            // Check if the package file exists
            if (!fs.existsSync(pathToPackage)) {
                throw new Error(`Package file ${pathToPackage} does not exist`)
            }

            // Always extract fresh
            fs.mkdirSync(pkg.packageDir, { recursive: true })
            await extractPackage(pathToPackage, pkg.packageDir)

            // Process all VDF files recursively (convert .txt to .json)
            await timeOperation("Process VDF files", () => {
                processVdfFiles(pkg.packageDir)
                return Promise.resolve()
            })

            // Now load the package
            await pkg.load()
            packages.push(pkg)
            return pkg
        } catch (error) {
            console.error("Failed to load package:", error)
            throw error
        }
    })
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

/**
 * Zips a package directory into a .bpee file using 7zip.
 * @param {string} packageDir - The directory to zip.
 * @param {string} outputBpeePath - The output .bpee file path.
 * @returns {Promise<void>} Resolves when done, rejects on error.
 */
function savePackageAsBpee(packageDir, outputBpeePath) {
    return new Promise((resolve, reject) => {
        const fs = require("fs")
        const path = require("path")
        // Ensure output directory exists
        const outDir = path.dirname(outputBpeePath)
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true })
        }
        // Use 7z to zip the directory
        const archiveStream = add(
            outputBpeePath,
            [packageDir + path.sep + "*"], // Add all contents, not the folder itself
            { $bin: path7za, recursive: true },
        )
        archiveStream.on("end", resolve)
        archiveStream.on("error", reject)
    })
}

/**
 * Clears all contents of the packages directory at the project root.
 * @returns {Promise<void>} Resolves when done, rejects on error.
 */
async function clearPackagesDirectory() {
    const packagesDir = path.resolve(__dirname, '../packages')
    if (fs.existsSync(packagesDir)) {
        const entries = fs.readdirSync(packagesDir)
        for (const entry of entries) {
            const entryPath = path.join(packagesDir, entry)
            fs.rmSync(entryPath, { recursive: true, force: true })
        }
    }
}

const closePackage = async () => {
    // Remove all packages from memory
    packages.length = 0
    return true
}

module.exports = {
    reg_loadPackagePopup,
    loadPackage,
    importPackage,
    unloadPackage,
    packages,
    savePackageAsBpee,
    clearPackagesDirectory,
    closePackage, // Export the new function
}
