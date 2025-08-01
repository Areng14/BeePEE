const path = require("path")

/**
 * Gets the raw instance path as stored in the package
 * @param {string} packagePath - Path to the package directory
 * @param {string} instanceName - Name of the instance from the package data
 * @returns {string} Full path to the instance file
 */
function getRawInstancePath(packagePath, instanceName) {
    return path.join(packagePath, "resources", instanceName)
}

/**
 * Gets the cleaned instance path (removes BEE2 prefix if present)
 * @param {string} packagePath - Path to the package directory
 * @param {string} instanceName - Name of the instance from the package data
 * @returns {string} Full path to the instance file with BEE2 prefix removed
 */
function getCleanInstancePath(packagePath, instanceName) {
    const cleanInstanceName = instanceName.replace(/^BEE2\//, "")
    return path.join(packagePath, "resources", cleanInstanceName)
}

module.exports = {
    getRawInstancePath,
    getCleanInstancePath,
}
