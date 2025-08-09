const fs = require("fs")
const path = require("path")
const {
    convertImageToVTF,
    getVTFPathFromImagePath,
    updateEditorItemsWithVTF,
} = require("./utils/vtfConverter")

/**
 * Handles VTF conversion for palette images referenced in editoritems.json
 * @param {Object} editorItems - The editoritems JSON object
 * @param {string} iconPath - Path to the icon file that was just saved
 * @param {string} packagePath - Path to the package directory
 * @param {string} editorItemsPath - Path to the editoritems.json file
 */
async function handleVTFConversion(
    editorItems,
    iconPath,
    packagePath,
    editorItemsPath,
) {
    const editor = editorItems.Item?.Editor
    if (!editor?.SubType) return

    const subType = Array.isArray(editor.SubType)
        ? editor.SubType[0]
        : editor.SubType
    const paletteImage = subType?.Palette?.Image

    if (!paletteImage) return

    console.log(`Found palette image reference: ${paletteImage}`)

    // Check if this is a palette image path that needs VTF conversion
    // Handle both original palette paths and already-converted material paths
    const needsVTFConversion =
        paletteImage.startsWith("palette/") ||
        paletteImage.startsWith("models/props_map_editor/palette/")

    if (needsVTFConversion) {
        // For already-converted paths, extract the original palette path
        let originalPalettePath = paletteImage
        if (paletteImage.startsWith("models/props_map_editor/")) {
            // Convert "models/props_map_editor/palette/beepkg/item" back to "palette/beepkg/item.png"
            originalPalettePath =
                paletteImage.replace("models/props_map_editor/", "") + ".png"
        }
        try {
            // Get the VTF output path using the original palette path
            const vtfPath = getVTFPathFromImagePath(
                packagePath,
                originalPalettePath,
            )

            // Convert the icon to VTF format
            await convertImageToVTF(iconPath, vtfPath, {
                format: "DXT5",
                generateMipmaps: true,
            })

            // Update the editoritems.json to reference the VTF path instead of the palette image
            const updatedEditorItems = updateEditorItemsWithVTF(
                editorItemsPath,
                originalPalettePath,
                vtfPath,
                packagePath,
            )

            // Update the editorItems object that will be saved
            if (updatedEditorItems.Item?.Editor?.SubType) {
                const updatedSubType = Array.isArray(
                    updatedEditorItems.Item.Editor.SubType,
                )
                    ? updatedEditorItems.Item.Editor.SubType[0]
                    : updatedEditorItems.Item.Editor.SubType

                if (Array.isArray(editor.SubType)) {
                    editor.SubType[0].Palette = updatedSubType.Palette
                } else {
                    editor.SubType.Palette = updatedSubType.Palette
                }
            }

            console.log(
                `Successfully converted and updated VTF reference: ${vtfPath}`,
            )
        } catch (error) {
            console.error(
                `Failed to handle VTF conversion for ${paletteImage}:`,
                error,
            )
            throw error
        }
    }
}

async function saveItem(item) {
    // Get the item's editor items and properties files
    const editorItemsPath = path.join(item.fullItemPath, "editoritems.json")
    const propertiesPath = path.join(item.fullItemPath, "properties.json")

    // Check if files exist
    if (!fs.existsSync(editorItemsPath)) {
        throw new Error(`Editor items file not found: ${editorItemsPath}`)
    }
    if (!fs.existsSync(propertiesPath)) {
        throw new Error(`Properties file not found: ${propertiesPath}`)
    }

    // Read current files
    let editorItems, properties
    try {
        editorItems = JSON.parse(fs.readFileSync(editorItemsPath, "utf-8"))
    } catch (error) {
        throw new Error(`Failed to read editor items: ${error.message}`)
    }

    try {
        properties = JSON.parse(fs.readFileSync(propertiesPath, "utf-8"))
    } catch (error) {
        throw new Error(`Failed to read properties: ${error.message}`)
    }

    // Validate file structure
    if (!editorItems?.Item?.Editor?.SubType) {
        throw new Error("Invalid editor items format")
    }
    if (!properties?.Properties) {
        throw new Error("Invalid properties format")
    }

    // Update editor items
    if (Array.isArray(editorItems.Item.Editor.SubType)) {
        editorItems.Item.Editor.SubType[0].Name = item.name
    } else {
        editorItems.Item.Editor.SubType.Name = item.name
    }

    // Update properties
    properties.Properties = {
        ...properties.Properties,
        ...item.details,
    }

    // Handle staged icon if provided
    if (item.iconData && item.iconData.stagedIconPath) {
        try {
            const stagedIconPath = item.iconData.stagedIconPath
            const stagedIconName = item.iconData.stagedIconName

            if (fs.existsSync(stagedIconPath)) {
                const fileExt = path.extname(stagedIconName).toLowerCase()

                // Get the current icon path or create a new one
                const packagePath = path.dirname(
                    path.dirname(item.fullItemPath),
                )
                let targetIconPath

                // Check if item already has an icon
                const currentIconPath = properties.Properties.Icon?.["0"]
                if (currentIconPath) {
                    // Replace existing icon - keep same directory but update extension if needed
                    const bee2ItemsPath = path.join(
                        packagePath,
                        "resources",
                        "BEE2",
                        "items",
                    )
                    const currentFullPath = path.join(
                        bee2ItemsPath,
                        currentIconPath,
                    )
                    const currentDir = path.dirname(currentFullPath)
                    const currentBaseName = path.basename(
                        currentFullPath,
                        path.extname(currentFullPath),
                    )
                    targetIconPath = path.join(
                        currentDir,
                        currentBaseName + fileExt,
                    )

                    // Delete the old icon file if it's different from the new target
                    if (
                        currentFullPath !== targetIconPath &&
                        fs.existsSync(currentFullPath)
                    ) {
                        fs.unlinkSync(currentFullPath)
                    }
                } else {
                    // Create new icon path - use item name as filename in the BEE2/items structure
                    const iconDir = path.join(
                        packagePath,
                        "resources",
                        "BEE2",
                        "items",
                        "beepkg",
                    )
                    if (!fs.existsSync(iconDir)) {
                        fs.mkdirSync(iconDir, { recursive: true })
                    }
                    const safeItemName = item.name
                        .replace(/[^a-zA-Z0-9_-]/g, "_")
                        .toLowerCase()
                    targetIconPath = path.join(iconDir, safeItemName + fileExt)
                }

                // Copy the staged icon file to the target location
                fs.copyFileSync(stagedIconPath, targetIconPath)

                // Update the properties file with the new icon path (relative to resources/BEE2/items/)
                const bee2ItemsPath = path.join(
                    packagePath,
                    "resources",
                    "BEE2",
                    "items",
                )
                const relativePath = path.relative(
                    bee2ItemsPath,
                    targetIconPath,
                )

                if (!properties.Properties.Icon) properties.Properties.Icon = {}
                properties.Properties.Icon["0"] = relativePath.replace(
                    /\\/g,
                    "/",
                )

                console.log(
                    `Icon updated: ${stagedIconPath} -> ${targetIconPath}`,
                )

                // Also convert to VTF and update editoritems.json if the item uses palette images
                try {
                    await handleVTFConversion(
                        editorItems,
                        targetIconPath,
                        packagePath,
                        editorItemsPath,
                    )
                } catch (error) {
                    console.error("Failed to convert icon to VTF:", error)
                    // Don't throw here - let the save continue even if VTF conversion fails
                }
            } else {
                console.warn(`Staged icon file not found: ${stagedIconPath}`)
            }
        } catch (error) {
            console.error("Failed to process staged icon:", error)
            // Don't throw here - let the save continue even if icon fails
        }
    }

    // Save the files
    try {
        fs.writeFileSync(editorItemsPath, JSON.stringify(editorItems, null, 4))
        fs.writeFileSync(propertiesPath, JSON.stringify(properties, null, 4))

        // Update metadata lastModified timestamp if item has metadata
        if (item.metadata) {
            const metaPath = path.join(item.fullItemPath, "meta.json")
            if (fs.existsSync(metaPath)) {
                try {
                    const metadata = JSON.parse(
                        fs.readFileSync(metaPath, "utf-8"),
                    )
                    metadata.lastModified = new Date().toISOString()
                    fs.writeFileSync(
                        metaPath,
                        JSON.stringify(metadata, null, 4),
                    )
                } catch (error) {
                    console.warn(
                        "Failed to update metadata timestamp:",
                        error.message,
                    )
                }
            }
        }
    } catch (error) {
        throw new Error(`Failed to write files: ${error.message}`)
    }

    return { editorItems, properties }
}

module.exports = { saveItem }
