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

        // Initialize instances from editoritems
        this.instances = {}
        this._loadedInstances = new Map() // Cache for loaded Instance objects

        // Add editor instances
        const editorInstances = parsedEditoritems.Item?.Exporting?.Instances || {}
        Object.entries(editorInstances).forEach(([key, instance]) => {
            this.instances[key] = {
                Name: instance.Name,
                source: 'editor'
            }
        })

        // Add VBSP instances if they exist
        if (this.paths.vbsp_config && fs.existsSync(this.paths.vbsp_config)) {
            try {
                const vbspContent = fs.readFileSync(this.paths.vbsp_config, 'utf-8')
                const matches = [...vbspContent.matchAll(/"Changeinstance"\s+"([^"]+)"/g)]
                
                // Start index after the last editor instance
                let nextIndex = Object.keys(this.instances).length
                
                for (const match of matches) {
                    const instancePath = match[1]
                    // Only add if not already present
                    if (!Object.values(this.instances).some(inst => inst.Name === instancePath)) {
                        this.instances[nextIndex.toString()] = {
                            Name: instancePath,
                            source: 'vbsp'
                        }
                        nextIndex++
                    }
                }
            } catch (error) {
                console.error(`Failed to parse VBSP config for ${this.name}:`, error.message)
            }
        }

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

        // Check if instance exists
        const instanceData = this.instances[index]
        if (!instanceData) {
            return null
        }

        // Build full path to instance file using Instance class
        const instancePath = Instance.getCleanPath(this.packagePath, instanceData.Name)

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

    addInstance(instanceName) {
        // Find the next available index
        const keys = Object.keys(this.instances)
        const nextIndex = keys.length > 0 ? 
            Math.max(...keys.map(k => parseInt(k))) + 1 : 
            0
        
        // Add the new instance
        this.instances[nextIndex.toString()] = {
            Name: instanceName,
            source: 'editor'
        }

        // Update editoritems file
        const editoritems = this.getEditorItems()
        if (!editoritems.Item.Exporting) {
            editoritems.Item.Exporting = {}
        }
        if (!editoritems.Item.Exporting.Instances) {
            editoritems.Item.Exporting.Instances = {}
        }
        editoritems.Item.Exporting.Instances[nextIndex.toString()] = {
            Name: instanceName
        }
        this.saveEditorItems(editoritems)

        return nextIndex.toString()
    }

    removeInstance(index) {
        const instance = this.instances[index]
        if (!instance) {
            throw new Error(`Instance ${index} not found`)
        }

        // Only allow removing editor instances
        if (instance.source === 'vbsp') {
            throw new Error('Cannot remove VBSP instances')
        }

        // Remove from memory
        delete this.instances[index]
        this._loadedInstances.delete(index)

        // Update editoritems file
        const editoritems = this.getEditorItems()
        if (editoritems.Item.Exporting?.Instances) {
            delete editoritems.Item.Exporting.Instances[index]
            // If no instances left, clean up the structure
            if (Object.keys(editoritems.Item.Exporting.Instances).length === 0) {
                delete editoritems.Item.Exporting.Instances
                if (Object.keys(editoritems.Item.Exporting).length === 0) {
                    delete editoritems.Item.Exporting
                }
            }
            this.saveEditorItems(editoritems)
        }
    }

    // Input management functions
    getInputs() {
        const editoritems = this.getEditorItems()
        return editoritems.Item?.Exporting?.Inputs || {}
    }

    addInput(inputName, inputConfig) {
        if (!inputName || typeof inputName !== 'string') {
            throw new Error('Input name must be a non-empty string')
        }
        
        if (!inputConfig || typeof inputConfig !== 'object') {
            throw new Error('Input config must be an object')
        }

        const editoritems = this.getEditorItems()
        
        // Ensure Exporting structure exists
        if (!editoritems.Item.Exporting) {
            editoritems.Item.Exporting = {}
        }
        if (!editoritems.Item.Exporting.Inputs) {
            editoritems.Item.Exporting.Inputs = {}
        }

        // Add the new input
        editoritems.Item.Exporting.Inputs[inputName] = inputConfig
        
        this.saveEditorItems(editoritems)
        return inputName
    }

    updateInput(inputName, inputConfig) {
        if (!inputName || typeof inputName !== 'string') {
            throw new Error('Input name must be a non-empty string')
        }

        const editoritems = this.getEditorItems()
        
        // Check if input exists
        if (!editoritems.Item?.Exporting?.Inputs?.[inputName]) {
            throw new Error(`Input '${inputName}' not found`)
        }

        if (!inputConfig || typeof inputConfig !== 'object') {
            throw new Error('Input config must be an object')
        }

        // Update the input
        editoritems.Item.Exporting.Inputs[inputName] = inputConfig
        
        this.saveEditorItems(editoritems)
        return inputName
    }

    removeInput(inputName) {
        if (!inputName || typeof inputName !== 'string') {
            throw new Error('Input name must be a non-empty string')
        }

        const editoritems = this.getEditorItems()
        
        // Check if input exists
        if (!editoritems.Item?.Exporting?.Inputs?.[inputName]) {
            throw new Error(`Input '${inputName}' not found`)
        }

        // Remove the input
        delete editoritems.Item.Exporting.Inputs[inputName]
        
        // Clean up empty structures
        if (Object.keys(editoritems.Item.Exporting.Inputs).length === 0) {
            delete editoritems.Item.Exporting.Inputs
            if (Object.keys(editoritems.Item.Exporting).length === 0) {
                delete editoritems.Item.Exporting
            }
        }
        
        this.saveEditorItems(editoritems)
        return inputName
    }

    // Utility function to get a specific input
    getInput(inputName) {
        if (!inputName || typeof inputName !== 'string') {
            throw new Error('Input name must be a non-empty string')
        }

        const inputs = this.getInputs()
        return inputs[inputName] || null
    }

    // Utility function to check if an input exists
    hasInput(inputName) {
        if (!inputName || typeof inputName !== 'string') {
            throw new Error('Input name must be a non-empty string')
        }

        const inputs = this.getInputs()
        return inputName in inputs
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
            instances: this.instances
        }
    }
}

module.exports = {
    Item,
}