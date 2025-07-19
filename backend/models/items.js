const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")

//TODO: Async

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

        //Paths
        this.paths = {
            editorItems: path.join(fullItemPath, "editoritems.txt"),
            properties: path.join(fullItemPath, "properties.txt"),
        }

        //If there is vbsp add it
        if (fs.existsSync(path.join(fullItemPath, "vbsp_config.cfg"))) {
            this.paths.vbsp_config = path.join(fullItemPath, "vbsp_config.cfg")
        }

        //parse editoritems file
        if (!fs.existsSync(this.paths.editorItems)) {
            throw new Error("Missing editoritems.txt!")
        }

        const rawEditoritems = fs.readFileSync(this.paths.editorItems, "utf-8")
        const parsedEditoritems = vdf.parse(rawEditoritems)

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
            throw new Error("Missing properties.txt!")
        }

        const rawProperties = fs.readFileSync(this.paths.properties, "utf-8")
        let parsedProperties
        let emptyKeyCounter = 0
        const fixedVDF = rawProperties.replace(
            /""\s+"/g,
            () => `"desc_${emptyKeyCounter++}" "`,
        )
        parsedProperties = vdf.parse(fixedVDF)

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

        console.log(`Added item: ${this.name} (id: ${this.id})`)
    }

    getEditorItems(raw = false) {
        //Returns a JSON that is editoritems.
        const rawEditoritems = fs.readFileSync(this.paths.editorItems, "utf-8")
        if (raw) {
            return rawEditoritems
        } else {
            return vdf.parse(rawEditoritems)
        }
    }

    saveEditorItems(editedVDF) {
        fs.writeFileSync(
            this.paths.editorItems,
            vdf.stringify(editedVDF),
            "utf8",
        )
    }

    saveProperties(propertiesVDF) {
        fs.writeFileSync(
            this.paths.properties,
            vdf.stringify(propertiesVDF),
            "utf8",
        )
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
        }
    }
}

module.exports = {
    Item,
}
