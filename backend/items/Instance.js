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

    // Parse VMF and return all entities with better comprehensive parsing
    getAllEntities() {
        try {
            // Read and parse the VMF file
            const vmfContent = fs.readFileSync(this.path, 'utf-8')
            const vmfData = vdf.parse(vmfContent)

            const entities = {}
            
            // Recursive function to find entities anywhere in the VMF structure
            const findEntitiesRecursive = (obj, path = '') => {
                if (typeof obj !== 'object' || obj === null) return

                // Check if this object is an entity (has both classname and targetname)
                if (obj.classname && obj.targetname) {
                    entities[obj.targetname] = obj.classname
                    return
                }

                // Recursively search all properties
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'object' && value !== null) {
                        findEntitiesRecursive(value, path ? `${path}.${key}` : key)
                    }
                }
            }

            // Start recursive search from root
            findEntitiesRecursive(vmfData, 'root')
            
            return entities
        } catch (error) {
            console.error(`Failed to parse VMF file ${this.path}:`, error)
            return {}
        }
    }
}

module.exports = { Instance }
