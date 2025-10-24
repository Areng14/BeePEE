// MDL conversion using STUDIOMDL from Source SDK
const fs = require("fs")
const path = require("path")
const { exec, spawn } = require("child_process")
const { promisify } = require("util")
const { app } = require("electron")
const { findPortal2Resources } = require("../data")
const { convertImageToVTF } = require("./vtfConverter")

const execAsync = promisify(exec)

/**
 * Helper to get STUDIOMDL path
 */
function getStudioMDLPath() {
    const isDev = !app.isPackaged

    console.log("isDev:", isDev)
    console.log("__dirname:", __dirname)

    const studiomdlPath = isDev
        ? path.join(__dirname, "..", "libs", "studiomdl", "studiomdl.exe")
        : path.join(
              process.resourcesPath,
              "extraResources",
              "studiomdl",
              "studiomdl.exe",
          )

    console.log("Looking for STUDIOMDL at:", studiomdlPath)
    console.log("STUDIOMDL exists:", fs.existsSync(studiomdlPath))

    return studiomdlPath
}

/**
 * Generate a QC file for STUDIOMDL compilation
 * @param {string} objPath - Path to the OBJ file
 * @param {string} outputPath - Path where the QC file should be saved
 * @param {Object} options - QC generation options
 * @returns {Promise<string>} - Path to the generated QC file
 */
async function generateQCFile(objPath, outputPath, options = {}) {
    const modelName = options.modelName || path.basename(objPath, path.extname(objPath))
    const scale = options.scale || 1.0
    
    // Get relative path from QC to OBJ (they should be in same directory)
    const objFileName = path.basename(objPath)
    
    // Generate QC content
    // Each item gets its own folder: bpee/{itemID}/
    const qcContent = `$modelname "props_map_editor/bpee/${modelName}/${modelName}.mdl"
$staticprop
$body body "${objFileName}"
$surfaceprop "default"
$cdmaterials "models/props_map_editor/"
$scale ${scale}
$sequence idle "${objFileName}" fps 30
`

    console.log(`Generating QC file at: ${outputPath}`)
    console.log(`QC Content:\n${qcContent}`)
    
    fs.writeFileSync(outputPath, qcContent, "utf-8")
    console.log("QC file generated successfully")
    
    return outputPath
}

/**
 * Apply cartoonification to an image using the cartoon.exe tool
 * @param {string} inputPath - Path to the input image
 * @param {string} outputPath - Path for the cartoonified output
 */
async function applyCartoonification(inputPath, outputPath) {
    const cartoonExePath = path.join(__dirname, '..', 'libs', 'areng_cartoonify', 'cartoon.exe')
    
    if (!fs.existsSync(cartoonExePath)) {
        console.warn(`⚠️ Cartoon.exe not found at: ${cartoonExePath}`)
        // Copy original file as fallback
        fs.copyFileSync(inputPath, outputPath)
        return
    }
    
    // Copy original file to output path FIRST
    // Cartoon.exe modifies files IN-PLACE!
    fs.copyFileSync(inputPath, outputPath)
    
    return new Promise((resolve, reject) => {
        // Run cartoon.exe on the OUTPUT file (not the original)
        const child = spawn(cartoonExePath, [outputPath], {
            cwd: path.dirname(cartoonExePath),
            stdio: 'pipe',
            windowsHide: true
        })
        
        let stdout = ''
        let stderr = ''
        
        child.stdout?.on('data', (data) => {
            stdout += data.toString()
        })
        
        child.stderr?.on('data', (data) => {
            stderr += data.toString()
        })
        
        child.on('close', (code) => {
            if (code === 0) {
                // File was modified in-place, already at outputPath
                console.log(`    ✅ Cartoonified: ${path.basename(outputPath)}`)
                resolve()
            } else {
                console.warn(`⚠️ Cartoon.exe failed with code ${code}: ${stderr}`)
                // File was already copied, just use the original
                resolve()
            }
        })
        
        child.on('error', (error) => {
            console.warn(`⚠️ Cartoon.exe error: ${error.message}`)
            // File was already copied, just use the original
            resolve()
        })
    })
}

/**
 * Reverse the rotation that was applied for Three.js viewing
 * Converts from Three.js coordinates back to Source Engine coordinates
 * @param {string} objPath - Path to the rotated OBJ file
 * @param {string} outputPath - Path for the un-rotated OBJ file
 */
function reverseSourceEngineRotation(objPath, outputPath) {
    console.log(`🔄 Reversing rotation for STUDIOMDL compilation...`)
    
    const objContent = fs.readFileSync(objPath, "utf-8")
    const lines = objContent.split("\n")
    const reversedLines = []
    
    let vertexCount = 0
    let normalCount = 0
    
    for (const line of lines) {
        if (line.startsWith("v ")) {
            // Vertex line: v x y z [w]
            const parts = line.trim().split(/\s+/)
            if (parts.length >= 4) {
                const x = parseFloat(parts[1])
                const y = parseFloat(parts[2])
                const z = parseFloat(parts[3])
                
                // Apply Y -90° rotation first
                let rotatedX = -z
                let rotatedY = y
                let rotatedZ = x
                
                // Then apply X +90° rotation
                const originalX = rotatedX
                const originalY = -rotatedZ
                const originalZ = rotatedY
                
                let reversedLine = `v ${originalX} ${originalY} ${originalZ}`
                if (parts.length > 4) {
                    reversedLine += ` ${parts[4]}`
                }
                reversedLines.push(reversedLine)
                vertexCount++
            } else {
                reversedLines.push(line)
            }
        } else if (line.startsWith("vn ")) {
            // Normal line: vn x y z
            const parts = line.trim().split(/\s+/)
            if (parts.length >= 4) {
                const nx = parseFloat(parts[1])
                const ny = parseFloat(parts[2])
                const nz = parseFloat(parts[3])
                
                // Apply Y -90° rotation only (same as vertices)
                const originalNx = nz
                const originalNy = ny
                const originalNz = -nx
                
                reversedLines.push(`vn ${originalNx} ${originalNy} ${originalNz}`)
                normalCount++
            } else {
                reversedLines.push(line)
            }
        } else {
            reversedLines.push(line)
        }
    }
    
    fs.writeFileSync(outputPath, reversedLines.join("\n"), "utf-8")
    console.log(`✅ Reversed rotation for ${vertexCount} vertices and ${normalCount} normals`)
    console.log(`💾 Un-rotated OBJ saved to: ${outputPath}`)
}

/**
 * Converts an OBJ file to MDL format using STUDIOMDL
 * @param {string} objPath - Path to the source OBJ file (rotated for Three.js viewing)
 * @param {string} outputDir - Directory where MDL files should be created (temp location)
 * @param {Object} options - Conversion options
 * @returns {Promise<{mdlPath: string, vvdPath: string, vtxPath: string}>}
 */
async function convertObjToMDL(objPath, outputDir, options = {}) {
    if (!objPath || !fs.existsSync(objPath)) {
        throw new Error(`OBJ file not found: ${objPath}`)
    }

    const studiomdlPath = getStudioMDLPath()
    if (!fs.existsSync(studiomdlPath)) {
        throw new Error(`STUDIOMDL not found at: ${studiomdlPath}`)
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    const modelName = options.modelName || path.basename(objPath, path.extname(objPath))
    
    // Create a copy of the OBJ with REVERSED rotation for STUDIOMDL
    // The original OBJ is rotated for Three.js viewing, but Source Engine needs original coordinates
    const unrotatedObjPath = objPath.replace('.obj', '_sourcecoords.obj')
    reverseSourceEngineRotation(objPath, unrotatedObjPath)
    
    // Generate QC file pointing to the UN-ROTATED OBJ (Source Engine coordinates)
    const qcPath = path.join(path.dirname(unrotatedObjPath), `${modelName}.qc`)
    await generateQCFile(unrotatedObjPath, qcPath, { modelName, scale: options.scale })

    console.log(`Starting STUDIOMDL compilation...`)
    console.log(`  QC File: ${qcPath}`)
    console.log(`  Output Dir: ${outputDir}`)

    // Get Portal 2 game directory for STUDIOMDL -game parameter
    let gameDir = null
    try {
        const p2Resources = await findPortal2Resources()
        if (p2Resources?.root) {
            gameDir = path.join(p2Resources.root, "portal2")
        }
    } catch (error) {
        console.warn("Could not find Portal 2 directory:", error.message)
    }

    if (!gameDir || !fs.existsSync(gameDir)) {
        throw new Error("Portal 2 game directory not found. STUDIOMDL requires -game parameter.")
    }

    // Copy materials to Portal 2 game directory for STUDIOMDL compilation
    const gameMaterialsDir = path.join(gameDir, "materials", "models", "props_map_editor")
    console.log(`📁 Copying materials to Portal 2 for STUDIOMDL: ${gameMaterialsDir}`)
    
    if (!fs.existsSync(gameMaterialsDir)) {
        fs.mkdirSync(gameMaterialsDir, { recursive: true })
    }
    
    // Copy materials from package to Portal 2 (temporarily for compilation)
    const packageMaterialsDir = path.join(process.cwd(), "packages", "PieCreeper's Items", "resources", "materials", "models", "props_map_editor")
    if (fs.existsSync(packageMaterialsDir)) {
        console.log(`📋 Copying materials from: ${packageMaterialsDir}`)
        // Copy all VTF/VMT files to Portal 2
        const copyDir = (src, dest) => {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
            const entries = fs.readdirSync(src, { withFileTypes: true })
            for (const entry of entries) {
                const srcPath = path.join(src, entry.name)
                const destPath = path.join(dest, entry.name)
                if (entry.isDirectory()) {
                    copyDir(srcPath, destPath)
                } else {
                    fs.copyFileSync(srcPath, destPath)
                }
            }
        }
        copyDir(packageMaterialsDir, gameMaterialsDir)
        console.log(`✅ Materials copied to Portal 2 for STUDIOMDL compilation`)
    } else {
        console.warn(`⚠️ Package materials directory not found: ${packageMaterialsDir}`)
    }

    // Run STUDIOMDL
    // Command: studiomdl.exe -game "path/to/portal2" -nop4 -verbose "path/to/file.qc"
    const cmd = `"${studiomdlPath}" -game "${gameDir}" -nop4 -verbose "${qcPath}"`
    
    console.log(`Executing STUDIOMDL: ${cmd}`)

    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: path.dirname(studiomdlPath),
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
            timeout: 120000, // 2 minute timeout
        })

        console.log("STUDIOMDL stdout:", stdout)
        if (stderr) console.warn("STUDIOMDL stderr:", stderr)

        // STUDIOMDL outputs to the game directory structure
        // The model will be at: gameDir/models/props_map_editor/bpee/{itemID}/{itemID}.mdl
        const compiledBasePath = path.join(gameDir, "models", "props_map_editor", "bpee", modelName, modelName)
        const mdlPath = `${compiledBasePath}.mdl`
        const vvdPath = `${compiledBasePath}.vvd`
        
        // STUDIOMDL can create various VTX formats, check which ones exist
        const dx90VtxPath = `${compiledBasePath}.dx90.vtx`
        const dx80VtxPath = `${compiledBasePath}.dx80.vtx`
        const swVtxPath = `${compiledBasePath}.sw.vtx`
        const legacyVtxPath = `${compiledBasePath}.vtx`  // Sometimes just .vtx

        // Check if files were created
        if (!fs.existsSync(mdlPath)) {
            throw new Error(`MDL file was not created at expected location: ${mdlPath}`)
        }

        console.log(`✅ MDL compilation successful!`)
        console.log(`  MDL: ${mdlPath}`)
        console.log(`  VVD: ${fs.existsSync(vvdPath) ? vvdPath : 'not found'}`)
        console.log(`  DX90 VTX: ${fs.existsSync(dx90VtxPath) ? dx90VtxPath : 'not found'}`)
        console.log(`  DX80 VTX: ${fs.existsSync(dx80VtxPath) ? dx80VtxPath : 'not found'}`)
        console.log(`  SW VTX: ${fs.existsSync(swVtxPath) ? swVtxPath : 'not found'}`)
        console.log(`  Legacy VTX: ${fs.existsSync(legacyVtxPath) ? legacyVtxPath : 'not found'}`)

        // Collect all VTX files that exist
        const result = {
            mdlPath: fs.existsSync(mdlPath) ? mdlPath : null,
            vvdPath: fs.existsSync(vvdPath) ? vvdPath : null,
        }
        
        // Portal 2 expects .dx90.vtx format
        // If STUDIOMDL created just .vtx, we need to also copy it as .dx90.vtx
        if (fs.existsSync(dx90VtxPath)) {
            result.dx90_vtxPath = dx90VtxPath
        } else if (fs.existsSync(legacyVtxPath)) {
            // Legacy .vtx exists, copy it as dx90
            console.log("⚠️  Found legacy .vtx, will copy as .dx90.vtx for Portal 2 compatibility")
            result.dx90_vtxPath = legacyVtxPath  // Will be renamed during copy
            result.vtxPath = legacyVtxPath  // Also keep original
        }
        
        if (fs.existsSync(dx80VtxPath)) result.dx80_vtxPath = dx80VtxPath
        if (fs.existsSync(swVtxPath)) result.sw_vtxPath = swVtxPath

        // DON'T clean up materials - leave them in Portal 2 for testing!
        // BEEMOD will handle installing them properly later
        console.log(`ℹ️ Materials left in Portal 2 for testing: ${gameMaterialsDir}`)

        return result
    } catch (error) {
        console.error("STUDIOMDL execution failed:", error)
        throw new Error(`STUDIOMDL compilation failed: ${error.message}`)
    }
}

/**
 * Copy compiled MDL files to package resources directory and clean up Portal 2 directory
 * @param {Object} compiledFiles - Object containing paths to compiled MDL files
 * @param {string} packagePath - Root path of the package
 * @param {string} itemName - Name of the item (for the model filename)
 * @param {string} materialsSourceDir - Directory containing extracted materials
 * @returns {Promise<Object>} - Object containing final paths
 */
async function copyMDLToPackage(compiledFiles, packagePath, itemName, materialsSourceDir = null) {
    // Target directory in package: resources/models/props_map_editor/bpee/{itemID}/
    const targetDir = path.join(
        packagePath,
        "resources",
        "models",
        "props_map_editor",
        "bpee",
        itemName
    )

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
        console.log(`Created directory: ${targetDir}`)
    }
    
    // Convert and copy materials if they exist
    if (materialsSourceDir && fs.existsSync(materialsSourceDir)) {
        console.log("📦 Converting and copying materials to VTF/VMT format...")
        const materialTargetDir = path.join(
            packagePath,
            "resources",
            "materials",
            "models",
            "props_map_editor"
        )
        
        // Find all PNG/TGA files and convert them to VTF + create VMT
        const convertMaterials = async (src, dest) => {
            if (!fs.existsSync(src)) {
                console.warn(`⚠️ Source materials directory not found: ${src}`)
                return
            }
            
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true })
            }
            
            const entries = fs.readdirSync(src, { withFileTypes: true })
            for (const entry of entries) {
                const srcPath = path.join(src, entry.name)
                const destPath = path.join(dest, entry.name)
                
                if (entry.isDirectory()) {
                    await convertMaterials(srcPath, destPath)
                } else if (entry.name.match(/\.(png|tga)$/i)) {
                    // Convert PNG/TGA to VTF (VMT created later based on MTL material names)
                    const vtfPath = destPath.replace(/\.(png|tga)$/i, '.vtf')
                    
                    try {
                        console.log(`  Converting ${entry.name}...`)
                        console.log(`    Source: ${srcPath}`)
                        console.log(`    Target VTF: ${vtfPath}`)
                        
                        // CARTOONIFY the source image BEFORE converting to VTF
                        const cartoonifiedPath = srcPath.replace(/\.(png|tga)$/i, '_cartoonified.png')
                        console.log(`    Cartoonifying: ${cartoonifiedPath}`)
                        
                        // Apply cartoonification
                        await applyCartoonification(srcPath, cartoonifiedPath)
                        
                        // Convert cartoonified image to VTF
                        await convertImageToVTF(cartoonifiedPath, vtfPath, {
                            format: "DXT5",
                            generateMipmaps: true
                        })
                        
                        // Clean up temporary cartoonified file
                        if (fs.existsSync(cartoonifiedPath)) {
                            fs.unlinkSync(cartoonifiedPath)
                        }
                        
                        console.log(`    ✅ VTF created`)
                        console.log(`  ✅ Converted: ${entry.name} → VTF`)
                    } catch (error) {
                        console.error(`  ❌ FAILED to convert ${entry.name}:`)
                        console.error(`     Error: ${error.message}`)
                        console.error(`     Stack: ${error.stack}`)
                    }
                }
            }
        }
        
        // Parse MTL file to get material names and their texture paths
        const mtlFilePath = path.join(packagePath, 'temp_models', itemName + '_0.mtl')
        
        const materialMap = {}
        if (fs.existsSync(mtlFilePath)) {
            console.log(`📖 Parsing MTL file: ${mtlFilePath}`)
            const mtlContent = fs.readFileSync(mtlFilePath, 'utf-8')
            const lines = mtlContent.split('\n')
            let currentMaterial = null
            
            for (const line of lines) {
                if (line.startsWith('newmtl ')) {
                    currentMaterial = line.substring(7).trim()
                } else if (currentMaterial && line.startsWith('map_Kd ')) {
                    const texturePath = line.substring(7).trim().replace('materials/', '')
                    materialMap[currentMaterial] = texturePath
                }
            }
            console.log(`Found ${Object.keys(materialMap).length} materials in MTL file`)
        } else {
            console.warn(`⚠️ MTL file not found: ${mtlFilePath}`)
        }
        
        // Convert all materials from temp_models/materials/ to resources/materials/models/props_map_editor/
        // And create VMT files based on MATERIAL NAMES, not file paths
        try {
            await convertMaterials(materialsSourceDir, materialTargetDir)
            
            // Now create VMT files in the correct locations based on material names
            for (const [materialName, texturePath] of Object.entries(materialMap)) {
                try {
                    const vmtPath = path.join(materialTargetDir, materialName + '.vmt')
                    const vmtDir = path.dirname(vmtPath)
                    
                    if (!fs.existsSync(vmtDir)) {
                        fs.mkdirSync(vmtDir, { recursive: true })
                    }
                    
                    // Use texture PATH (not material name) for $baseTexture
                    // Remove .png/.tga extension from texture path
                    const textureNameWithoutExt = texturePath.replace(/\.(png|tga)$/i, '')
                    
                    const vmtContent = `patch
{
include "materials/models/props_map_editor/item_lighting_common.vmt"
insert
{
$basetexture "models/props_map_editor/${textureNameWithoutExt}"
$selfillum 1
$model 1
}
}
`
                    fs.writeFileSync(vmtPath, vmtContent, 'utf-8')
                    console.log(`  ✅ Created VMT for material: ${materialName} → texture: ${textureNameWithoutExt}`)
                } catch (error) {
                    console.error(`  ❌ Failed to create VMT for material ${materialName}: ${error.message}`)
                }
            }
            
            console.log(`✅ Materials converted and copied to: ${materialTargetDir}`)
        } catch (error) {
            console.warn(`⚠️  Failed to convert materials: ${error.message}`)
        }
    }

    const copiedFiles = {}
    const filesToDelete = []
    
    // Copy each file type (ALL files: .mdl, .vvd, .vtx)
    // KEEP THE ORIGINAL EXTENSIONS! Don't rename!
    for (const [fileType, sourcePath] of Object.entries(compiledFiles)) {
        if (sourcePath && fs.existsSync(sourcePath)) {
            // Get the FULL extension (e.g., .dx90.vtx, not just .vtx)
            const fileName = path.basename(sourcePath)
            const targetPath = path.join(targetDir, fileName)
            
            fs.copyFileSync(sourcePath, targetPath)
            console.log(`Copied ${fileType}: ${sourcePath} -> ${targetPath}`)
            
            copiedFiles[fileType] = targetPath
            
            // Only add to delete list once (avoid deleting same file twice if it's used for multiple types)
            if (!filesToDelete.includes(sourcePath)) {
                filesToDelete.push(sourcePath)
            }
        }
    }

    // Clean up: Delete the compiled files from Portal 2 directory to avoid pollution
    console.log("🧹 Cleaning up Portal 2 directory...")
    let cleanupDir = null
    for (const filePath of filesToDelete) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
                console.log(`  Deleted: ${filePath}`)
                // Remember the directory for cleanup
                if (!cleanupDir) cleanupDir = path.dirname(filePath)
            }
        } catch (error) {
            console.warn(`  Failed to delete ${filePath}: ${error.message}`)
            // Don't throw - cleanup failure shouldn't stop the process
        }
    }

    // Also try to clean up empty directories (bpee/{itemID} folder structure)
    if (cleanupDir) {
        try {
            // Try to remove {itemID}/ folder if empty
            const itemIdDir = cleanupDir
            if (fs.existsSync(itemIdDir) && fs.readdirSync(itemIdDir).length === 0) {
                fs.rmdirSync(itemIdDir)
                console.log(`  Removed empty directory: ${itemIdDir}`)
                
                // Try bpee/ folder
                const bpeeDir = path.dirname(itemIdDir)
                if (fs.existsSync(bpeeDir) && fs.readdirSync(bpeeDir).length === 0) {
                    fs.rmdirSync(bpeeDir)
                    console.log(`  Removed empty directory: ${bpeeDir}`)
                }
            }
        } catch (error) {
            console.warn(`  Failed to cleanup directories: ${error.message}`)
        }
    }

    // Return the relative path for editoritems (relative to resources/models/)
    const relativeModelPath = `bpee/${itemName}/${itemName}.mdl`
    
    return {
        copiedFiles,
        relativeModelPath,
        targetDir
    }
}

/**
 * Main function: Convert OBJ to MDL and place in package
 * @param {string} objPath - Path to source OBJ file
 * @param {string} packagePath - Root path of the package
 * @param {string} itemName - Name of the item
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - Object with MDL paths and metadata
 */
async function convertAndInstallMDL(objPath, packagePath, itemName, options = {}) {
    console.log(`🔄 Starting OBJ to MDL conversion...`)
    console.log(`  OBJ: ${objPath}`)
    console.log(`  Package: ${packagePath}`)
    console.log(`  Item: ${itemName}`)

    // Step 1: Compile OBJ to MDL using STUDIOMDL
    const tempDir = path.join(packagePath, "temp_models")
    const compiledFiles = await convertObjToMDL(objPath, tempDir, {
        modelName: itemName,
        scale: options.scale || 1.0
    })

    // Step 2: Copy MDL files AND materials to package resources
    const materialsDir = path.join(tempDir, "materials")
    const result = await copyMDLToPackage(compiledFiles, packagePath, itemName, materialsDir)

    console.log(`✅ MDL conversion and installation complete!`)
    console.log(`  Model path for editoritems: ${result.relativeModelPath}`)

    return {
        success: true,
        ...result,
        compiledFiles
    }
}

module.exports = {
    getStudioMDLPath,
    generateQCFile,
    convertObjToMDL,
    copyMDLToPackage,
    convertAndInstallMDL
}

