const { dialog, ipcMain } = require("electron")
const { Package } = require("./models/package")
const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")
const path7za = require("7zip-bin").path7za
const { extractFull } = require("node-7z")
const { add } = require("node-7z")
const { timeOperation } = require("./utils/timing")
const { vmfStatsCache } = require("./utils/vmfParser")

// Global reference to main window for progress updates
let mainWindow = null

// Helper function to send progress updates
function sendProgressUpdate(progress, message, error = null) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("package-loading-progress", {
            progress,
            message,
            error,
        })
    }
}

var packages = []

// Helper function to check if a file is a VDF file
function isVdfFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, "utf-8")
        const lines = content.split("\n")

        // Check if the file contains VDF-like content
        // VDF files typically start with a key and have opening/closing braces
        let hasVdfStructure = false
        let braceCount = 0

        for (const line of lines) {
            const trimmedLine = line.trim()

            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith("//")) {
                continue
            }

            // Count braces to check for VDF structure
            if (trimmedLine.includes("{")) {
                braceCount++
                hasVdfStructure = true
            }
            if (trimmedLine.includes("}")) {
                braceCount--
            }

            // If we find a line that looks like a VDF key (no spaces around =, or just a key)
            if (
                trimmedLine.includes("=") ||
                (trimmedLine &&
                    !trimmedLine.includes(" ") &&
                    !trimmedLine.includes("\t"))
            ) {
                hasVdfStructure = true
            }
        }

        // File is VDF if it has VDF structure and balanced braces
        return hasVdfStructure && braceCount === 0
    } catch (error) {
        // If we can't read the file, assume it's not a VDF file
        return false
    }
}

// Helper function to convert VDF to JSON
function convertVdfToJson(filePath) {
    try {
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
    } catch (error) {
        // Extract item name from file path for better error reporting
        const fileName = path.basename(filePath, ".txt")
        const itemName = fileName.replace(/\.txt$/i, "")

        throw new Error(
            `[${itemName} : ${path.basename(filePath)}]: ${error.message}`,
        )
    }
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
            // Only process files that are actually VDF files
            if (isVdfFile(fullPath)) {
                try {
                    // Convert VDF to JSON
                    const jsonData = convertVdfToJson(fullPath)

                    // Save as JSON file (same name but .json extension)
                    const jsonPath = fullPath.replace(/\.txt$/i, ".json")
                    fs.writeFileSync(
                        jsonPath,
                        JSON.stringify(jsonData, null, 4),
                    )

                    // Delete the original .txt file
                    fs.unlinkSync(fullPath)
                } catch (error) {
                    // The error already contains the file context from convertVdfToJson
                    throw error
                }
            }
            // Skip non-VDF .txt files (like README.txt)
        } else if (file.endsWith(".vmx")) {
            // Delete .vmx files (not needed)
            fs.unlinkSync(fullPath)
        } else if (file === "editoritems.json") {
            // Ensure instance paths in editoritems.json use .vmf extension
            const jsonData = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
            if (jsonData.Item?.Exporting?.Instances) {
                for (const instance of Object.values(
                    jsonData.Item.Exporting.Instances,
                )) {
                    if (instance.Name) {
                        // Ensure instance paths use .vmf extension
                        instance.Name = instance.Name.replace(
                            /\.json$/i,
                            ".vmf",
                        )
                    }
                }
                fs.writeFileSync(fullPath, JSON.stringify(jsonData, null, 4))
            }
        }
    }
}

// Helper function to update VMF stats for all instances in a package
const updateVMFStatsForPackage = async (packageDir) => {
    return timeOperation("Update VMF stats", async () => {
        try {
            // Find all editoritems.json files in the package
            const findEditorItemsFiles = (dir) => {
                const files = []
                const items = fs.readdirSync(dir)

                for (const item of items) {
                    const fullPath = path.join(dir, item)
                    const stat = fs.statSync(fullPath)

                    if (stat.isDirectory()) {
                        files.push(...findEditorItemsFiles(fullPath))
                    } else if (item === "editoritems.json") {
                        files.push(fullPath)
                    }
                }

                return files
            }

            const editorItemsFiles = findEditorItemsFiles(packageDir)
            let updatedFiles = 0

            if (editorItemsFiles.length > 0) {
                sendProgressUpdate(
                    75,
                    `Analyzing ${editorItemsFiles.length} item files...`,
                )

                for (let i = 0; i < editorItemsFiles.length; i++) {
                    const editorItemsPath = editorItemsFiles[i]
                    const progress =
                        75 + Math.floor((i / editorItemsFiles.length) * 20)
                    sendProgressUpdate(
                        progress,
                        `Analyzing item ${i + 1}/${editorItemsFiles.length}...`,
                    )

                    try {
                        const editorItems = JSON.parse(
                            fs.readFileSync(editorItemsPath, "utf-8"),
                        )
                        let hasChanges = false

                        if (editorItems.Item?.Exporting?.Instances) {
                            for (const [index, instance] of Object.entries(
                                editorItems.Item.Exporting.Instances,
                            )) {
                                if (instance.Name) {
                                    // Check if this is a VMF file (not VBSP)
                                    const isVbspInstance =
                                        instance.Name.includes(
                                            "instances/bee2_dev",
                                        )
                                    if (!isVbspInstance) {
                                        // Build the full path to the VMF file
                                        const instancePath =
                                            instance.Name.replace(
                                                /^instances\/BEE2\//,
                                                "instances/",
                                            )
                                        const fullInstancePath = path.join(
                                            packageDir,
                                            "resources",
                                            instancePath,
                                        )

                                        if (fs.existsSync(fullInstancePath)) {
                                            // Always get VMF stats on import (don't check if they already exist)
                                            const vmfStats =
                                                vmfStatsCache.getStats(
                                                    fullInstancePath,
                                                )
                                            console.log(
                                                `Raw VMF stats for ${instance.Name}:`,
                                                vmfStats,
                                            )

                                            // Always update the instance data with current stats
                                            const updatedInstance = {
                                                ...instance,
                                                EntityCount:
                                                    vmfStats.EntityCount || 0,
                                                BrushCount:
                                                    vmfStats.BrushCount || 0,
                                                BrushSideCount:
                                                    vmfStats.BrushSideCount ||
                                                    0,
                                            }
                                            editorItems.Item.Exporting.Instances[
                                                index
                                            ] = updatedInstance
                                            hasChanges = true
                                            console.log(
                                                `Updated VMF stats for ${instance.Name}: ${updatedInstance.EntityCount} entities, ${updatedInstance.BrushCount} brushes, ${updatedInstance.BrushSideCount} brush sides`,
                                            )
                                            console.log(
                                                `Saved instance data:`,
                                                updatedInstance,
                                            )
                                        } else {
                                            console.warn(
                                                `VMF file not found: ${fullInstancePath}`,
                                            )
                                        }
                                    }
                                }
                            }

                            if (hasChanges) {
                                fs.writeFileSync(
                                    editorItemsPath,
                                    JSON.stringify(editorItems, null, 4),
                                )
                                updatedFiles++
                            }
                        }
                    } catch (error) {
                        const itemName = path.basename(
                            path.dirname(editorItemsPath),
                        )
                        console.warn(
                            `[${itemName} : editoritems.json]: Failed to update VMF stats - ${error.message}`,
                        )
                    }
                }
            }

            if (updatedFiles > 0) {
                console.log(
                    `Updated VMF stats in ${updatedFiles} editoritems.json files`,
                )
            }
        } catch (error) {
            console.error(
                `[package : ${path.basename(packageDir)}]: Failed to update VMF stats - ${error.message}`,
            )
        }
    })
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
        stream.on("error", (error) => {
            reject(
                new Error(
                    `[package : ${path.basename(pathToPackage)}]: Extraction failed - ${error.message}`,
                ),
            )
        })
    })
    console.log("Extraction complete")
}

const importPackage = async (pathToPackage) => {
    return timeOperation("Import package", async () => {
        let tempPkg = null
        try {
            sendProgressUpdate(0, "Starting package import...")

            tempPkg = new Package(pathToPackage)
            sendProgressUpdate(10, "Preparing package directory...")

            // Extract package - wipe existing directory first
            if (fs.existsSync(tempPkg.packageDir)) {
                fs.rmSync(tempPkg.packageDir, { recursive: true, force: true })
                console.log(
                    "Wiped existing package directory before import extraction",
                )
            }
            fs.mkdirSync(tempPkg.packageDir, { recursive: true })

            sendProgressUpdate(20, "Extracting package files...")
            await extractPackage(pathToPackage, tempPkg.packageDir)

            sendProgressUpdate(50, "Processing VDF files...")
            // Process all VDF files recursively
            await timeOperation("Process VDF files", () => {
                processVdfFiles(tempPkg.packageDir)
                return Promise.resolve()
            })

            sendProgressUpdate(70, "Analyzing VMF files...")
            // Update VMF stats for all instances in the package
            await updateVMFStatsForPackage(tempPkg.packageDir)

            // Don't send 100% here since we're continuing to load
            return true
        } catch (error) {
            console.error("Failed to import package:", error.message)

            // Send error to frontend
            sendProgressUpdate(100, "Package import failed!", error.message)

            // Cleanup on failure
            if (tempPkg?.packageDir && fs.existsSync(tempPkg.packageDir)) {
                try {
                    fs.rmSync(tempPkg.packageDir, {
                        recursive: true,
                        force: true,
                    })
                    console.log("Cleaned up failed package directory")
                } catch (cleanupError) {
                    console.error(
                        "Failed to cleanup package directory:",
                        cleanupError.message,
                    )
                }
            }

            // Don't show error dialog since we're already showing it in the loading popup
            // dialog.showErrorBox(
            //     "Package Import Failed",
            //     `Failed to import package ${path.parse(pathToPackage).name}: ${error.message}`,
            // )

            throw error
        }
    })
}

const loadPackage = async (pathToPackage, skipProgressReset = false) => {
    return timeOperation("Load package", async () => {
        try {
            if (!skipProgressReset) {
                sendProgressUpdate(0, "Starting package load...")
            }

            // Create package instance
            const pkg = new Package(pathToPackage)
            if (!skipProgressReset) {
                sendProgressUpdate(10, "Preparing package directory...")
            }

            // Check if the package file exists
            if (!fs.existsSync(pathToPackage)) {
                throw new Error(
                    `[package : ${path.basename(pathToPackage)}]: Package file does not exist`,
                )
            }

            // Always extract fresh - wipe existing directory first
            if (fs.existsSync(pkg.packageDir)) {
                fs.rmSync(pkg.packageDir, { recursive: true, force: true })
                console.log(
                    "Wiped existing package directory before extraction",
                )
            }
            fs.mkdirSync(pkg.packageDir, { recursive: true })

            if (!skipProgressReset) {
                sendProgressUpdate(20, "Extracting package files...")
            }
            await extractPackage(pathToPackage, pkg.packageDir)

            if (!skipProgressReset) {
                sendProgressUpdate(50, "Processing VDF files...")
            }
            // Process all VDF files recursively (convert .txt to .json)
            await timeOperation("Process VDF files", () => {
                processVdfFiles(pkg.packageDir)
                return Promise.resolve()
            })

            if (!skipProgressReset) {
                sendProgressUpdate(80, "Loading package data...")
            }
            // Now load the package
            await pkg.load()
            packages.push(pkg)

            // Update window title with package name
            if (global.titleManager) {
                global.titleManager.setCurrentPackage(pathToPackage)
            }

            if (!skipProgressReset) {
                sendProgressUpdate(100, "Package loaded successfully!")
            }
            return pkg
        } catch (error) {
            console.error("Failed to load package:", error)

            // Send error to frontend
            sendProgressUpdate(100, "Package load failed!", error.message)

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
    const packagesDir = path.resolve(__dirname, "../packages")
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

    // Clear window title
    if (global.titleManager) {
        global.titleManager.clearPackage()
    }

    return true
}

// Function to set main window reference
const setMainWindow = (window) => {
    mainWindow = window
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
    setMainWindow,
}
