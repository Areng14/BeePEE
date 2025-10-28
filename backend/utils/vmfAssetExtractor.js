const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")

/**
 * Extract assets (models, materials, sounds, scripts) from a VMF file
 * @param {string} vmfPath - Path to the VMF file
 * @returns {Object} Object containing arrays of assets by type
 */
function extractAssetsFromVMF(vmfPath) {
    if (!fs.existsSync(vmfPath)) {
        throw new Error("VMF file not found")
    }

    try {
        const content = fs.readFileSync(vmfPath, "utf-8")
        const vmfData = vdf.parse(content)

        const assets = {
            MODEL: [],
            MATERIAL: [],
            SOUND: [],
            SCRIPT: [],
        }

        // Recursive function to find entities and extract their assets
        const extractAssetsRecursive = (obj) => {
            if (typeof obj !== "object" || obj === null) return

            // Check if this is an entity with asset properties
            if (obj.classname) {
                // Extract model paths
                if (obj.model) {
                    assets.MODEL.push(obj.model.toLowerCase())
                }

                // Extract material paths from various properties
                const materialProps = ["material", "texture", "skin", "overlay"]
                for (const prop of materialProps) {
                    if (obj[prop]) {
                        assets.MATERIAL.push(obj[prop].toLowerCase())
                    }
                }

                // Extract sound paths
                const soundProps = [
                    "sound",
                    "soundfile",
                    "soundname",
                    "ambient_generic",
                ]
                for (const prop of soundProps) {
                    if (obj[prop]) {
                        assets.SOUND.push(obj[prop].toLowerCase())
                    }
                }

                // Extract script paths
                if (obj.scriptfile) {
                    assets.SCRIPT.push(obj.scriptfile.toLowerCase())
                }
            }

            // Recursively search all properties
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === "object" && value !== null) {
                    extractAssetsRecursive(value)
                }
            }
        }

        // Start recursive search from root
        extractAssetsRecursive(vmfData)

        // Remove duplicates and filter out empty values
        for (const assetType in assets) {
            assets[assetType] = [...new Set(assets[assetType])].filter(
                (asset) => asset && asset.trim(),
            )
        }

        return assets
    } catch (error) {
        console.error(
            `Error extracting assets from VMF file ${vmfPath}:`,
            error.message,
        )
        throw error
    }
}

/**
 * Find dependent materials for models
 * @param {string} modelPath - Path to the model file
 * @param {string} portal2Dir - Portal 2 directory path
 * @returns {Array} Array of dependent material paths
 */
function findDependentMaterials(modelPath, portal2Dir) {
    const dependentMaterials = []

    try {
        // For now, we'll implement a basic version that looks for common material patterns
        // This could be enhanced to actually parse MDL files and extract material references

        // Extract model name without extension
        const modelName = path.basename(modelPath, ".mdl")

        // Common material patterns for models
        const commonMaterialPatterns = [
            `materials/models/${modelName}.vmt`,
            `materials/models/props/${modelName}.vmt`,
            `materials/models/props_map_editor/${modelName}.vmt`,
        ]

        for (const materialPattern of commonMaterialPatterns) {
            const fullPath = path.join(portal2Dir, materialPattern)
            if (fs.existsSync(fullPath)) {
                dependentMaterials.push(materialPattern)
            }
        }
    } catch (error) {
        console.error(
            `Error finding dependent materials for ${modelPath}:`,
            error.message,
        )
    }

    return dependentMaterials
}

/**
 * Check if an asset exists in Portal 2 search paths (from gameinfo.txt)
 * @param {string} assetPath - Asset path to check
 * @param {string} portal2Dir - Portal 2 directory path
 * @param {Array} searchDirs - Portal 2 search directories from gameinfo.txt
 * @returns {boolean} True if asset exists in Portal 2 search paths
 */
function assetExistsInPortal2(assetPath, portal2Dir, searchDirs) {
    try {
        // Determine file extensions based on asset type
        let extensions = []
        let baseAssetPath = assetPath
        
        if (assetPath.startsWith("materials/")) {
            extensions = [".vtf", ".vmt"]
        } else if (assetPath.startsWith("models/")) {
            // Strip .mdl extension from the path before adding extensions
            baseAssetPath = assetPath.replace(".mdl", "")
            extensions = [".mdl", ".phy", ".vvd", ".dx90.vtx"]
        } else if (assetPath.startsWith("scripts/")) {
            extensions = [".nut"]
        } else if (assetPath.startsWith("messages/")) {
            const ext = path.extname(assetPath)
            extensions = [ext]
        } else if (assetPath.startsWith("sounds/")) {
            extensions = [".wav", ".mp3"]
        }
        
        // Check if asset exists in Portal 2 search paths
        // If it exists here, Portal 2 can find it, so we should pack it
        console.log(`Checking asset: ${assetPath}`)
        console.log(`Portal 2 dir: ${portal2Dir}`)
        console.log(`Search directories: ${JSON.stringify(searchDirs)}`)
        
        for (const searchDir of searchDirs) {
            // Skip gameinfo_path and bee2 paths as they're not actual asset locations
            if (searchDir === "|gameinfo_path|." || searchDir.includes("bee2")) {
                console.log(`Skipping search dir: ${searchDir}`)
                continue
            }
            
            console.log(`Checking search dir: ${searchDir}`)
            
            for (const ext of extensions) {
                const fullPath = path.join(portal2Dir, searchDir, baseAssetPath + ext)
                console.log(`  Checking path: ${fullPath}`)
                console.log(`  Path exists: ${fs.existsSync(fullPath)}`)
                
                if (fs.existsSync(fullPath)) {
                    console.log(`✅ Asset found in Portal 2 search path: ${searchDir}/${baseAssetPath}`)
                    return true // Asset exists in Portal 2 search paths - PACK IT!
                }
            }
        }
        
        console.log(`❌ Asset not found in Portal 2 search paths: ${assetPath}`)
        return false // Asset doesn't exist in Portal 2 search paths - DON'T PACK IT!
    } catch (error) {
        console.error(`Error checking asset existence for ${assetPath}:`, error.message)
        return false // Assume it doesn't exist if we can't check
    }
}

/**
 * Get base assets list (now uses dynamic VPK checking instead of hardcoded list)
 * @returns {Promise<Array>} Empty array since we now check dynamically
 */
async function getBaseAssets() {
    console.log(`Using dynamic VPK checking instead of hardcoded base assets list`)
    return [] // Return empty array since we check dynamically now
}

/**
 * Find Portal 2 search directories from gameinfo.txt
 * @param {string} portal2Dir - Portal 2 directory path
 * @returns {Array} Array of search directories
 */
function getPortal2SearchDirs(portal2Dir) {
    const searchDirs = []

    try {
        const gameinfoPath = path.join(portal2Dir, "portal2", "gameinfo.txt")
        if (!fs.existsSync(gameinfoPath)) {
            return searchDirs
        }

        const content = fs.readFileSync(gameinfoPath, "utf-8")

        // Find Game entries
        const gameMatches = content.match(/Game\s+("[^"]+"|\w+)/g)
        if (gameMatches) {
            for (const match of gameMatches) {
                const dir = match.replace(/Game\s+/, "").replace(/"/g, "")
                searchDirs.push(dir)
            }
        }

        // Find portal2_dlc folders
        let count = 1
        while (true) {
            const dlcPath = path.join(portal2Dir, `portal2_dlc${count}`)
            if (!fs.existsSync(dlcPath)) {
                break
            }
            searchDirs.push(`portal2_dlc${count}`)
            count++
        }
    } catch (error) {
        console.error(
            "Error reading Portal 2 search directories:",
            error.message,
        )
    }

    return searchDirs
}

/**
 * Copy asset from Portal 2 to package resources
 * @param {string} assetPath - Asset path in Portal 2
 * @param {string} portal2Dir - Portal 2 directory path
 * @param {string} packageDir - Package directory path
 * @param {Array} searchDirs - Portal 2 search directories
 * @returns {Array} Array of copied file paths
 */
function copyAssetToPackage(assetPath, portal2Dir, packageDir, searchDirs) {
    const copiedFiles = []

    try {
        // Determine file extensions based on asset type
        let extensions = []
        let baseAssetPath = assetPath
        
        if (assetPath.startsWith("materials/")) {
            extensions = [".vtf", ".vmt"]
        } else if (assetPath.startsWith("models/")) {
            // Strip .mdl extension from the path before adding extensions
            baseAssetPath = assetPath.replace(".mdl", "")
            extensions = [".mdl", ".phy", ".vvd", ".dx90.vtx"]
        } else if (assetPath.startsWith("scripts/")) {
            extensions = [".nut"]
        } else if (assetPath.startsWith("messages/")) {
            const ext = path.extname(assetPath)
            extensions = [ext]
        } else if (assetPath.startsWith("sounds/")) {
            extensions = [".wav", ".mp3"]
        }

        // Search for the asset in Portal 2 directories
        for (const searchDir of searchDirs) {
            // Skip gameinfo_path and bee2 paths as they're not actual asset locations
            if (searchDir === "|gameinfo_path|." || searchDir.includes("bee2")) {
                continue
            }
            
            for (const ext of extensions) {
                const sourcePath = path.join(
                    portal2Dir,
                    searchDir,
                    baseAssetPath + ext,
                )

                if (fs.existsSync(sourcePath)) {
                    // Create target path using just the asset path, not the full Portal 2 structure
                    const targetPath = path.join(
                        packageDir,
                        "resources",
                        baseAssetPath + ext,
                    )

                    // Create target directory if it doesn't exist
                    const targetDir = path.dirname(targetPath)
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true })
                    }

                    // Copy file if target doesn't exist
                    if (!fs.existsSync(targetPath)) {
                        fs.copyFileSync(sourcePath, targetPath)
                        copiedFiles.push(targetPath)
                        console.log(`Copied: ${sourcePath} → ${targetPath}`)
                    } else {
                        console.log(`Already exists: ${targetPath}`)
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error copying asset ${assetPath}:`, error.message)
    }

    return copiedFiles
}

module.exports = {
    extractAssetsFromVMF,
    findDependentMaterials,
    getBaseAssets,
    getPortal2SearchDirs,
    copyAssetToPackage,
    assetExistsInPortal2,
}
