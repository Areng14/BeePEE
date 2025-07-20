const path = require("path")
const fs = require("fs")
const vdf = require("vdf-parser")

class Instance {
    constructor({ path: instancePath }) {
        this.path = instancePath
    }

    /**
     * Convert a VMF file to JSON format
     * @param {string} vmfPath Path to the VMF file
     * @returns {string} Path to the created JSON file
     */
    static convertToJson(vmfPath) {
        const rawData = fs.readFileSync(vmfPath, "utf-8")
        const jsonData = vdf.parse(rawData)
        const jsonPath = vmfPath.replace(/\.vmf$/i, '.json')
        fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 4))
        fs.unlinkSync(vmfPath) // Remove the original VMF
        return jsonPath
    }

    /**
     * Convert a JSON file back to VMF format
     * @param {string} jsonPath Path to the JSON file
     * @returns {string} Path to the created VMF file
     */
    static convertToVmf(jsonPath) {
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
        const vmfPath = jsonPath.replace(/\.json$/i, '.vmf')
        // TODO: Implement proper VMF stringification
        // For now just doing basic VDF stringification
        const vmfContent = vdf.stringify(jsonData)
        fs.writeFileSync(vmfPath, vmfContent)
        fs.unlinkSync(jsonPath) // Remove the JSON file
        return vmfPath
    }

    /**
     * Convert all instances for an item to VMF format
     * @param {string} packagePath Base package path
     * @param {Object} instances Instance data from the item
     */
    static convertAllToVmf(packagePath, instances) {
        for (const [key, instance] of Object.entries(instances)) {
            const instancePath = Instance.getCleanPath(packagePath, instance.Name)
            if (instancePath.endsWith('.json')) {
                instance.Name = instance.Name.replace(/\.json$/i, '.vmf')
                Instance.convertToVmf(instancePath)
            }
        }
    }

    /**
     * Convert all VMF instances for an item back to JSON format
     * @param {string} packagePath Base package path
     * @param {Object} instances Instance data from the item
     */
    static convertAllToJson(packagePath, instances) {
        for (const [key, instance] of Object.entries(instances)) {
            const instancePath = Instance.getCleanPath(packagePath, instance.Name)
            if (instancePath.endsWith('.vmf')) {
                instance.Name = instance.Name.replace(/\.vmf$/i, '.json')
                Instance.convertToJson(instancePath)
            }
        }
    }

    /**
     * Gets the raw instance path as stored in the package
     * @param {string} packagePath - Path to the package directory
     * @param {string} instanceName - Name of the instance from the package data
     * @returns {string} Full path to the instance file
     */
    static getRawPath(packagePath, instanceName) {
        return path.join(packagePath, "resources", instanceName)
    }

    /**
     * Gets the cleaned instance path (removes BEE2 prefix if present)
     * @param {string} packagePath - Path to the package directory
     * @param {string} instanceName - Name of the instance from the package data
     * @returns {string} Full path to the instance file with BEE2 prefix removed
     */
    static getCleanPath(packagePath, instanceName) {
        // Handle both forward and back slashes, remove BEE2 from anywhere in the instances path
        const cleanInstanceName = instanceName.replace(/^(?:instances[/\\])?(?:BEE2[/\\])?(.*)$/, 'instances/$1')
        return path.join(packagePath, "resources", cleanInstanceName)
    }

    // Placeholder: In the future, this would parse the VMF and return all entities
    getAllEntities() {
        // TODO: Implement VMF parsing and entity extraction
        return []
    }
}

module.exports = { Instance }
