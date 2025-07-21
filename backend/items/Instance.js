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
        try {
            // Read and parse the VMF file
            const vmfContent = fs.readFileSync(this.path, 'utf-8')
            const vmfData = vdf.parse(vmfContent)

            const entities = {}
            
            // VMF files have an 'entities' block that contains all entities
            if (vmfData.world?.entity) {
                // Handle world entity
                if (vmfData.world.entity.targetname && vmfData.world.entity.classname) {
                    entities[vmfData.world.entity.targetname] = vmfData.world.entity.classname
                }
            }

            if (vmfData.entities) {
                // Handle numbered entities (common format in VMF)
                for (const [key, entity] of Object.entries(vmfData.entities)) {
                    if (entity.targetname && entity.classname) {
                        entities[entity.targetname] = entity.classname
                    }
                }

                // Handle array of entities (alternate format)
                if (Array.isArray(vmfData.entities)) {
                    vmfData.entities.forEach(entity => {
                        if (entity.targetname && entity.classname) {
                            entities[entity.targetname] = entity.classname
                        }
                    })
                }
            }

            return entities
        } catch (error) {
            console.error(`Failed to parse VMF file ${this.path}:`, error)
            return {}
        }
    }
}

module.exports = { Instance }
