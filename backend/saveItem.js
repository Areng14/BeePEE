const fs = require("fs")
const path = require("path")

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
