const fs = require("fs")
const path = require("path")
const { Instance } = require("../items/Instance")
const { vmfStatsCache } = require("../utils/vmfParser")

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
            meta: path.join(fullItemPath, "meta.json"),
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

        // Load metadata
        this.metadata = this.loadMetadata()

        // Add editor instances
        const editorInstances =
            parsedEditoritems.Item?.Exporting?.Instances || {}
        Object.entries(editorInstances).forEach(([key, instance]) => {
            this.instances[key] = {
                Name: instance.Name,
                source: "editor",
            }
        })

        // Add VBSP instances if they exist
        if (this.paths.vbsp_config && fs.existsSync(this.paths.vbsp_config)) {
            try {
                const vbspContent = fs.readFileSync(
                    this.paths.vbsp_config,
                    "utf-8",
                )
                const matches = [
                    ...vbspContent.matchAll(/"Changeinstance"\s+"([^"]+)"/g),
                ]

                // Start index after the last editor instance
                let nextIndex = Object.keys(this.instances).length

                for (const match of matches) {
                    const instancePath = match[1]
                    // Only add if not already present
                    if (
                        !Object.values(this.instances).some(
                            (inst) => inst.Name === instancePath,
                        )
                    ) {
                        this.instances[nextIndex.toString()] = {
                            Name: instancePath,
                            source: "vbsp",
                        }
                        nextIndex++
                    }
                }
            } catch (error) {
                console.error(
                    `Failed to parse VBSP config for ${this.name}:`,
                    error.message,
                )
            }
        }

        console.log(`Added item: ${this.name} (id: ${this.id})`)
    }

    reloadInstances() {
        // Clear current instances
        this.instances = {}
        this._loadedInstances.clear()

        // Re-read editoritems file
        const parsedEditoritems = JSON.parse(
            fs.readFileSync(this.paths.editorItems, "utf-8"),
        )

        // Re-add editor instances
        const editorInstances =
            parsedEditoritems.Item?.Exporting?.Instances || {}
        Object.entries(editorInstances).forEach(([key, instance]) => {
            this.instances[key] = {
                Name: instance.Name,
                // Preserve VMF stats if they exist in the saved data
                ...(instance.EntityCount !== undefined && {
                    EntityCount: instance.EntityCount,
                }),
                ...(instance.BrushCount !== undefined && {
                    BrushCount: instance.BrushCount,
                }),
                ...(instance.BrushSideCount !== undefined && {
                    BrushSideCount: instance.BrushSideCount,
                }),
            }
        })

        // Re-add VBSP instances if they exist
        if (this.paths.vbsp_config && fs.existsSync(this.paths.vbsp_config)) {
            try {
                const vbspContent = fs.readFileSync(
                    this.paths.vbsp_config,
                    "utf-8",
                )
                const matches = [
                    ...vbspContent.matchAll(/"Changeinstance"\s+"([^"]+)"/g),
                ]

                // Start index after the last editor instance
                let nextIndex = Object.keys(this.instances).length

                for (const match of matches) {
                    const instancePath = match[1]
                    // Only add if not already present
                    if (
                        !Object.values(this.instances).some(
                            (inst) => inst.Name === instancePath,
                        )
                    ) {
                        this.instances[nextIndex.toString()] = {
                            Name: instancePath,
                            source: "vbsp",
                        }
                        nextIndex++
                    }
                }
            } catch (error) {
                console.error(
                    `Failed to parse VBSP config for ${this.name}:`,
                    error.message,
                )
            }
        }
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
        const instancePath = Instance.getCleanPath(
            this.packagePath,
            instanceData.Name,
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

    // Check if an instance file actually exists
    instanceExists(index) {
        const instanceData = this.instances[index]
        if (!instanceData || !instanceData.Name) {
            return false
        }

        // Apply path fixing to remove BEE2/ prefix for actual file structure
        const actualInstancePath = this.fixInstancePath(instanceData.Name)
        const fullInstancePath = Instance.getCleanPath(
            this.packagePath,
            actualInstancePath,
        )

        return fs.existsSync(fullInstancePath)
    }

    // Get only valid instances (files exist)
    getValidInstances() {
        const validInstances = {}

        for (const [index, instanceData] of Object.entries(this.instances)) {
            if (this.instanceExists(index)) {
                validInstances[index] = instanceData
            }
        }

        return validInstances
    }

    // Get instances with VMF stats and metadata
    getInstancesWithStatus() {
        const instancesWithStatus = {}

        for (const [index, instanceData] of Object.entries(this.instances)) {
            const metadata = this.getInstanceMetadata(index)

            // Use saved VMF stats if they exist, otherwise compute them
            let vmfStats = {
                EntityCount: instanceData.EntityCount || 0,
                BrushCount: instanceData.BrushCount || 0,
                BrushSideCount: instanceData.BrushSideCount || 0,
            }

            // Only compute VMF stats if they're not already saved and the file exists and it's not a VBSP instance
            if (
                !instanceData.EntityCount &&
                metadata.exists &&
                metadata.source !== "vbsp"
            ) {
                try {
                    // Apply path fixing to remove BEE2/ prefix for actual file structure
                    const actualInstancePath = this.fixInstancePath(
                        instanceData.Name,
                    )
                    const fullInstancePath = Instance.getCleanPath(
                        this.packagePath,
                        actualInstancePath,
                    )

                    // Get VMF stats using the cache
                    const computedStats =
                        vmfStatsCache.getStats(fullInstancePath)
                    vmfStats = {
                        EntityCount: computedStats.EntityCount || 0,
                        BrushCount: computedStats.BrushCount || 0,
                        BrushSideCount: computedStats.BrushSideCount || 0,
                    }
                } catch (error) {
                    console.error(
                        `Error getting VMF stats for instance ${index}:`,
                        error.message,
                    )
                }
            }

            instancesWithStatus[index] = {
                ...instanceData,
                ...vmfStats,
                // Add metadata for frontend use
                _metadata: metadata,
            }
        }

        return instancesWithStatus
    }

    // Helper method to determine if an instance is a VBSP instance
    isVbspInstance(instanceData) {
        return (
            instanceData.Name &&
            instanceData.Name.includes("instances/bee2_dev")
        )
    }

    // Helper method to get instance metadata (exists, source type)
    getInstanceMetadata(index) {
        const instanceData = this.instances[index]
        if (!instanceData) {
            return { exists: false, source: "unknown" }
        }

        const exists = this.instanceExists(index)
        const isVbsp = this.isVbspInstance(instanceData)
        const source = isVbsp ? "vbsp" : "editor"

        return { exists, source }
    }

    // Helper function to fix instance paths by removing BEE2/ prefix
    fixInstancePath(instancePath) {
        // Safety check for undefined or null instancePath
        if (!instancePath) {
            return ""
        }

        // Normalize path separators to forward slashes
        let normalizedPath = instancePath.replace(/\\/g, "/")

        if (normalizedPath.startsWith("instances/BEE2/")) {
            return normalizedPath.replace("instances/BEE2/", "instances/")
        }
        if (normalizedPath.startsWith("instances/bee2/")) {
            return normalizedPath.replace("instances/bee2/", "instances/")
        }
        return normalizedPath
    }

    addInstance(instanceName) {
        // Find the next available index
        const keys = Object.keys(this.instances)
        const nextIndex =
            keys.length > 0 ? Math.max(...keys.map((k) => parseInt(k))) + 1 : 0

        // Add the new instance
        this.instances[nextIndex.toString()] = {
            Name: instanceName,
            source: "editor",
        }

        // Update editoritems file
        const editoritems = this.getEditorItems()
        if (!editoritems.Item.Exporting) {
            editoritems.Item.Exporting = {}
        }
        if (!editoritems.Item.Exporting.Instances) {
            editoritems.Item.Exporting.Instances = {}
        }

        // Get VMF stats for the new instance
        let vmfStats = {
            EntityCount: 0,
            BrushCount: 0,
            BrushSideCount: 0,
        }

        try {
            // Apply path fixing to remove BEE2/ prefix for actual file structure
            const actualInstancePath = this.fixInstancePath(instanceName)
            const fullInstancePath = Instance.getCleanPath(
                this.packagePath,
                actualInstancePath,
            )

            // Get VMF stats using the cache
            vmfStats = vmfStatsCache.getStats(fullInstancePath)
        } catch (error) {
            console.error(
                `Error getting VMF stats for new instance ${instanceName}:`,
                error.message,
            )
        }

        editoritems.Item.Exporting.Instances[nextIndex.toString()] = {
            Name: instanceName,
            ...vmfStats,
        }
        this.saveEditorItems(editoritems)

        // Reload instances from file to ensure consistency
        this.reloadInstances()

        return nextIndex.toString()
    }

    removeInstance(index) {
        const instance = this.instances[index]
        if (!instance) {
            throw new Error(`Instance ${index} not found`)
        }

        // Only allow removing editor instances
        if (instance.source === "vbsp") {
            throw new Error("Cannot remove VBSP instances")
        }

        // Delete the instance file from filesystem if it exists
        try {
            const fs = require("fs")
            const path = require("path")

            // Apply path fixing to remove BEE2/ prefix for actual file structure
            const actualFilePath = this.fixInstancePath(instance.Name)
            const instanceFilePath = path.join(
                this.packagePath,
                "resources",
                actualFilePath,
            )

            if (fs.existsSync(instanceFilePath)) {
                fs.unlinkSync(instanceFilePath)
                console.log(`Deleted instance file: ${instanceFilePath}`)

                // Also try to remove the directory if it's empty
                const instanceDir = path.dirname(instanceFilePath)
                try {
                    const files = fs.readdirSync(instanceDir)
                    if (files.length === 0) {
                        fs.rmdirSync(instanceDir)
                        console.log(`Removed empty directory: ${instanceDir}`)
                    }
                } catch (dirError) {
                    // Directory not empty or other error, ignore
                    console.log(
                        `Could not remove directory ${instanceDir}: ${dirError.message}`,
                    )
                }
            } else {
                console.log(
                    `Instance file not found, skipping deletion: ${instanceFilePath}`,
                )
            }
        } catch (fileError) {
            console.error(`Error deleting instance file: ${fileError.message}`)
            // Don't throw error, continue with removal from editoritems
        }

        // Remove from memory
        delete this.instances[index]
        this._loadedInstances.delete(index)

        // Update editoritems file
        const editoritems = this.getEditorItems()
        if (editoritems.Item.Exporting?.Instances) {
            delete editoritems.Item.Exporting.Instances[index]
            // If no instances left, clean up the structure
            if (
                Object.keys(editoritems.Item.Exporting.Instances).length === 0
            ) {
                delete editoritems.Item.Exporting.Instances
                if (Object.keys(editoritems.Item.Exporting).length === 0) {
                    delete editoritems.Item.Exporting
                }
            }
            this.saveEditorItems(editoritems)
        }

        // Reload instances from file to ensure consistency
        this.reloadInstances()
    }

    // Input management functions
    getInputs() {
        const editoritems = this.getEditorItems()
        return editoritems.Item?.Exporting?.Inputs || {}
    }

    addInput(inputName, inputConfig) {
        if (!inputName || typeof inputName !== "string") {
            throw new Error("Input name must be a non-empty string")
        }

        if (!inputConfig || typeof inputConfig !== "object") {
            throw new Error("Input config must be an object")
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
        if (!inputName || typeof inputName !== "string") {
            throw new Error("Input name must be a non-empty string")
        }

        const editoritems = this.getEditorItems()

        // Check if input exists
        if (!editoritems.Item?.Exporting?.Inputs?.[inputName]) {
            throw new Error(`Input '${inputName}' not found`)
        }

        if (!inputConfig || typeof inputConfig !== "object") {
            throw new Error("Input config must be an object")
        }

        // Update the input
        editoritems.Item.Exporting.Inputs[inputName] = inputConfig

        this.saveEditorItems(editoritems)
        return inputName
    }

    removeInput(inputName) {
        if (!inputName || typeof inputName !== "string") {
            throw new Error("Input name must be a non-empty string")
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
        if (!inputName || typeof inputName !== "string") {
            throw new Error("Input name must be a non-empty string")
        }

        const inputs = this.getInputs()
        return inputs[inputName] || null
    }

    // Utility function to check if an input exists
    hasInput(inputName) {
        if (!inputName || typeof inputName !== "string") {
            throw new Error("Input name must be a non-empty string")
        }

        const inputs = this.getInputs()
        return inputName in inputs
    }

    // Output management functions
    getOutputs() {
        const editoritems = this.getEditorItems()
        return editoritems.Item?.Exporting?.Outputs || {}
    }

    addOutput(outputName, outputConfig) {
        if (!outputName || typeof outputName !== "string") {
            throw new Error("Output name must be a non-empty string")
        }

        if (!outputConfig || typeof outputConfig !== "object") {
            throw new Error("Output config must be an object")
        }

        const editoritems = this.getEditorItems()

        // Ensure Exporting structure exists
        if (!editoritems.Item.Exporting) {
            editoritems.Item.Exporting = {}
        }
        if (!editoritems.Item.Exporting.Outputs) {
            editoritems.Item.Exporting.Outputs = {}
        }

        // Add the new output
        editoritems.Item.Exporting.Outputs[outputName] = outputConfig

        this.saveEditorItems(editoritems)
        return outputName
    }

    updateOutput(outputName, outputConfig) {
        if (!outputName || typeof outputName !== "string") {
            throw new Error("Output name must be a non-empty string")
        }

        const editoritems = this.getEditorItems()

        // Check if output exists
        if (!editoritems.Item?.Exporting?.Outputs?.[outputName]) {
            throw new Error(`Output '${outputName}' not found`)
        }

        if (!outputConfig || typeof outputConfig !== "object") {
            throw new Error("Output config must be an object")
        }

        // Update the output
        editoritems.Item.Exporting.Outputs[outputName] = outputConfig

        this.saveEditorItems(editoritems)
        return outputName
    }

    removeOutput(outputName) {
        if (!outputName || typeof outputName !== "string") {
            throw new Error("Output name must be a non-empty string")
        }

        const editoritems = this.getEditorItems()

        // Check if output exists
        if (!editoritems.Item?.Exporting?.Outputs?.[outputName]) {
            throw new Error(`Output '${outputName}' not found`)
        }

        // Remove the output
        delete editoritems.Item.Exporting.Outputs[outputName]

        // Clean up empty structures
        if (Object.keys(editoritems.Item.Exporting.Outputs).length === 0) {
            delete editoritems.Item.Exporting.Outputs
            if (Object.keys(editoritems.Item.Exporting).length === 0) {
                delete editoritems.Item.Exporting
            }
        }

        this.saveEditorItems(editoritems)
        return outputName
    }

    // Utility function to get a specific output
    getOutput(outputName) {
        if (!outputName || typeof outputName !== "string") {
            throw new Error("Output name must be a non-empty string")
        }

        const outputs = this.getOutputs()
        return outputs[outputName] || null
    }

    // Utility function to check if an output exists
    hasOutput(outputName) {
        if (!outputName || typeof outputName !== "string") {
            throw new Error("Output name must be a non-empty string")
        }

        const outputs = this.getOutputs()
        return outputName in outputs
    }

    exists() {
        return (
            fs.existsSync(this.paths.editorItems) &&
            fs.existsSync(this.paths.properties)
        )
    }

    // Metadata methods
    loadMetadata() {
        try {
            if (fs.existsSync(this.paths.meta)) {
                const metadata = JSON.parse(
                    fs.readFileSync(this.paths.meta, "utf-8"),
                )
                return metadata
            }
        } catch (error) {
            console.warn(
                `Failed to load metadata for item ${this.id}:`,
                error.message,
            )
        }

        // Get actual file creation and modification dates
        const fileDates = this.getFileDates()

        // Create default metadata structure with actual file dates
        const defaultMetadata = {
            created: fileDates.created.toISOString(),
            lastModified: fileDates.lastModified.toISOString(),
        }

        // Create the meta.json file if it doesn't exist
        this.saveMetadata(defaultMetadata)

        return defaultMetadata
    }

    getFileDates() {
        let earliestCreated = new Date()
        let latestModified = new Date(0) // Start with epoch time

        // Check all item files for creation and modification dates
        const filesToCheck = [this.paths.editorItems, this.paths.properties]

        // Add VBSP config if it exists
        if (this.paths.vbsp_config) {
            filesToCheck.push(this.paths.vbsp_config)
        }

        for (const filePath of filesToCheck) {
            if (fs.existsSync(filePath)) {
                try {
                    const stats = fs.statSync(filePath)

                    // Use birthtime (creation) if available, otherwise use mtime
                    const created = stats.birthtime || stats.mtime
                    const modified = stats.mtime

                    // Find earliest creation date
                    if (created < earliestCreated) {
                        earliestCreated = created
                    }

                    // Find latest modification date
                    if (modified > latestModified) {
                        latestModified = modified
                    }
                } catch (error) {
                    console.warn(
                        `Failed to get stats for ${filePath}:`,
                        error.message,
                    )
                }
            }
        }

        // If we couldn't get any valid dates, use current time
        if (
            earliestCreated.getTime() === new Date().getTime() &&
            latestModified.getTime() === 0
        ) {
            const now = new Date()
            return {
                created: now,
                lastModified: now,
            }
        }

        return {
            created: earliestCreated,
            lastModified: latestModified,
        }
    }

    saveMetadata(metadata = null) {
        try {
            const dataToSave = metadata || this.metadata

            // Get current file modification date
            const fileDates = this.getFileDates()
            dataToSave.lastModified = fileDates.lastModified.toISOString()

            // Ensure required fields exist
            if (!dataToSave.created) {
                dataToSave.created = fileDates.created.toISOString()
            }

            fs.writeFileSync(
                this.paths.meta,
                JSON.stringify(dataToSave, null, 4),
            )
            this.metadata = dataToSave
            return true
        } catch (error) {
            console.error(
                `Failed to save metadata for item ${this.id}:`,
                error.message,
            )
            return false
        }
    }

    updateMetadata(updates) {
        if (!updates || typeof updates !== "object") {
            throw new Error("Metadata updates must be an object")
        }

        this.metadata = {
            ...this.metadata,
            ...updates,
        }

        return this.saveMetadata()
    }

    getMetadata() {
        return this.metadata
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
            instances: this.instances, // Regular instances without existence check
            metadata: this.metadata,
        }
    }

    // Special method for item editor that includes existence status
    toJSONWithExistence() {
        return {
            id: this.id,
            name: this.name,
            details: this.details,
            icon: this.icon,
            paths: this.paths,
            itemFolder: this.itemFolder,
            fullItemPath: this.fullItemPath,
            packagePath: this.packagePath,
            instances: this.getInstancesWithStatus(), // Include existence status
            metadata: this.metadata,
        }
    }
}

module.exports = {
    Item,
}
