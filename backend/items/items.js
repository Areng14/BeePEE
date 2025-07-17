const fs = require('fs')
const path = require('path')
const vdf = require('vdf-parser')

var items

class Item {
    constructor({packagePath, itemVdf}) {
        this.packagePath = packagePath
        this.id = itemVdf.ID
        
        //get item folder from styles
        const styles = itemVdf.Version?.Styles || {}
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
        
        //parse editoritems file
        const rawEditoritems = fs.readFileSync(path.join(this.fullItemPath, "editoritems.txt"), 'utf-8')
        const parsedEditoritems = vdf.parse(rawEditoritems)
        
        //handle both single SubType and array of SubTypes
        const editor = parsedEditoritems.Item.Editor
        const subType = Array.isArray(editor.SubType) ? editor.SubType[0] : editor.SubType
        
        if (!subType?.Name) {
            throw new Error("Invalid editoritems - missing SubType Name")
        }
        
        this.name = subType.Name
        console.log(`Added item: ${this.name} (id: ${this.id})`)
    }
}

module.exports = { Item, items }