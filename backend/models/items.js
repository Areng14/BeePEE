const fs = require('fs')
const path = require('path')
const vdf = require('vdf-parser')

var items = []

class Item {
    constructor({packagePath, itemJSON}) {
        this.packagePath = packagePath
        this.id = itemJSON.ID
        
        //get item folder from styles
        const styles = itemJSON.Version?.Styles || {}
        let folder = styles.BEE2_CLEAN || Object.values(styles)[0]

        //handle both string and object folder formats
        if (typeof folder === 'object' && folder.folder) {
            folder = folder.folder
        }

        if (!folder) {
            throw new Error(`No item folder found for item ${this.id}`)
        }
        
        this.itemFolder = folder.toLowerCase()
        this.fullItemPath = path.join(this.packagePath, "items", this.itemFolder)
        
        //Paths
        this.paths = {
            editorItems: path.join(this.fullItemPath, "editoritems.txt"),
            properties: path.join(this.fullItemPath, "properties.txt"),
            vbsp_config: path.join(this.fullItemPath, "vbsp_config.cfg")
        }

        //parse editoritems file
        if (!fs.existsSync(this.paths.editorItems)) {
            throw new Error("Missing editoritems.txt!")
        }

        const rawEditoritems = fs.readFileSync(this.paths.editorItems, 'utf-8')
        const parsedEditoritems = vdf.parse(rawEditoritems)
        
        //handle both single SubType and array of SubTypes
        const editor = parsedEditoritems.Item.Editor
        const subType = Array.isArray(editor.SubType) ? editor.SubType[0] : editor.SubType
        
        if (!subType?.Name) {
            throw new Error("Invalid editoritems - missing SubType Name")
        }
        
        this.name = subType.Name

        //Get details
        if (!fs.existsSync(this.paths.properties)) {
            throw new Error("Missing properties.txt!")
        }

        const rawProperties = fs.readFileSync(this.paths.properties, 'utf-8')
        const parsedProperties = vdf.parse(rawProperties)

        this.details = parsedProperties

        //Get icon
        //Since the icon is only half :( we need to merge with full path
        const iconPath = parsedProperties.Properties?.Icon?.["0"]
        this.icon = iconPath ? path.join(packagePath, "resources/BEE2/items", iconPath) : null
        console.log(`Added item: ${this.name} (id: ${this.id})`)
    }

    getEditorItems(raw=false) {
        //Returns a JSON that is editoritems.
        const rawEditoritems = fs.readFileSync(this.paths.editorItems, 'utf-8')
        if (raw) {
            return rawEditoritems
        } else {
            return vdf.parse(rawEditoritems)
        }
    }

    saveEditorItems(editedVDF) {
        fs.writeFileSync(this.paths.editorItems, vdf.stringify(editedVDF), 'utf8')
    }

    saveProperties(propertiesVDF) {
    fs.writeFileSync(this.paths.properties, vdf.stringify(propertiesVDF), 'utf8')
    }

    exists() {
        return fs.existsSync(this.paths.editorItems) && fs.existsSync(this.paths.properties)
    }
}

function addItem(packagePath, itemJSON) {
    //Adds a item to the itemsArray
    items.push(new Item({ packagePath, itemJSON }))
}

function getItemByName(name) {
    if (!name) {
        throw new Error("Name is empty!")
    }

    return items.find(item => item.name === name)
}

function getItemById(id) {
    if (!id) {
        throw new Error("ID is empty!")
    }

    return items.find(item => item.id === id)
}

function removeItem(identifier) {
    const index = items.findIndex(item => item.name === identifier || item.id === identifier)
    if (index !== -1) {
        return items.splice(index, 1)[0]
    }
    return null
}

function removeAllItems() {
    items.length = 0
}

module.exports = { Item, addItem, getItemById, getItemByName, removeItem, removeAllItems }