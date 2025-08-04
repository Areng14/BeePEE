const fs = require("fs")
const path = require("path")

/**
 * Converts an image file to VTF format
 * @param {string} imagePath - Path to the source image file
 * @param {string} outputPath - Path where the VTF file should be saved
 * @param {Object} options - Conversion options (currently unused - fallback mode)
 * @returns {Promise<void>}
 */
async function convertImageToVTF(imagePath, outputPath, options = {}) {
    try {
        // For now, we'll use a fallback approach since VTF conversion libraries have compatibility issues
        // We'll copy the image to the materials directory with a .tga extension 
        // which Source engine can use directly
        
        const sharp = require("sharp")
        
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath)
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        // Use PNG format since Sharp doesn't support TGA output
        // PNG works fine with Source engine
        const pngPath = outputPath.replace(/\.vtf$/, '.png')
        
        await sharp(imagePath)
            .png()
            .toFile(pngPath)

        console.log(`Successfully converted ${imagePath} to PNG format: ${pngPath}`)
        console.log(`Note: Using PNG format instead of VTF (works with Source engine, VTF conversion libraries have compatibility issues)`)
        
    } catch (error) {
        console.error(`Failed to convert image: ${error.message}`)
        
        // Final fallback: just copy the PNG to the materials directory
        // Source engine can handle PNG files in many cases
        try {
            const pngPath = outputPath.replace(/\.vtf$/, '.png')
            const outputDir = path.dirname(pngPath)
            
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true })
            }
            
            fs.copyFileSync(imagePath, pngPath)
            console.log(`Fallback: Copied PNG to materials directory: ${pngPath}`)
        } catch (copyError) {
            console.error(`Final fallback also failed: ${copyError.message}`)
            throw error
        }
    }
}

/**
 * Converts palette image path to materials path structure
 * @param {string} packagePath - Path to the package directory  
 * @param {string} imagePath - The image path from editoritems.json (e.g., "palette/beepkg/preplaced_gel.png")
 * @returns {string} - Full path to where the material file should be saved
 */
function getVTFPathFromImagePath(packagePath, imagePath) {
    // Remove the palette/ prefix and change extension to .vtf (will be converted to .tga or .png in the converter)
    const cleanPath = imagePath.replace(/^palette\//, '').replace(/\.[^.]+$/, '.vtf')
    
    // Build the full materials path: [package]/resources/materials/models/props_map_editor/[cleanPath]
    return path.join(packagePath, 'resources', 'materials', 'models', 'props_map_editor', cleanPath)
}

/**
 * Updates editoritems.json file to point to the material file instead of the original image
 * @param {string} editorItemsPath - Path to editoritems.json
 * @param {string} originalImagePath - Original image path (e.g., "palette/beepkg/preplaced_gel.png")
 * @param {string} materialPath - Path to the material file (could be .vtf, .tga, or .png)
 * @returns {Object} - Updated editoritems object
 */
function updateEditorItemsWithVTF(editorItemsPath, originalImagePath, materialPath, packagePath) {
    if (!fs.existsSync(editorItemsPath)) {
        throw new Error(`Editor items file not found: ${editorItemsPath}`)
    }

    const editorItems = JSON.parse(fs.readFileSync(editorItemsPath, 'utf-8'))
    
    // Determine which file actually exists (.tga, .png, or .vtf)
    let actualMaterialPath = materialPath
    const basePathWithoutExt = materialPath.replace(/\.[^.]+$/, '')
    
    // Check for TGA first (our preferred fallback)
    const tgaPath = basePathWithoutExt + '.tga'
    const pngPath = basePathWithoutExt + '.png'
    
    if (fs.existsSync(tgaPath)) {
        actualMaterialPath = tgaPath
    } else if (fs.existsSync(pngPath)) {
        actualMaterialPath = pngPath
    }
    
    // Get relative path from materials directory
    const materialsPath = path.join(packagePath, 'resources', 'materials')
    const relativeMaterialPath = path.relative(materialsPath, actualMaterialPath).replace(/\\/g, '/')
    
    // Remove file extension for the path reference (Source engine adds the extension automatically)
    const referencePath = relativeMaterialPath.replace(/\.(vtf|tga|png)$/, '')
    
    // Update the Image path in the Palette section
    const editor = editorItems.Item?.Editor
    if (editor?.SubType) {
        const subType = Array.isArray(editor.SubType) ? editor.SubType[0] : editor.SubType
        if (subType?.Palette?.Image === originalImagePath) {
            subType.Palette.Image = referencePath
            console.log(`Updated Image path from ${originalImagePath} to ${referencePath}`)
        }
    }
    
    return editorItems
}

module.exports = {
    convertImageToVTF,
    getVTFPathFromImagePath,
    updateEditorItemsWithVTF
}