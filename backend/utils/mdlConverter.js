// MDL conversion using STUDIOMDL from Source SDK
const fs = require("fs")
const path = require("path")
const { exec, spawn } = require("child_process")
const { promisify } = require("util")
const { app } = require("electron")
const sharp = require("sharp")
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
    // Materials folder can be different from model name (for shared materials)
    const materialsFolder = options.materialsFolder || modelName
    // Parent folder for models - all variants go in same folder
    const modelFolder = options.modelFolder || modelName
    
    // Get relative path from QC to OBJ (they should be in same directory)
    const objFileName = path.basename(objPath)
    
    // Generate QC content
    // All models for an item go in the same folder: bpee/{itemID}/{variant}.mdl
    // $cdmaterials should point to where VMT files are stored (relative to materials/ folder)
    const qcContent = `$modelname "props_map_editor/bpee/${modelFolder}/${modelName}.mdl"
$staticprop
$body body "${objFileName}"
$surfaceprop "default"
$cdmaterials "models/props_map_editor/bpee/${materialsFolder}/"
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
    const isDev = !app.isPackaged
    const cartoonExePath = isDev
        ? path.join(__dirname, '..', 'libs', 'areng_cartoonify', 'cartoon.exe')
        : path.join(process.resourcesPath, 'extraResources', 'areng_cartoonify', 'cartoon.exe')
    
    if (!fs.existsSync(cartoonExePath)) {
        console.error(`❌ CARTOON.EXE NOT FOUND at: ${cartoonExePath}`)
        console.error(`   Cartoonification will be SKIPPED - using original textures`)
        // Copy original file as fallback
        fs.copyFileSync(inputPath, outputPath)
        return
    }
    
    console.log(`   🎨 Using cartoon.exe from: ${cartoonExePath}`)
    
    // Copy original file to output path FIRST
    // Cartoon.exe modifies files IN-PLACE!
    fs.copyFileSync(inputPath, outputPath)
    
    return new Promise((resolve, reject) => {
        // Get file size and modified time BEFORE cartoonification for validation
        const statsBefore = fs.statSync(outputPath)
        const sizeBefore = statsBefore.size
        const mtimeBefore = statsBefore.mtime.getTime()
        
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
                // Verify the file was actually modified
                const statsAfter = fs.statSync(outputPath)
                const sizeAfter = statsAfter.size
                const mtimeAfter = statsAfter.mtime.getTime()
                
                // Check if file was actually modified (size or mtime changed)
                if (sizeAfter !== sizeBefore || mtimeAfter !== mtimeBefore) {
                    console.log(`    ✅ Cartoonified: ${path.basename(outputPath)} (${sizeBefore}→${sizeAfter} bytes)`)
                    if (stdout) console.log(`       stdout: ${stdout.trim()}`)
                } else {
                    console.error(`    ⚠️  CARTOON WARNING: File not modified despite exit code 0`)
                    console.error(`       File: ${path.basename(outputPath)}`)
                    console.error(`       stdout: ${stdout.trim() || '(empty)'}`)
                    console.error(`       stderr: ${stderr.trim() || '(empty)'}`)
                    console.error(`       Using original texture (no cartoonification applied)`)
                }
                resolve()
            } else {
                console.error(`❌ CARTOON.EXE FAILED with exit code ${code}`)
                console.error(`   File: ${path.basename(outputPath)}`)
                console.error(`   stderr: ${stderr}`)
                console.error(`   stdout: ${stdout}`)
                console.error(`   Using original non-cartoonified texture as fallback`)
                // File was already copied, just use the original
                resolve()
            }
        })
        
        child.on('error', (error) => {
            console.error(`❌ CARTOON.EXE SPAWN ERROR: ${error.message}`)
            console.error(`   Using original non-cartoonified texture as fallback`)
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
 * @param {string} options.packageMaterialsDir - Directory containing the VTF/VMT materials for this model
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
    await generateQCFile(unrotatedObjPath, qcPath, { 
        modelName, 
        scale: options.scale,
        materialsFolder: options.materialsFolder, // Allow override for shared materials
        modelFolder: options.modelFolder // Allow override for model parent folder
    })

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
    // Materials should ALREADY be converted to VTF/VMT format before calling this function
    const gameMaterialsDir = path.join(gameDir, "materials", "models", "props_map_editor")
    console.log(`📁 Copying materials to Portal 2 for STUDIOMDL: ${gameMaterialsDir}`)
    
    if (!fs.existsSync(gameMaterialsDir)) {
        fs.mkdirSync(gameMaterialsDir, { recursive: true })
    }
    
    // Copy materials from package resources to Portal 2 (temporarily for compilation)
    const packageMaterialsDir = options.packageMaterialsDir
    if (packageMaterialsDir && fs.existsSync(packageMaterialsDir)) {
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
        console.warn(`⚠️ Package materials directory not provided or not found: ${packageMaterialsDir}`)
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
        // The model will be at: gameDir/models/props_map_editor/bpee/{modelFolder}/{modelName}.mdl
        const modelFolder = options.modelFolder || modelName
        const compiledBasePath = path.join(gameDir, "models", "props_map_editor", "bpee", modelFolder, modelName)
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
 * Convert materials from PNG to VTF/VMT format and copy to package resources
 * @param {string} materialsSourceDir - Directory containing PNG materials from VMF2OBJ
 * @param {string} materialTargetDir - Target directory in package resources
 * @param {string} tempDir - Temporary models directory (for MTL file)
 * @param {string} itemName - Name of the item
 */
async function convertMaterialsToPackage(materialsSourceDir, materialTargetDir, tempDir, itemName) {
    if (!materialsSourceDir || !fs.existsSync(materialsSourceDir)) {
        console.warn(`⚠️ Materials source directory not found: ${materialsSourceDir}`)
        return
    }

    console.log("📦 Converting and copying materials to VTF/VMT format...")

    // Find all PNG/TGA files and convert them to VTF + create VMT
    // FLAT structure - all VTFs go directly in materialTargetDir
    const convertMaterials = async (src, flatDest) => {
        if (!fs.existsSync(src)) {
            console.warn(`⚠️ Source materials directory not found: ${src}`)
            return
        }
        
        if (!fs.existsSync(flatDest)) {
            fs.mkdirSync(flatDest, { recursive: true })
        }
        
        const entries = fs.readdirSync(src, { withFileTypes: true })
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name)
            
            if (entry.isDirectory()) {
                // Recurse into subdirectories but keep output FLAT
                await convertMaterials(srcPath, flatDest)
            } else if (entry.name.match(/\.png$/i)) {
                // Only process PNG files (TGAs were already converted to PNG by VMF2OBJ)
                // Textures are ALREADY cartoonified by VMF2OBJ stage, just convert to VTF
                // Extract just the filename, ignore any directory structure
                const baseFileName = path.basename(entry.name, '.png')
                const vtfPath = path.join(flatDest, baseFileName + '.vtf')
                
                try {
                    console.log(`  Converting ${entry.name}...`)
                    console.log(`    Source: ${srcPath}`)
                    console.log(`    Target VTF: ${vtfPath}`)
                    
                    // Convert PNG directly to VTF (already cartoonified by VMF2OBJ)
                    // Skip automatic VMT creation - we'll create them ourselves with correct paths
                    await convertImageToVTF(srcPath, vtfPath, {
                        format: "DXT5",
                        generateMipmaps: true,
                        skipVMT: true
                    })
                    
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
    // Try to find the MTL file - it might have a different name than itemName
    let mtlFilePath = path.join(tempDir, itemName + '_0.mtl')
    
    // If not found, search for any *_0.mtl file in temp directory
    if (!fs.existsSync(mtlFilePath)) {
        const tempFiles = fs.readdirSync(tempDir)
        const mtlFile = tempFiles.find(f => f.endsWith('_0.mtl'))
        if (mtlFile) {
            mtlFilePath = path.join(tempDir, mtlFile)
            console.log(`⚠️  Expected MTL file not found, using: ${mtlFile}`)
        }
    }
    
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
        
        // Now create VMT files based on TEXTURE filenames (not material names!)
        // STUDIOMDL references materials by their TEXTURE filename, not the MTL material name
        for (const [materialName, texturePath] of Object.entries(materialMap)) {
            try {
                // Extract just the texture filename (no path, no extension)
                // Use split on BOTH / and \ since MTL files use forward slashes
                const textureFileName = texturePath.split(/[/\\]/).pop().replace(/\.(png|tga)$/i, '')
                
                // VMT filename MUST match the texture filename (what STUDIOMDL uses)
                const vmtPath = path.join(materialTargetDir, textureFileName + '.vmt')
                
                const vmtContent = `patch
{
include "materials/models/props_map_editor/item_lighting_common.vmt"
insert
{
$basetexture "models/props_map_editor/bpee/${itemName}/${textureFileName}"
$selfillum 1
$model 1
}
}
`
                fs.writeFileSync(vmtPath, vmtContent, 'utf-8')
                console.log(`  ✅ Created VMT: ${textureFileName}.vmt (for material: ${materialName.split(/[/\\]/).pop()})`)
            } catch (error) {
                console.error(`  ❌ Failed to create VMT for material ${materialName}: ${error.message}`)
            }
        }
        
        console.log(`✅ Materials converted and copied to: ${materialTargetDir}`)
    } catch (error) {
        console.warn(`⚠️  Failed to convert materials: ${error.message}`)
        throw error
    }
}

/**
 * Copy compiled MDL files to package resources directory and clean up Portal 2 directory
 * @param {Object} compiledFiles - Object containing paths to compiled MDL files
 * @param {string} packagePath - Root path of the package
 * @param {string} itemName - Name of the item (for the model filename)
 * @param {string} materialsSourceDir - DEPRECATED: Materials should be converted before calling this
 * @returns {Promise<Object>} - Object containing final paths
 */
async function copyMDLToPackage(compiledFiles, packagePath, itemName, materialsSourceDir = null, sharedFolder = null) {
    // Target directory in package: resources/models/props_map_editor/bpee/{itemID}/
    // Use sharedFolder if provided (for multi-model items), otherwise use itemName
    const folderName = sharedFolder || itemName
    const targetDir = path.join(
        packagePath,
        "resources",
        "models",
        "props_map_editor",
        "bpee",
        folderName
    )

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
        console.log(`Created directory: ${targetDir}`)
    }
    
    // Materials are now converted BEFORE this function is called
    // (Legacy parameter materialsSourceDir is kept for backward compatibility but ignored)

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
    // Use folderName (shared folder) not itemName
    const relativeModelPath = `bpee/${folderName}/${itemName}.mdl`
    
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

    const tempDir = path.join(packagePath, "temp_models")

    // Step 1: Convert materials from PNG to VTF/VMT FIRST (unless using shared materials)
    let materialTargetDir
    
    if (options.skipMaterialConversion && options.sharedMaterialsPath) {
        console.log(`📦 Step 1: Using shared materials from: ${options.sharedMaterialsPath}`)
        materialTargetDir = options.sharedMaterialsPath
    } else {
        console.log(`📦 Step 1: Converting materials to VTF/VMT format...`)
        const materialsSourceDir = path.join(tempDir, "materials")
        materialTargetDir = path.join(
            packagePath,
            "resources",
            "materials",
            "models",
            "props_map_editor",
            "bpee",
            itemName
        )
        
        await convertMaterialsToPackage(materialsSourceDir, materialTargetDir, tempDir, itemName)
    }

    // Step 2: Compile OBJ to MDL using STUDIOMDL (now materials are ready!)
    console.log(`🔨 Step 2: Compiling MDL with STUDIOMDL...`)
    
    // Extract the materials folder name from the path
    // e.g., ".../bpee/old_aperture_walls/" -> "old_aperture_walls"
    const materialsFolderName = path.basename(materialTargetDir)
    
    // Use sharedModelFolder if provided, otherwise use itemName
    const modelFolderName = options.sharedModelFolder || itemName
    
    const compiledFiles = await convertObjToMDL(objPath, tempDir, {
        modelName: itemName,
        scale: options.scale || 1.0,
        packageMaterialsDir: materialTargetDir, // Pass the materials location
        materialsFolder: materialsFolderName, // Use shared folder name for $cdmaterials
        modelFolder: modelFolderName // Use shared folder for all model variants
    })

    // Step 3: Copy MDL files to package resources (materials are already there)
    console.log(`📋 Step 3: Copying compiled MDL to package...`)
    const result = await copyMDLToPackage(compiledFiles, packagePath, itemName, null, modelFolderName)

    console.log(`✅ MDL conversion and installation complete!`)
    console.log(`  Model path for editoritems: ${result.relativeModelPath}`)

    return {
        success: true,
        ...result,
        compiledFiles
    }
}

// VBSP PARSER FOR MULTI-MODEL GENERATION
// ===========================================

/**
 * Parses VBSP blocks to extract a mapping from variable values to instance paths.
 * @param {Array} blocks - The array of VBSP blocks from meta.json.
 * @param {string} targetVariable - The variable to search for (e.g., "TIMER DELAY").
 * @returns {Map<string, string>} A map where keys are variable values (e.g., "3", "4") and values are instance paths.
 */
function mapVariableValuesToInstances(blocks, targetVariable) {
    const valueInstanceMap = new Map()

    console.log(`🔍 Searching for variable "${targetVariable}" in VBSP blocks...`)
    console.log(`   Total blocks: ${blocks ? blocks.length : 0}`)

    if (!Array.isArray(blocks)) {
        console.warn('   ❌ Blocks is not an array')
        return valueInstanceMap
    }

    // Handle "DEFAULT" specially - it means use the first registered instance
    if (targetVariable === 'DEFAULT') {
        console.log('   📌 DEFAULT selected - this is handled separately')
        return valueInstanceMap // Empty map for DEFAULT
    }

    // Convert target variable to fixup format (e.g., "TIMER DELAY" -> "$timer_delay")
    const fixupVariable = `$${targetVariable.replace(/ /g, '_').toLowerCase()}`
    console.log(`   Converted to fixup format: "${fixupVariable}"`)

    // Helper function to recursively search for changeInstance blocks
    const findChangeInstancesInBlock = (block, depth = 0) => {
        const indent = '  '.repeat(depth + 2)
        console.log(`${indent}Checking block type: ${block.type}`)
        
        if (block.type === 'changeInstance' && block.instanceName) {
            console.log(`${indent}  → Found changeInstance: ${block.instanceName}`)
            return [{ instanceName: block.instanceName, value: null }]
        }
        
        const results = []
        
        // Check children array
        if (Array.isArray(block.children)) {
            for (const child of block.children) {
                results.push(...findChangeInstancesInBlock(child, depth + 1))
            }
        }
        
        return results
    }

    // 1. First, try to find a SWITCH block for the target variable
    console.log('   Looking for switchCase blocks...')
    const switchBlock = blocks.find(block => 
        block.type === 'switchCase' && block.variable === fixupVariable
    )

    if (switchBlock && Array.isArray(switchBlock.cases)) {
        console.log(`   ✅ Found switchCase block with ${switchBlock.cases.length} cases`)
        
        // Extract the value-to-instance mapping from each case
        for (const caseBlock of switchBlock.cases) {
            console.log(`     Case value: "${caseBlock.value}"`)
            // Cases use 'thenBlocks' not 'children'!
            const blocks = caseBlock.thenBlocks || caseBlock.children || []
            if (caseBlock.value && Array.isArray(blocks)) {
                // Find the changeInstance block within the case
                const changeInstanceBlock = blocks.find(child => child.type === 'changeInstance')
                if (changeInstanceBlock && changeInstanceBlock.instanceName) {
                    console.log(`       → Instance: ${changeInstanceBlock.instanceName}`)
                    valueInstanceMap.set(caseBlock.value, changeInstanceBlock.instanceName)
                } else {
                    console.log(`       → No changeInstance found in thenBlocks`)
                }
            }
        }
    } else {
        console.log('   ⚠️ No switchCase block found, trying IF blocks...')
        
        // 2. If no switch block, look for IF/ELSE blocks that check this variable
        for (const block of blocks) {
            if (block.type === 'if' || block.type === 'ifElse') {
                console.log(`   Found ${block.type} block`)
                
                // Check if this IF block uses our target variable
                if (block.condition && block.condition.includes(fixupVariable)) {
                    console.log(`     → Uses target variable: ${block.condition}`)
                    
                    // Extract the value being checked (e.g., "$timer_delay == 5" -> "5")
                    const match = block.condition.match(/==\s*["']?(\w+)["']?/)
                    if (match) {
                        const value = match[1]
                        console.log(`     → Checking for value: "${value}"`)
                        
                        // Find changeInstance in this block's children
                        const instances = findChangeInstancesInBlock(block)
                        if (instances.length > 0) {
                            console.log(`     → Found ${instances.length} changeInstance(s)`)
                            valueInstanceMap.set(value, instances[0].instanceName)
                        }
                    }
                }
            }
        }
    }

    console.log(`   📊 Final mapping: ${valueInstanceMap.size} entries`)
    for (const [value, instancePath] of valueInstanceMap.entries()) {
        console.log(`     "${value}" → ${instancePath}`)
    }

    return valueInstanceMap
}

module.exports = {
    getStudioMDLPath,
    generateQCFile,
    convertObjToMDL,
    convertMaterialsToPackage,
    copyMDLToPackage,
    convertAndInstallMDL,
    mapVariableValuesToInstances
}

