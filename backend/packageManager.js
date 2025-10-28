const { dialog, ipcMain } = require("electron")
const { Package } = require("./models/package")
const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")
const path7za = require("7zip-bin").path7za
const { extractFull } = require("node-7z")
const { add } = require("node-7z")
const { spawn } = require("child_process")
const { timeOperation } = require("./utils/timing")
const { vmfStatsCache } = require("./utils/vmfParser")

// Global reference to main window for progress updates
let mainWindow = null

// Track current package directory and last saved path
let currentPackageDir = null
let lastSavedBpeePath = null

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

// Helper function to add UUIDs to VBSP blocks that can have duplicates
function addUuidsToVbspConditions(data) {
    const generateUuid = () =>
        `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    function processObject(obj) {
        if (typeof obj !== "object" || obj === null) {
            return obj
        }

        const newObj = {}
        for (const [key, value] of Object.entries(obj)) {
            let newKey = key
            let newValue = value

            // Add UUID to blocks that can have multiple instances
            if (
                (key === "Switch" ||
                    key === "Condition" ||
                    key === "MapInstVar") &&
                typeof value === "object"
            ) {
                newKey = `${key}_${generateUuid()}`
                newValue =
                    typeof value === "object" ? processObject(value) : value
            } else {
                // Recursively process nested objects
                newValue =
                    typeof value === "object" ? processObject(value) : value
            }

            newObj[newKey] = newValue
        }

        return newObj
    }

    return processObject(data)
}

// Helper function to remove UUIDs from VBSP blocks for export
function removeUuidsFromVbspConditions(data) {
    function processObject(obj) {
        if (typeof obj !== "object" || obj === null) {
            return obj
        }

        const newObj = {}
        for (const [key, value] of Object.entries(obj)) {
            let newKey = key
            let newValue = value

            // Remove UUID suffix from blocks that were added during import
            if (
                key.startsWith("Switch_") ||
                key.startsWith("Condition_") ||
                key.startsWith("MapInstVar_")
            ) {
                // Extract the base key name (before the UUID)
                const baseKey = key.split("_")[0]
                newKey = baseKey
                newValue =
                    typeof value === "object" ? processObject(value) : value
            } else {
                // Recursively process nested objects
                newValue =
                    typeof value === "object" ? processObject(value) : value
            }

            newObj[newKey] = newValue
        }

        return newObj
    }

    return processObject(data)
}

// Helper function to check if an object is an array-like object (all keys are sequential numbers)
function isArrayLikeObject(obj) {
    const keys = Object.keys(obj)
    if (keys.length === 0) return false

    // Check if all keys are numeric strings
    const numericKeys = keys.map((k) => parseInt(k, 10))
    if (numericKeys.some((k) => isNaN(k))) return false

    // Check if keys are sequential starting from 0
    numericKeys.sort((a, b) => a - b)
    for (let i = 0; i < numericKeys.length; i++) {
        if (numericKeys[i] !== i) return false
    }

    return true
}

// Helper function to convert JSON to VDF format
function convertJsonToVdf(jsonData, indent = 0, parentKey = null) {
    const indentStr = "\t".repeat(indent)
    let vdfString = ""

    // Add BeePEE signature at the top of root-level files
    if (indent === 0) {
        vdfString += "//Generated by BeePEE (@https://github.com/Areng14/BeePEE )\n"
    }

    if (typeof jsonData !== "object" || jsonData === null) {
        return `"${jsonData}"`
    }

    // Check if this object represents an array (all keys are sequential numbers 0, 1, 2, ...)
    if (isArrayLikeObject(jsonData)) {
        // This is an array - write each element as a separate block with the parent key
        const sortedKeys = Object.keys(jsonData).sort(
            (a, b) => parseInt(a, 10) - parseInt(b, 10),
        )

        // Check if all values are simple (non-object) types
        const allSimpleValues = sortedKeys.every((key) => {
            const value = jsonData[key]
            return typeof value !== "object" || value === null
        })

        if (allSimpleValues && parentKey) {
            // For simple values with a parentKey (like Description or Icon),
            // wrap them in a block with the parent key
            for (const key of sortedKeys) {
                const value = jsonData[key]
                // Use empty string as key for desc_ prefixed keys, otherwise use the numeric key
                vdfString += `${indentStr}"${key}" "${value}"\n`
            }
        } else {
            // For object values, create separate blocks for each element
            for (const key of sortedKeys) {
                const value = jsonData[key]
                if (typeof value === "object" && value !== null) {
                    // Write array element as a separate block
                    // Use the parent key name for each array element
                    if (parentKey) {
                        vdfString += `${indentStr}"${parentKey}"\n${indentStr}{\n`
                        vdfString += convertJsonToVdf(value, indent + 1, null)
                        vdfString += `${indentStr}}\n`
                    }
                }
            }
        }
    } else {
        // Regular object - write key-value pairs
        for (const [key, value] of Object.entries(jsonData)) {
            // Handle desc_ keys - convert them back to empty string keys
            const vdfKey = key.startsWith("desc_") ? "" : key

            if (typeof value === "object" && value !== null) {
                // Check if the value is an array-like object
                if (isArrayLikeObject(value)) {
                    // Check if all values are simple types
                    const allSimple = Object.values(value).every(
                        (v) => typeof v !== "object" || v === null,
                    )

                    if (allSimple) {
                        // For simple values, write as a block with key-value pairs inside
                        vdfString += `${indentStr}"${vdfKey}"\n${indentStr}{\n`
                        const sortedKeys = Object.keys(value).sort(
                            (a, b) => parseInt(a, 10) - parseInt(b, 10),
                        )
                        for (const k of sortedKeys) {
                            // Handle desc_ prefix - convert to empty string
                            const innerKey = k.startsWith("desc_") ? "" : k
                            vdfString += `${"\t".repeat(indent + 1)}"${innerKey}" "${value[k]}"\n`
                        }
                        vdfString += `${indentStr}}\n`
                    } else if (vdfKey === "Instances") {
                        // Special handling for Instances: write as numbered sub-blocks
                        vdfString += `${indentStr}"${vdfKey}"\n${indentStr}{\n`
                        const sortedKeys = Object.keys(value).sort(
                            (a, b) => parseInt(a, 10) - parseInt(b, 10),
                        )
                        for (const k of sortedKeys) {
                            vdfString += `${"\t".repeat(indent + 1)}"${k}"\n${"\t".repeat(indent + 1)}{\n`
                            vdfString += convertJsonToVdf(
                                value[k],
                                indent + 2,
                                null,
                            )
                            vdfString += `${"\t".repeat(indent + 1)}}\n`
                        }
                        vdfString += `${indentStr}}\n`
                    } else if (vdfKey === "SubType") {
                        // Special handling for SubType array: write as repeated "SubType" keys
                        const sortedKeys = Object.keys(value).sort(
                            (a, b) => parseInt(a, 10) - parseInt(b, 10),
                        )
                        for (const k of sortedKeys) {
                            vdfString += `${indentStr}"${vdfKey}"\n${indentStr}{\n`
                            vdfString += convertJsonToVdf(
                                value[k],
                                indent + 1,
                                null,
                            )
                            vdfString += `${indentStr}}\n`
                        }
                    } else {
                        // For other array-like objects with object values, write with repeated parent key
                        vdfString += convertJsonToVdf(value, indent, vdfKey)
                    }
                } else {
                    // Nested object
                    vdfString += `${indentStr}"${vdfKey}"\n${indentStr}{\n`
                    vdfString += convertJsonToVdf(value, indent + 1, null)
                    vdfString += `${indentStr}}\n`
                }
            } else {
                // Simple key-value pair
                vdfString += `${indentStr}"${vdfKey}" "${value}"\n`
            }
        }
    }

    return vdfString
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

        const parsedData = vdf.parse(fixedLines.join("\n"))

        // Add UUIDs to VBSP condition keys if this is a vbsp_config file
        if (filePath.includes("vbsp_config")) {
            return addUuidsToVbspConditions(parsedData)
        }

        return parsedData
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
        } else if (
            file === "info.txt" ||
            file === "editoritems.txt" ||
            file === "properties.txt"
        ) {
            // Always convert these specific files to JSON
            try {
                // Convert VDF to JSON
                const jsonData = convertVdfToJson(fullPath)

                // Save as JSON file (same name but .json extension)
                const jsonPath = fullPath.replace(/\.txt$/i, ".json")
                fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 4))

                // Delete the original .txt file
                fs.unlinkSync(fullPath)
            } catch (error) {
                // The error already contains the file context from convertVdfToJson
                throw error
            }
        } else if (file === "vbsp_config.cfg") {
            // Convert vbsp_config.cfg to JSON
            try {
                // Convert VDF to JSON
                const jsonData = convertVdfToJson(fullPath)

                // Save as JSON file (same name but .json extension)
                const jsonPath = fullPath.replace(/\.cfg$/i, ".json")
                fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 4))

                // Delete the original .cfg file
                fs.unlinkSync(fullPath)
            } catch (error) {
                // The error already contains the file context from convertVdfToJson
                throw error
            }
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

// Helper function to recursively process JSON files back to VDF for export
function processJsonFilesToVdf(directory) {
    const files = fs.readdirSync(directory)

    for (const file of files) {
        const fullPath = path.join(directory, file)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
            // Recursively process subdirectories
            processJsonFilesToVdf(fullPath)
        } else if (file === "info.json") {
            // Convert info.json to info.txt
            try {
                const jsonData = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
                const vdfString = convertJsonToVdf(jsonData)
                const txtPath = fullPath.replace(/\.json$/i, ".txt")
                fs.writeFileSync(txtPath, vdfString)
                fs.unlinkSync(fullPath)
            } catch (error) {
                throw new Error(
                    `[${path.basename(directory)} : info.json]: ${error.message}`,
                )
            }
        } else if (file === "editoritems.json") {
            // Convert editoritems.json to editoritems.txt
            try {
                const jsonData = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
                const vdfString = convertJsonToVdf(jsonData)
                const txtPath = fullPath.replace(/\.json$/i, ".txt")
                fs.writeFileSync(txtPath, vdfString)
                fs.unlinkSync(fullPath)
            } catch (error) {
                throw new Error(
                    `[${path.basename(directory)} : editoritems.json]: ${error.message}`,
                )
            }
        } else if (file === "properties.json") {
            // Convert properties.json to properties.txt
            try {
                const jsonData = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
                const vdfString = convertJsonToVdf(jsonData)
                const txtPath = fullPath.replace(/\.json$/i, ".txt")
                fs.writeFileSync(txtPath, vdfString)
                fs.unlinkSync(fullPath)
            } catch (error) {
                throw new Error(
                    `[${path.basename(directory)} : properties.json]: ${error.message}`,
                )
            }
        } else if (file === "vbsp_config.json") {
            // Convert vbsp_config.json to vbsp_config.cfg
            try {
                let jsonData = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
                // Remove UUIDs from VBSP conditions before export
                jsonData = removeUuidsFromVbspConditions(jsonData)
                const vdfString = convertJsonToVdf(jsonData)
                const cfgPath = fullPath.replace(/\.json$/i, ".cfg")
                fs.writeFileSync(cfgPath, vdfString)
                fs.unlinkSync(fullPath)
            } catch (error) {
                throw new Error(
                    `[${path.basename(directory)} : vbsp_config.json]: ${error.message}`,
                )
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
    console.log("Extracting package from:", pathToPackage)
    console.log("Extracting to:", packageDir)

    const stream = extractFull(pathToPackage, packageDir, {
        $bin: path7za,
        recursive: true,
    })

    // Log extraction progress
    stream.on("progress", (progress) => {
        console.log("Extraction progress:", progress.percent + "%")
    })

    stream.on("data", (data) => {
        console.log("Extracted:", data.file)
    })

    await new Promise((resolve, reject) => {
        stream.on("end", () => {
            console.log("Extraction stream ended successfully")
            resolve()
        })
        stream.on("error", (error) => {
            console.error("Extraction error details:", error)
            reject(
                new Error(
                    `[package : ${path.basename(pathToPackage)}]: Extraction failed - ${error.message || error}`,
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
            console.log("Importing package from:", pathToPackage)

            // Validate that the file exists and is an archive
            if (!fs.existsSync(pathToPackage)) {
                throw new Error(`Package file not found: ${pathToPackage}`)
            }

            const ext = path.extname(pathToPackage).toLowerCase()
            if (ext !== ".bee_pack" && ext !== ".zip") {
                throw new Error(
                    `Invalid package format. Expected .bee_pack or .zip, got: ${ext}`,
                )
            }

            sendProgressUpdate(0, "Starting package import...")

            tempPkg = new Package(pathToPackage)
            console.log("Package name:", tempPkg.name)
            console.log("Package will be extracted to:", tempPkg.packageDir)

            sendProgressUpdate(10, "Preparing package directory...")

            // Extract package - wipe existing directory first
            if (fs.existsSync(tempPkg.packageDir)) {
                console.log(
                    "Removing existing package directory:",
                    tempPkg.packageDir,
                )
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

            // Check if the package file exists
            if (!fs.existsSync(pathToPackage)) {
                throw new Error(
                    `[package : ${path.basename(pathToPackage)}]: Package file does not exist`,
                )
            }

            // Determine if we're loading from an already-extracted package (info.json) or an archive
            const isInfoJson = path.basename(pathToPackage) === "info.json"

            let pkg
            let packageDir

            if (isInfoJson) {
                // Loading from already-extracted package directory
                console.log(
                    "Loading from already-extracted package:",
                    pathToPackage,
                )
                packageDir = path.dirname(pathToPackage)

                // Create a temporary Package instance just to get the packageDir path structure
                // We'll use the actual directory path instead
                pkg = new Package(pathToPackage)
                pkg.packageDir = packageDir // Override with the actual directory

                if (!skipProgressReset) {
                    sendProgressUpdate(50, "Loading extracted package...")
                }
            } else {
                // Loading from archive - need to extract
                console.log("Loading from archive:", pathToPackage)

                // Create package instance
                pkg = new Package(pathToPackage)
                packageDir = pkg.packageDir

                if (!skipProgressReset) {
                    sendProgressUpdate(10, "Preparing package directory...")
                }

                // Always extract fresh - wipe existing directory first
                if (fs.existsSync(packageDir)) {
                    fs.rmSync(packageDir, { recursive: true, force: true })
                    console.log(
                        "Wiped existing package directory before extraction",
                    )
                }
                fs.mkdirSync(packageDir, { recursive: true })

                if (!skipProgressReset) {
                    sendProgressUpdate(20, "Extracting package files...")
                }
                await extractPackage(pathToPackage, packageDir)

                if (!skipProgressReset) {
                    sendProgressUpdate(50, "Processing VDF files...")
                }
                // Process all VDF files recursively (convert .txt to .json)
                await timeOperation("Process VDF files", () => {
                    processVdfFiles(packageDir)
                    return Promise.resolve()
                })
            }

            if (!skipProgressReset) {
                sendProgressUpdate(80, "Loading package data...")
            }

            // Close existing package
            await closePackage()
            currentPackageDir = null
            lastSavedBpeePath = null
            mainWindow.webContents.send("package:closed")

            // Now load the package
            await pkg.load()
            packages.push(pkg)

            // Set the current package directory
            currentPackageDir = pkg.packageDir

            // Update window title with package name
            if (global.titleManager) {
                global.titleManager.setCurrentPackage(pkg.name)
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
            filters: [
                {
                    name: "BeePEE Package",
                    extensions: ["bpee"],
                },
            ],
        })

        if (result.canceled) return null

        const pkg = await loadPackage(result.filePaths[0])

        // Send package loaded event to main window
        if (mainWindow) {
            mainWindow.webContents.send(
                "package:loaded",
                pkg.items.map((item) => item.toJSONWithExistence()),
            )
        }

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

        // Delete existing file if it exists
        if (fs.existsSync(outputBpeePath)) {
            fs.unlinkSync(outputBpeePath)
        }

        // Use 7z command directly to create ZIP format
        // Command: 7za a -tzip output.bpee packageDir\*
        const args = [
            "a", // add to archive
            "-tzip", // use ZIP format
            "-r", // recursive
            outputBpeePath,
            path.join(packageDir, "*"),
        ]

        const process = spawn(path7za, args)

        let errorOutput = ""
        process.stderr.on("data", (data) => {
            errorOutput += data.toString()
        })

        process.on("close", (code) => {
            if (code === 0) {
                resolve()
            } else {
                reject(
                    new Error(`7zip failed with code ${code}: ${errorOutput}`),
                )
            }
        })

        process.on("error", (error) => {
            reject(error)
        })
    })
}

/**
 * Exports a package directory as a .bee_pack file using 7zip.
 * Converts all JSON files back to VDF format before archiving.
 * @param {string} packageDir - The directory to export.
 * @param {string} outputBeePackPath - The output .bee_pack file path.
 * @returns {Promise<void>} Resolves when done, rejects on error.
 */
async function exportPackageAsBeePack(packageDir, outputBeePackPath) {
    return timeOperation("Export package", async () => {
        // Create a temporary directory for the export
        const tempExportDir = path.join(
            path.dirname(packageDir),
            `${path.basename(packageDir)}_export_temp`,
        )

        try {
            sendProgressUpdate(0, "Starting package export...")

            // Copy the package directory to a temporary location
            if (fs.existsSync(tempExportDir)) {
                fs.rmSync(tempExportDir, { recursive: true, force: true })
            }

            sendProgressUpdate(10, "Copying package files...")

            // Recursively copy directory
            const copyDir = (src, dest) => {
                fs.mkdirSync(dest, { recursive: true })
                const entries = fs.readdirSync(src, { withFileTypes: true })

                for (const entry of entries) {
                    // Skip temp_models directory - it's only used for local model generation
                    if (entry.name === "temp_models") {
                        console.log(
                            "Skipping temp_models directory during export",
                        )
                        continue
                    }

                    const srcPath = path.join(src, entry.name)
                    const destPath = path.join(dest, entry.name)

                    if (entry.isDirectory()) {
                        copyDir(srcPath, destPath)
                    } else {
                        fs.copyFileSync(srcPath, destPath)
                    }
                }
            }

            copyDir(packageDir, tempExportDir)

            sendProgressUpdate(40, "Converting JSON files to VDF format...")

            // Convert all JSON files back to VDF
            processJsonFilesToVdf(tempExportDir)

            sendProgressUpdate(70, "Creating .bee_pack archive...")

            // Ensure output directory exists
            const outDir = path.dirname(outputBeePackPath)
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true })
            }

            // Zip the temporary directory as .bee_pack (must be ZIP format)
            // Delete existing file if it exists
            if (fs.existsSync(outputBeePackPath)) {
                fs.unlinkSync(outputBeePackPath)
            }

            await new Promise((resolve, reject) => {
                // Use 7z command directly to create ZIP format
                // Command: 7za a -tzip output.bee_pack tempDir\*
                const args = [
                    "a", // add to archive
                    "-tzip", // use ZIP format
                    "-r", // recursive
                    outputBeePackPath,
                    path.join(tempExportDir, "*"),
                ]

                const process = spawn(path7za, args)

                let errorOutput = ""
                process.stderr.on("data", (data) => {
                    errorOutput += data.toString()
                })

                process.on("close", (code) => {
                    if (code === 0) {
                        resolve()
                    } else {
                        reject(
                            new Error(
                                `7zip failed with code ${code}: ${errorOutput}`,
                            ),
                        )
                    }
                })

                process.on("error", (error) => {
                    reject(error)
                })
            })

            sendProgressUpdate(90, "Cleaning up temporary files...")

            // Clean up temporary directory
            fs.rmSync(tempExportDir, { recursive: true, force: true })

            sendProgressUpdate(100, "Package exported successfully!")
        } catch (error) {
            console.error("Failed to export package:", error.message)

            // Send error to frontend
            sendProgressUpdate(100, "Package export failed!", error.message)

            // Clean up temporary directory on error
            if (fs.existsSync(tempExportDir)) {
                try {
                    fs.rmSync(tempExportDir, { recursive: true, force: true })
                } catch (cleanupError) {
                    console.error(
                        "Failed to cleanup export directory:",
                        cleanupError.message,
                    )
                }
            }

            throw error
        }
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

// Getter for currentPackageDir
const getCurrentPackageDir = () => currentPackageDir

module.exports = {
    reg_loadPackagePopup,
    loadPackage,
    importPackage,
    unloadPackage,
    packages,
    Package,
    savePackageAsBpee,
    exportPackageAsBeePack,
    clearPackagesDirectory,
    closePackage,
    setMainWindow,
    getCurrentPackageDir,
    convertJsonToVdf,
}
