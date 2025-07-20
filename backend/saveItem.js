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
        ...item.details
    }

    // Save the files
    try {
        fs.writeFileSync(editorItemsPath, JSON.stringify(editorItems, null, 4))
        fs.writeFileSync(propertiesPath, JSON.stringify(properties, null, 4))
    } catch (error) {
        throw new Error(`Failed to write files: ${error.message}`)
    }

    return { editorItems, properties }
}

module.exports = { saveItem } 