const path = require("path")
const fs = require("fs")
const vdf = require("vdf-parser")

class Instance {
    constructor({ path: instancePath }) {
        this.path = instancePath
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
        // First normalize the instance name to use OS-specific path separators
        const normalizedName = instanceName.replace(/[/\\]/g, path.sep)
        
        // Remove any BEE2 prefix and ensure proper instances prefix
        const cleanInstanceName = normalizedName
            .split(path.sep)
            .filter(part => part !== "BEE2")
            .join(path.sep)

        // Ensure the path starts with "instances"
        const finalPath = cleanInstanceName.startsWith("instances" + path.sep) 
            ? cleanInstanceName 
            : path.join("instances", cleanInstanceName)

        // Join with the package resources directory
        return path.normalize(path.join(packagePath, "resources", finalPath))
    }

    // Placeholder: In the future, this would parse the VMF and return all entities
    getAllEntities() {
        // TODO: Implement VMF parsing and entity extraction
        return []
    }
}

module.exports = { Instance }
