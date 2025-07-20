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
        // Handle both forward and back slashes, remove BEE2 from anywhere in the instances path
        // First normalize all slashes to the OS-specific separator
        const normalizedName = instanceName.replace(/[/\\]/g, path.sep)
        // Then clean up the path structure
        const cleanInstanceName = normalizedName.replace(
            new RegExp(`^(?:instances${path.sep})?(?:BEE2${path.sep})?(.*)$`),
            `instances${path.sep}$1`
        )
        return path.join(packagePath, "resources", cleanInstanceName)
    }

    // Placeholder: In the future, this would parse the VMF and return all entities
    getAllEntities() {
        // TODO: Implement VMF parsing and entity extraction
        return []
    }
}

module.exports = { Instance }
