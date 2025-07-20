const fs = require("fs")
const path = require("path")
const { Instance } = require("../items/Instance")

class Item {
    constructor({ packagePath, itemJSON }) {
        this.packagePath = packagePath
        this.id = itemJSON.ID

        //get item folder from styles
        const styles = itemJSON.Version?.Styles || {}
        let folder =
            styles.BEE2_CLEAN || styles.ANY_STYLE || Object.values(styles)[0]

        //handle both string and object folder formats
        if (typeof folder === "object") {
            // Find any property that looks like "folder" (case insensitive)
            const folderKey = Object.keys(folder).find(
                (key) => key.toLowerCase() === "folder",
            )
            if (folderKey) {
                folder = folder[folderKey]
            }
        }

        if (!folder) {
            throw new Error(`No item folder found for item ${this.id}`)
        }

        const fullItemPath = path.join(
            this.packagePath,
            "items",
            folder.toLowerCase(),
        )

        //Paths (now using .json instead of .txt)
        this.paths = {
            editorItems: path.join(fullItemPath, "editoritems.json"),
            properties: path.join(fullItemPath, "properties.json"),
        }

        //If there is vbsp add it (keeping .cfg as it's not VDF)
        if (fs.existsSync(path.join(fullItemPath, "vbsp_config.cfg"))) {
            this.paths.vbsp_config = path.join(fullItemPath, "vbsp_config.cfg")
        }

        //parse editoritems file
        if (!fs.existsSync(this.paths.editorItems)) {
            throw new Error("Missing editoritems.json!")
        }

        const parsedEditoritems = JSON.parse(
            fs.readFileSync(this.paths.editorItems, "utf-8"),
        )

        //handle both single SubType and array of SubTypes
        const editor = parsedEditoritems.Item.Editor
        const subType = Array.isArray(editor.SubType)
            ? editor.SubType[0]
            : editor.SubType

        if (!subType?.Name) {
            throw new Error("Invalid editoritems - missing SubType Name")
        }

        this.name = subType.Name

        //Get details
        if (!fs.existsSync(this.paths.properties)) {
            throw new Error("Missing properties.json!")
        }

        const parsedProperties = JSON.parse(
            fs.readFileSync(this.paths.properties, "utf-8"),
        )

        this.details = parsedProperties["Properties"]

        //Get icon
        //Since the icon is only half :( we need to merge with full path
        const iconPath = parsedProperties.Properties?.Icon?.["0"]
        this.icon = iconPath
            ? path.join(packagePath, "resources/BEE2/items", iconPath)
            : null

        if (!this.icon) {
            //Icon isnt defined in properties, get it from editoritems
            const rawIconPath = subType.Palette?.Image
            if (rawIconPath) {
                // Remove "palette/" prefix and build full path
                const cleanIconPath = rawIconPath.split("/").slice(1).join("/")
                this.icon = path.join(
                    packagePath,
                    "resources/BEE2/items",
                    cleanIconPath,
                )
            }
        }

        this.itemFolder = folder.toLowerCase()
        this.fullItemPath = fullItemPath

        // Store instance data from editoritems instead of loading files
        this.instances = parsedEditoritems.Item?.Exporting?.Instances || {}
        this._loadedInstances = new Map() // Cache for loaded Instance objects

        console.log(`Added item: ${this.name} (id: ${this.id})`)
    }

    getEditorItems(raw = false) {
        //Returns a JSON that is editoritems.
        const rawEditoritems = fs.readFileSync(this.paths.editorItems, "utf-8")
        if (raw) {
            return rawEditoritems
        } else {
            return JSON.parse(rawEditoritems)
        }
    }

    saveEditorItems(editedJSON) {
        fs.writeFileSync(
            this.paths.editorItems,
            JSON.stringify(editedJSON, null, 4),
            "utf8",
        )
    }

    saveProperties(propertiesJSON) {
        fs.writeFileSync(
            this.paths.properties,
            JSON.stringify(propertiesJSON, null, 4),
            "utf8",
        )
    }

    getInstance(index = "0") {
        // Return cached instance if already loaded
        if (this._loadedInstances.has(index)) {
            return this._loadedInstances.get(index)
        }

        // Check if instance exists in editoritems
        const instanceData = this.instances[index]
        if (!instanceData) {
            return null
        }

        // Build full path to instance file
        const instancePath = path.join(
            this.packagePath,
            "resources",
            instanceData.Name
        )

        // Check if file actually exists
        if (!fs.existsSync(instancePath)) {
            return null
        }

        // Create and cache the instance
        const instance = new Instance({ path: instancePath })
        this._loadedInstances.set(index, instance)
        
        return instance
    }

    getAvailableInstances() {
        return Object.keys(this.instances)
    }

    exists() {
        return (
            fs.existsSync(this.paths.editorItems) &&
            fs.existsSync(this.paths.properties)
        )
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            details: this.details,
            icon: this.icon,
            paths: this.paths,
            itemFolder: this.itemFolder,
            fullItemPath: this.fullItemPath,
            packagePath: this.packagePath,
            instances: this.instances,
        }
    }
}

module.exports = {
    Item,
}