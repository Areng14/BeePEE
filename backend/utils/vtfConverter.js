const fs = require("fs")
const path = require("path")
const { VTFFile, VTFImageFormatType } = require("vtflib")
const sharp = require("sharp")

/**
 * Converts an image file to VTF format
 * @param {string} imagePath - Path to the source image file
 * @param {string} outputPath - Path where the VTF file should be saved
 * @param {Object} options - Conversion options
 * @param {string} options.format - VTF image format (default: 'DXT5')
 * @param {boolean} options.generateMipmaps - Whether to generate mipmaps (default: true)
 * @returns {Promise<void>}
 */
async function convertImageToVTF(imagePath, outputPath, options = {}) {
    const {
        format = 'DXT5',
        generateMipmaps = true
    } = options

    try {
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath)
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        // Read and process the image with Sharp
        const imageBuffer = await sharp(imagePath)
            .ensureAlpha() // Ensure alpha channel for VTF
            .raw()
            .toBuffer({ resolveWithObject: true })

        const { data, info } = imageBuffer
        const { width, height, channels } = info

        // Convert raw pixel data to RGBA8888 format expected by VTFLib
        let rgbaData
        if (channels === 4) {
            // Already RGBA
            rgbaData = data
        } else if (channels === 3) {
            // RGB -> RGBA (add alpha channel)
            rgbaData = new Uint8Array(width * height * 4)
            for (let i = 0; i < width * height; i++) {
                rgbaData[i * 4] = data[i * 3]     // R
                rgbaData[i * 4 + 1] = data[i * 3 + 1] // G
                rgbaData[i * 4 + 2] = data[i * 3 + 2] // B
                rgbaData[i * 4 + 3] = 255         // A (fully opaque)
            }
        } else {
            throw new Error(`Unsupported channel count: ${channels}`)
        }

        // Create VTF file
        const vtfFile = new VTFFile()
        
        // Initialize VTF with image dimensions
        vtfFile.init(width, height, 1, 1, 1, VTFImageFormatType.RGBA8888, true, generateMipmaps)
        
        // Set the image data
        vtfFile.setData(0, 0, 0, 0, rgbaData)
        
        // Convert to desired format if not RGBA8888
        if (format !== 'RGBA8888') {
            const formatEnum = VTFImageFormatType[format]
            if (!formatEnum) {
                throw new Error(`Unsupported VTF format: ${format}`)
            }
            vtfFile.convertFormat(formatEnum)
        }

        // Generate mipmaps if requested
        if (generateMipmaps) {
            vtfFile.generateMipmaps()
        }

        // Save the VTF file
        const vtfBuffer = vtfFile.save()
        fs.writeFileSync(outputPath, vtfBuffer)

        console.log(`Successfully converted ${imagePath} to ${outputPath}`)
        
    } catch (error) {
        console.error(`Failed to convert image to VTF: ${error.message}`)
        throw error
    }
}

/**
 * Converts palette image path to VTF path structure
 * @param {string} packagePath - Path to the package directory  
 * @param {string} imagePath - The image path from editoritems.json (e.g., "palette/beepkg/preplaced_gel.png")
 * @returns {string} - Full path to where VTF should be saved
 */
function getVTFPathFromImagePath(packagePath, imagePath) {
    // Remove the palette/ prefix and change extension to .vtf
    const cleanPath = imagePath.replace(/^palette\//, '').replace(/\.[^.]+$/, '.vtf')
    
    // Build the full VTF path: [package]/resources/materials/models/props_map_editor/[cleanPath]
    return path.join(packagePath, 'resources', 'materials', 'models', 'props_map_editor', cleanPath)
}

/**
 * Updates editoritems.json file to point to the VTF instead of the original image
 * @param {string} editorItemsPath - Path to editoritems.json
 * @param {string} originalImagePath - Original image path (e.g., "palette/beepkg/preplaced_gel.png")
 * @param {string} vtfPath - Path to the VTF file
 * @returns {Object} - Updated editoritems object
 */
function updateEditorItemsWithVTF(editorItemsPath, originalImagePath, vtfPath, packagePath) {
    if (!fs.existsSync(editorItemsPath)) {
        throw new Error(`Editor items file not found: ${editorItemsPath}`)
    }

    const editorItems = JSON.parse(fs.readFileSync(editorItemsPath, 'utf-8'))
    
    // Get relative path from materials directory
    const materialsPath = path.join(packagePath, 'resources', 'materials')
    const relativeVTFPath = path.relative(materialsPath, vtfPath).replace(/\\/g, '/')
    
    // Remove .vtf extension for the path reference
    const referencePath = relativeVTFPath.replace(/\.vtf$/, '')
    
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