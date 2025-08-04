// VTF conversion using MareTF (MIT License)
const fs = require("fs")
const path = require("path")
const { exec } = require("child_process")
const { promisify } = require("util")
const { app } = require("electron")

const execAsync = promisify(exec)

// Helper to get MareTF path for Electron
function getMareTFPath() {
    const isDev = !app.isPackaged

    console.log("isDev:", isDev)
    console.log("__dirname:", __dirname)

    const maretfPath = isDev
        ? path.join(__dirname, "..", "libs", "maretf", "maretf.exe")
        : path.join(
              process.resourcesPath,
              "extraResources",
              "maretf",
              "maretf.exe",
          )

    console.log("Looking for MareTF at:", maretfPath)
    console.log("MareTF exists:", fs.existsSync(maretfPath))

    return maretfPath
}

/**
 * Converts an image file to VTF format using MareTF
 * @param {string} imagePath - Path to the source image file
 * @param {string} outputPath - Path where the VTF file should be saved
 * @param {Object} options - Conversion options
 * @returns {Promise<void>}
 */
async function convertImageToVTF(imagePath, outputPath, options = {}) {
    try {
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath)
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        // Remove existing VTF file if it exists to ensure clean overwrite
        if (fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath)
                console.log(`Removed existing VTF file: ${outputPath}`)
            } catch (removeError) {
                console.warn(
                    `Failed to remove existing VTF file: ${removeError.message}`,
                )
                // Continue anyway - MareTF might still be able to overwrite
            }
        }

        // Try MareTF first if available
        const maretfPath = getMareTFPath()

        if (fs.existsSync(maretfPath)) {
            try {
                // Build MareTF command with faster options
                const format = options.format || "DXT1" // DXT1 is faster than DXT5
                const version = options.version || "7.4"

                // Add speed optimizations
                const command = `"${maretfPath}" create "${imagePath}" -o "${outputPath}" --format "${format}" --version "${version}" --filter BOX --no-mips --quiet`

                console.log(`Running MareTF: ${command}`)
                const { stdout, stderr } = await execAsync(command, {
                    timeout: 60000,
                }) // 60 second timeout

                // MareTF uses stderr for some normal output, so check if file was actually created
                if (fs.existsSync(outputPath)) {
                    console.log(
                        `Successfully converted ${imagePath} to VTF format: ${outputPath}`,
                    )
                    return
                } else {
                    throw new Error(
                        `MareTF failed to create VTF file: ${stderr || "Unknown error"}`,
                    )
                }
            } catch (maretfError) {
                console.error(
                    `MareTF conversion failed: ${maretfError.message}`,
                )
                throw new Error(
                    `VTF conversion required but MareTF failed: ${maretfError.message}`,
                )
            }
        } else {
            throw new Error(
                "MareTF not found - VTF conversion is required for Source engine compatibility",
            )
        }

        // If we get here, VTF conversion failed and Source engine needs VTF files
        throw new Error(
            "VTF conversion failed - Source engine requires VTF format for textures",
        )
    } catch (error) {
        console.error(`VTF conversion failed: ${error.message}`)
        throw error // Don't fallback to PNG since Source engine won't accept it
    }
}

/**
 * Converts palette image path to materials path structure
 * @param {string} packagePath - Path to the package directory
 * @param {string} imagePath - The image path from editoritems.json (e.g., "palette/beepkg/preplaced_gel.png")
 * @returns {string} - Full path to where the material file should be saved
 */
function getVTFPathFromImagePath(packagePath, imagePath) {
    // Keep the palette/ structure but change extension to .vtf
    const cleanPath = imagePath.replace(/\.[^.]+$/, ".vtf")

    // Build the full materials path: [package]/resources/materials/models/props_map_editor/[cleanPath]
    return path.join(
        packagePath,
        "resources",
        "materials",
        "models",
        "props_map_editor",
        cleanPath,
    )
}

/**
 * Updates editoritems.json file to point to the material file instead of the original image
 * @param {string} editorItemsPath - Path to editoritems.json
 * @param {string} originalImagePath - Original image path (e.g., "palette/beepkg/preplaced_gel.png")
 * @param {string} materialPath - Path to the material file (could be .vtf, .tga, or .png)
 * @returns {Object} - Updated editoritems object
 */
function updateEditorItemsWithVTF(
    editorItemsPath,
    originalImagePath,
    materialPath,
    packagePath,
) {
    if (!fs.existsSync(editorItemsPath)) {
        throw new Error(`Editor items file not found: ${editorItemsPath}`)
    }

    const editorItems = JSON.parse(fs.readFileSync(editorItemsPath, "utf-8"))

    // Determine which file actually exists (.vtf, .tga, or .png)
    let actualMaterialPath = materialPath
    const basePathWithoutExt = materialPath.replace(/\.[^.]+$/, "")

    // Check for VTF first (preferred), then TGA, then PNG
    const vtfPath = basePathWithoutExt + ".vtf"
    const tgaPath = basePathWithoutExt + ".tga"
    const pngPath = basePathWithoutExt + ".png"

    if (fs.existsSync(vtfPath)) {
        actualMaterialPath = vtfPath
    } else if (fs.existsSync(tgaPath)) {
        actualMaterialPath = tgaPath
    } else if (fs.existsSync(pngPath)) {
        actualMaterialPath = pngPath
    }

    // Get relative path from materials directory
    const materialsPath = path.join(packagePath, "resources", "materials")
    const relativeMaterialPath = path
        .relative(materialsPath, actualMaterialPath)
        .replace(/\\/g, "/")

    // Remove file extension for the path reference (Source engine adds the extension automatically)
    const referencePath = relativeMaterialPath.replace(/\.(vtf|tga|png)$/, "")

    // Update the Image path in the Palette section
    const editor = editorItems.Item?.Editor
    if (editor?.SubType) {
        const subType = Array.isArray(editor.SubType)
            ? editor.SubType[0]
            : editor.SubType

        // Check if this is a palette image path that needs VTF conversion
        if (
            subType?.Palette?.Image &&
            subType.Palette.Image.startsWith("palette/")
        ) {
            // Convert palette path to materials path (keep palette/ structure)
            const cleanPath = subType.Palette.Image.replace(/\.[^.]+$/, "")
            const materialsReferencePath = `models/props_map_editor/${cleanPath}`

            subType.Palette.Image = materialsReferencePath
            console.log(
                `Updated Image path from ${originalImagePath} to ${materialsReferencePath}`,
            )
        }
    }

    return editorItems
}

module.exports = {
    convertImageToVTF,
    getVTFPathFromImagePath,
    updateEditorItemsWithVTF,
}
