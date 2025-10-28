const fs = require("fs")
const path = require("path")
const {
    extractAssetsFromVMF,
    findDependentMaterials,
    getPortal2SearchDirs,
    copyAssetToPackage,
    assetExistsInPortal2,
} = require("./vmfAssetExtractor")
const { findPortal2Resources } = require("../data")

/**
 * Perform autopacking for an instance VMF file
 * @param {string} instancePath - Path to the instance VMF file
 * @param {string} packageDir - Package directory path
 * @param {string} itemName - Name of the item
 * @returns {Promise<Object>} Result object with success status and packed files
 */
async function autopackInstance(instancePath, packageDir, itemName) {
    try {
        console.log(`Starting autopacking for instance: ${instancePath}`)

        // Extract assets from VMF
        const assets = extractAssetsFromVMF(instancePath)
        console.log(`Extracted assets:`, assets)

        // Get Portal 2 directory
        const portal2Resources = await findPortal2Resources()
        if (!portal2Resources || !portal2Resources.root) {
            throw new Error("Could not find Portal 2 directory")
        }
        const portal2Dir = portal2Resources.root

        // Get Portal 2 search directories
        const searchDirs = getPortal2SearchDirs(portal2Dir)
        console.log(`Portal 2 search directories:`, searchDirs)

        // Combine all assets into a single list
        let allAssets = []
        for (const assetType in assets) {
            allAssets = allAssets.concat(assets[assetType])
        }

        // Find dependent materials for models
        const dependentAssets = []
        for (const asset of allAssets) {
            if (asset.startsWith("models/")) {
                const dependentMaterials = findDependentMaterials(
                    asset,
                    portal2Dir,
                )
                dependentAssets.push(...dependentMaterials)
            }
        }

        // Combine main assets with dependent assets
        allAssets = [...allAssets, ...dependentAssets]

        // Remove duplicates
        allAssets = [...new Set(allAssets)]

        // Filter assets based on Portal 2 search paths
        // If asset exists in Portal 2 search paths, we should pack it
        // If it doesn't exist, it's either a base asset (in VPK) or missing
        const assetsToPack = []
        for (const asset of allAssets) {
            if (assetExistsInPortal2(asset, portal2Dir, searchDirs)) {
                assetsToPack.push(asset)
                console.log(`Asset needs packing (found in Portal 2 search paths): ${asset}`)
            } else {
                console.log(`Asset skipped (not in Portal 2 search paths - likely base asset): ${asset}`)
            }
        }

        console.log(`Assets to pack: ${assetsToPack.length}/${allAssets.length}`)

        // Copy assets to package
        const packedFiles = []
        for (const asset of assetsToPack) {
            const copiedFiles = copyAssetToPackage(
                asset,
                portal2Dir,
                packageDir,
                searchDirs,
            )
            packedFiles.push(...copiedFiles)
        }

        // Verify packing
        const verificationResults = []
        for (const asset of assetsToPack) {
            let found = false
            for (const searchDir of searchDirs) {
                const assetPath = path.join(portal2Dir, searchDir, asset)
                if (fs.existsSync(assetPath)) {
                    const relativePath = path.relative(portal2Dir, assetPath)
                    const packagePath = path.join(
                        packageDir,
                        "resources",
                        relativePath,
                    )
                    if (fs.existsSync(packagePath)) {
                        found = true
                        break
                    }
                }
            }
            verificationResults.push({ asset, found })
        }

        const successCount = verificationResults.filter((r) => r.found).length
        const totalCount = verificationResults.length

        console.log(
            `Autopacking completed: ${successCount}/${totalCount} assets packed`,
        )

        return {
            success: successCount === totalCount,
            packedFiles,
            verificationResults,
            totalAssets: totalCount,
            packedAssets: successCount,
        }
    } catch (error) {
        console.error(`Autopacking failed for ${instancePath}:`, error.message)
        return {
            success: false,
            error: error.message,
            packedFiles: [],
            verificationResults: [],
            totalAssets: 0,
            packedAssets: 0,
        }
    }
}

module.exports = {
    autopackInstance,
}
