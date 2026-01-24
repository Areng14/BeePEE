const fs = require("fs")
const path = require("path")
const https = require("https")
const { app } = require("electron")
const { findPortal2Resources } = require("../data")
const { convertTexturesForModel } = require("./tgaConverter")

// JRE download configuration
const JRE_VERSION = "17"
const JRE_DOWNLOAD_URL = `https://api.adoptium.net/v3/binary/latest/${JRE_VERSION}/ga/windows/x64/jre/hotspot/normal/eclipse`

/**
 * Helper to create directory with retry logic for EPERM errors
 */
async function mkdirWithRetry(dirPath, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true })
            }
            return true
        } catch (error) {
            if (error.code === "EPERM" || error.code === "EBUSY") {
                if (attempt < maxAttempts - 1) {
                    console.warn(`mkdir attempt ${attempt + 1} failed (${error.code}), retrying in ${(attempt + 1) * 200}ms...`)
                    await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 200))
                } else {
                    throw error
                }
            } else {
                throw error
            }
        }
    }
}

/**
 * Get the directory where the JRE should be installed
 * Checks both "jre" and "jre-windows" folder names for compatibility
 */
function getJreDir() {
    const isDev = !app.isPackaged
    const baseDir = isDev
        ? path.join(__dirname, "..", "libs", "VMF2OBJ")
        : path.join(process.resourcesPath, "extraResources", "VMF2OBJ")

    // Check for both possible folder names
    const jreDir = path.join(baseDir, "jre")
    const jreWindowsDir = path.join(baseDir, "jre-windows")

    // Prefer jre-windows if it exists with java.exe
    if (fs.existsSync(path.join(jreWindowsDir, "bin", "java.exe"))) {
        return jreWindowsDir
    }
    // Fall back to jre
    if (fs.existsSync(path.join(jreDir, "bin", "java.exe"))) {
        return jreDir
    }
    // Default to jre for download location
    return jreDir
}

/**
 * Download a file with redirect support
 */
function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath)

        const request = (currentUrl) => {
            https
                .get(currentUrl, (response) => {
                    // Handle redirects
                    if (
                        response.statusCode >= 300 &&
                        response.statusCode < 400 &&
                        response.headers.location
                    ) {
                        console.log(`Redirecting to: ${response.headers.location}`)
                        request(response.headers.location)
                        return
                    }

                    if (response.statusCode !== 200) {
                        reject(
                            new Error(
                                `Failed to download: HTTP ${response.statusCode}`,
                            ),
                        )
                        return
                    }

                    const totalSize = parseInt(
                        response.headers["content-length"],
                        10,
                    )
                    let downloadedSize = 0

                    response.on("data", (chunk) => {
                        downloadedSize += chunk.length
                        if (onProgress && totalSize) {
                            onProgress(downloadedSize, totalSize)
                        }
                    })

                    response.pipe(file)

                    file.on("finish", () => {
                        file.close()
                        resolve()
                    })
                })
                .on("error", (err) => {
                    fs.unlink(destPath, () => {})
                    reject(err)
                })
        }

        request(url)
    })
}

/**
 * Extract a zip file to a directory
 */
async function extractZip(zipPath, destDir) {
    const AdmZip = require("adm-zip")
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()

    // Find the root folder name in the zip (e.g., "jdk-17.0.9+9-jre")
    let rootFolder = null
    for (const entry of entries) {
        if (entry.isDirectory && entry.entryName.split("/").length === 2) {
            rootFolder = entry.entryName.replace("/", "")
            break
        }
    }

    if (!rootFolder) {
        // Just extract as-is
        zip.extractAllTo(destDir, true)
        return
    }

    // Extract to temp location, then move contents
    const tempDir = path.join(path.dirname(destDir), "jre_temp_extract")
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
    }

    zip.extractAllTo(tempDir, true)

    // Move contents from rootFolder to destDir
    const extractedRoot = path.join(tempDir, rootFolder)
    if (fs.existsSync(extractedRoot)) {
        // Ensure destDir exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true })
        }

        // Copy all contents
        const copyRecursive = (src, dest) => {
            const stat = fs.statSync(src)
            if (stat.isDirectory()) {
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true })
                }
                for (const child of fs.readdirSync(src)) {
                    copyRecursive(path.join(src, child), path.join(dest, child))
                }
            } else {
                fs.copyFileSync(src, dest)
            }
        }

        copyRecursive(extractedRoot, destDir)
    }

    // Cleanup temp
    fs.rmSync(tempDir, { recursive: true, force: true })
}

/**
 * Download and install the JRE if not present
 * @param {function} onProgress - Callback for progress updates (downloaded, total, status)
 * @returns {Promise<string>} Path to java.exe
 */
async function ensureJreInstalled(onProgress) {
    const jreDir = getJreDir()
    const javaExe = path.join(jreDir, "bin", "java.exe")

    // Already installed
    if (fs.existsSync(javaExe)) {
        return javaExe
    }

    console.log("Bundled JRE not found, downloading...")
    if (onProgress) onProgress(0, 0, "Preparing to download JRE...")

    // Ensure parent directory exists
    const parentDir = path.dirname(jreDir)
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
    }

    const zipPath = path.join(parentDir, "jre_download.zip")

    try {
        // Download
        if (onProgress) onProgress(0, 0, "Downloading JRE...")
        console.log(`Downloading JRE from ${JRE_DOWNLOAD_URL}`)

        await downloadFile(zipPath, zipPath, (downloaded, total) => {
            if (onProgress) {
                const percent = Math.round((downloaded / total) * 100)
                const mb = (downloaded / 1024 / 1024).toFixed(1)
                const totalMb = (total / 1024 / 1024).toFixed(1)
                onProgress(
                    downloaded,
                    total,
                    `Downloading JRE: ${mb}MB / ${totalMb}MB (${percent}%)`,
                )
            }
        })

        // Extract
        if (onProgress) onProgress(0, 0, "Extracting JRE...")
        console.log(`Extracting JRE to ${jreDir}`)

        await extractZip(zipPath, jreDir)

        // Cleanup zip
        fs.unlinkSync(zipPath)

        // Verify
        if (!fs.existsSync(javaExe)) {
            throw new Error("JRE extraction failed - java.exe not found")
        }

        console.log("JRE installed successfully")
        if (onProgress) onProgress(100, 100, "JRE installed successfully")

        return javaExe
    } catch (error) {
        // Cleanup on failure
        try {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
            if (fs.existsSync(jreDir))
                fs.rmSync(jreDir, { recursive: true, force: true })
        } catch {}

        throw new Error(`Failed to download/install JRE: ${error.message}`)
    }
}

// Extra resource search paths configurable at runtime (folders or VPKs)
let extraResourcePaths = []
function setExtraResourcePaths(paths) {
    extraResourcePaths = Array.isArray(paths)
        ? paths.filter((p) => typeof p === "string" && p.trim() !== "")
        : []
}
function getExtraResourcePaths() {
    return [...extraResourcePaths]
}

function uniquePaths(paths) {
    const seen = new Set()
    const result = []
    for (const p of paths) {
        const norm = p.replace(/\\/g, "/").toLowerCase()
        if (!seen.has(norm)) {
            seen.add(norm)
            result.push(p)
        }
    }
    return result
}

function getJavaPath() {
    const jreDir = getJreDir()
    return path.join(jreDir, "bin", "java.exe")
}

function getJarPath() {
    const isDev = !app.isPackaged
    const jarPath = isDev
        ? path.join(__dirname, "..", "libs", "VMF2OBJ", "VMF2OBJ.jar")
        : path.join(
              process.resourcesPath,
              "extraResources",
              "VMF2OBJ",
              "VMF2OBJ.jar",
          )

    return jarPath
}

function getCartoonExePath() {
    const isDev = !app.isPackaged
    const exePath = isDev
        ? path.join(__dirname, "..", "libs", "areng_cartoonify", "cartoon.exe")
        : path.join(
              process.resourcesPath,
              "extraResources",
              "areng_cartoonify",
              "cartoon.exe",
          )

    return exePath
}

function findPngFilesRecursively(dirPath) {
    const result = []
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        for (const entry of entries) {
            const full = path.join(dirPath, entry.name)
            if (entry.isDirectory()) {
                result.push(...findPngFilesRecursively(full))
            } else if (entry.isFile() && /\.png$/i.test(entry.name)) {
                result.push(full)
            }
        }
    } catch {}
    return result
}

async function applyCartoonishToTextures(outputDir, { debug } = {}) {
    const materialsDir = path.join(outputDir, "materials")
    if (!fs.existsSync(materialsDir)) {
        console.log("No materials directory for cartoonify, skipping")
        return { success: true, processed: 0 }
    }

    const pngFiles = findPngFilesRecursively(materialsDir)
    if (pngFiles.length === 0) {
        console.log("No PNG textures found to cartoonify, skipping")
        return { success: true, processed: 0 }
    }

    const exePath = getCartoonExePath()
    if (!fs.existsSync(exePath)) {
        console.warn(
            "cartoon.exe not found, skipping cartoonish processing:",
            exePath,
        )
        return { success: false, processed: 0, error: "cartoon.exe missing" }
    }

    const { spawn } = require("child_process")

    // Run in chunks to avoid excessively long command lines
    const chunkSize = 50
    let processed = 0

    for (let i = 0; i < pngFiles.length; i += chunkSize) {
        const chunk = pngFiles.slice(i, i + chunkSize)
        const cmd = [
            // cartoon.exe expects image paths as arguments
            ...chunk,
        ]

        if (debug) {
            console.log("Running cartoon.exe on", chunk.length, "textures")
        }

        await new Promise((resolve, reject) => {
            const child = spawn(exePath, cmd, {
                cwd: path.dirname(exePath),
                stdio: debug ? "inherit" : "pipe",
                windowsHide: !debug,
            })

            let stdout = ""
            let stderr = ""

            if (!debug) {
                child.stdout?.on("data", (d) => (stdout += d.toString()))
                child.stderr?.on("data", (d) => (stderr += d.toString()))
            }

            child.on("close", (code) => {
                if (code === 0) {
                    processed += chunk.length
                    resolve()
                } else {
                    console.warn("cartoon.exe failed with code", code, stderr)
                    reject(new Error(`cartoon.exe exited with code ${code}`))
                }
            })

            child.on("error", (err) => {
                reject(err)
            })
        })
    }

    return { success: true, processed }
}

/**
 * Apply Source engine coordinate rotation to OBJ file
 * Rotates 90 degrees around Z-axis to convert from Source to standard 3D coordinates
 * @param {string} objPath - Path to the OBJ file to modify
 */
async function applySourceEngineRotation(objPath) {
    try {
        console.log(`🔄 Starting Source engine rotation on: ${objPath}`)

        // Read the OBJ file
        const objContent = fs.readFileSync(objPath, "utf-8")
        const lines = objContent.split("\n")
        const rotatedLines = []

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

                    // Apply -90-degree rotation around X-axis:
                    // x' = x
                    // y' = y*cos(-90°) - z*sin(-90°) = z
                    // z' = y*sin(-90°) + z*cos(-90°) = -y
                    const rotatedX = x
                    const rotatedY = z
                    const rotatedZ = -y

                    // Reconstruct the line with rotated coordinates
                    let rotatedLine = `v ${rotatedX} ${rotatedY} ${rotatedZ}`
                    if (parts.length > 4) {
                        // Include w coordinate if present
                        rotatedLine += ` ${parts[4]}`
                    }
                    rotatedLines.push(rotatedLine)
                    vertexCount++
                } else {
                    rotatedLines.push(line)
                }
            } else if (line.startsWith("vn ")) {
                // Normal line: vn x y z
                const parts = line.trim().split(/\s+/)
                if (parts.length >= 4) {
                    const nx = parseFloat(parts[1])
                    const ny = parseFloat(parts[2])
                    const nz = parseFloat(parts[3])

                    // Apply same rotation to normals
                    const rotatedNx = nx
                    const rotatedNy = nz
                    const rotatedNz = -ny

                    rotatedLines.push(
                        `vn ${rotatedNx} ${rotatedNy} ${rotatedNz}`,
                    )
                    normalCount++
                } else {
                    rotatedLines.push(line)
                }
            } else {
                // Keep all other lines unchanged
                rotatedLines.push(line)
            }
        }

        console.log(
            `✅ Rotation complete! Modified ${vertexCount} vertices and ${normalCount} normals`,
        )

        // Write the rotated OBJ back to file
        fs.writeFileSync(objPath, rotatedLines.join("\n"), "utf-8")
        console.log(`💾 Rotated OBJ saved to: ${objPath}`)
    } catch (error) {
        console.error(`❌ Rotation failed: ${error.message}`)
        throw new Error(
            `Failed to apply Source engine rotation: ${error.message}`,
        )
    }
}

/**
 * Convert a VMF file to OBJ using the bundled VMF2OBJ tool
 * @param {string} vmfPath - Full path to the VMF file
 * @param {{outputDir?: string, timeoutMs?: number, resourcePaths?: string[], textureStyle?: 'cartoon' | 'raw', debug?: boolean, applySourceRotation?: boolean, onJreProgress?: function}} options
 * @param {function} [options.onJreProgress] - Callback for JRE download progress (downloaded, total, status)
 * @returns {Promise<{objPath?: string, mtlPath?: string}>}
 */
async function convertVmfToObj(vmfPath, options = {}) {
    if (!vmfPath || !fs.existsSync(vmfPath)) {
        throw new Error(`VMF file not found: ${vmfPath}`)
    }

    // Ensure JRE is installed (downloads if missing)
    const javaPath = await ensureJreInstalled(options.onJreProgress)

    const jarPath = getJarPath()
    if (!fs.existsSync(jarPath)) {
        throw new Error("VMF2OBJ tool not found")
    }

    const { spawn } = require("child_process")
    const timeoutMs = options.timeoutMs ?? 120000 // 2 minutes

    const baseName = path.basename(vmfPath, path.extname(vmfPath))
    const outputDir = options.outputDir || path.dirname(vmfPath)
    await mkdirWithRetry(outputDir)

    // Expected outputs
    const objPath = path.join(outputDir, `${baseName}.obj`)
    const mtlPath = path.join(outputDir, `${baseName}.mtl`)

    // Remove existing outputs to ensure clean run
    ;[objPath, mtlPath].forEach((p) => {
        try {
            if (fs.existsSync(p)) fs.unlinkSync(p)
        } catch {}
    })

    // Build resource paths list
    let resourcePaths = options.resourcePaths
    if (!resourcePaths) {
        resourcePaths = []
        // Defaults from Portal 2 installation
        try {
            const resources = await findPortal2Resources(console)
            if (resources?.root) {
                // Only add the main pak01_dir.vpk like your working command
                const pak01Path = path.join(
                    resources.root,
                    "portal2",
                    "pak01_dir.vpk",
                )
                if (fs.existsSync(pak01Path)) {
                    resourcePaths.push(pak01Path)
                }
            }
        } catch {}
    }

    // Add the package's resources folder as a resource path
    // Walk up the directory tree from vmfPath to find the "resources" folder
    let currentDir = path.dirname(vmfPath)
    let resourcesDir = null
    for (let i = 0; i < 10; i++) {
        // Safety limit to avoid infinite loop
        if (path.basename(currentDir).toLowerCase() === "resources") {
            resourcesDir = currentDir
            break
        }
        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) break // Reached root
        currentDir = parentDir
    }
    if (resourcesDir && fs.existsSync(resourcesDir)) {
        resourcePaths.push(resourcesDir)
    }

    // Merge extras, then de-duplicate
    resourcePaths = uniquePaths([
        ...(resourcePaths || []),
        ...getExtraResourcePaths(),
    ])

    // Log all resource paths for debugging
    if (resourcePaths.length > 0) {
        console.log(`🔍 VMF2OBJ resource paths:`, resourcePaths)
    }

    // Join paths with semicolon - no need to quote individual paths
    // when using spawn() as it handles arguments properly
    const resourceArg =
        resourcePaths.length > 0 ? resourcePaths.join(";") : null

    // CLI per docs: java -jar VMF2OBJ.jar [VMF_FILE] -o <outputBase> -r "path1;path2;..." -t
    const outputBase = path.join(outputDir, baseName)
    const textureStyle = options.textureStyle || "cartoon"
    const debug = !!options.debug

    // Prefer invoking the CLI main class directly to avoid GUI launcher
    const rawArgs = [
        "-cp",
        jarPath,
        "com.lathrum.VMF2OBJ.cli.VMF2OBJCLI",
        vmfPath,
        "-o",
        outputBase,
    ]
    if (resourceArg) {
        rawArgs.push("-r", resourceArg)
    }

    // Only add -t flag if NOT using dev tools (debug mode)
    // -t ignores tool brushes for cleaner models
    if (!debug) {
        rawArgs.push("-t")
    }

    // Always be quiet
    rawArgs.push("-q")

    // Texture style info (no direct CLI toggle; we already adjusted resource paths above)

    const cwd = path.dirname(jarPath)
    const quote = (s) =>
        s.includes(" ") || s.includes(";") || s.includes("\\") ? `"${s}"` : s
    const cmdString = `${quote(javaPath)} ${rawArgs.map(quote).join(" ")}`

    console.log("Running VMF2OBJ with spawn:")
    console.log("  java:", javaPath)
    console.log("  jar:", jarPath)
    console.log("  vmf:", vmfPath)
    console.log("  output:", outputBase)
    console.log("  resources:", resourceArg || "none")

    // Simple, clean spawn - no CMD, no shell, just direct process
    return new Promise(async (resolve, reject) => {
        const child = spawn(javaPath, rawArgs, {
            cwd: path.dirname(jarPath),
            stdio: debug ? "inherit" : "pipe", // Show output if debugging
            windowsHide: !debug, // Hide window unless debugging
        })

        let stdout = ""
        let stderr = ""

        if (!debug) {
            // Capture output silently when not debugging
            child.stdout?.on("data", (data) => {
                stdout += data.toString()
            })
            child.stderr?.on("data", (data) => {
                stderr += data.toString()
            })
        }

        const timer = setTimeout(() => {
            child.kill("SIGTERM")
            reject(new Error(`VMF2OBJ timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        child.on("close", async (code) => {
            clearTimeout(timer)
            console.log(`VMF2OBJ completed with exit code ${code}`)

            if (code === 0) {
                // Verify outputs
                const hasObj = fs.existsSync(objPath)
                const hasMtl = fs.existsSync(mtlPath)
                if (!hasObj) {
                    const err = new Error(
                        `OBJ not created. Output directory: ${outputDir}. Logs: ${stderr || stdout}`,
                    )
                    err.cmd = cmdString
                    err.cwd = cwd
                    reject(err)
                    return
                }

                // Post-process OBJ file to apply Source engine coordinate rotation
                if (hasObj && options.applySourceRotation !== false) {
                    try {
                        await applySourceEngineRotation(objPath)
                        console.log(
                            "Applied Source engine rotation to OBJ file",
                        )
                    } catch (rotationError) {
                        console.warn(
                            "Failed to apply Source engine rotation:",
                            rotationError.message,
                        )
                    }
                }

                // Convert TGA textures to PNG for better Three.js compatibility
                if (hasMtl) {
                    try {
                        console.log("Converting TGA textures to PNG...")
                        const conversionResult = await convertTexturesForModel(
                            outputDir,
                            baseName,
                        )
                        if (conversionResult.success) {
                            console.log(
                                `TGA conversion successful: ${conversionResult.converted.length} files converted`,
                            )
                            if (conversionResult.failed.length > 0) {
                                console.warn(
                                    `Failed to convert ${conversionResult.failed.length} TGA files:`,
                                    conversionResult.failed,
                                )
                            }
                        } else {
                            console.warn(
                                "TGA to PNG conversion failed, but continuing with original textures",
                            )
                        }
                    } catch (conversionError) {
                        console.warn(
                            "Error during TGA to PNG conversion:",
                            conversionError,
                        )
                        // Continue anyway - original TGA files will still work with our loaders
                    }
                }

                // If user selected cartoonish textures, run cartoon.exe on the PNG textures
                try {
                    if (textureStyle === "cartoon") {
                        console.log("Applying cartoonish effect to textures...")
                        const cartoonResult = await applyCartoonishToTextures(
                            outputDir,
                            { debug },
                        )
                        if (cartoonResult.success) {
                            console.log(
                                `Cartoonified ${cartoonResult.processed} textures`,
                            )
                        } else {
                            console.warn(
                                "Cartoonify step reported failure:",
                                cartoonResult.error || "unknown",
                            )
                        }
                    }
                } catch (cartoonError) {
                    console.warn(
                        "Cartoonify step failed:",
                        cartoonError?.message || cartoonError,
                    )
                }

                resolve({
                    objPath: hasObj ? objPath : undefined,
                    mtlPath: hasMtl ? mtlPath : undefined,
                    cmd: cmdString,
                    cwd,
                    resourceArg,
                })
            } else {
                console.error("VMF2OBJ stderr:", stderr)
                reject(
                    new Error(
                        `VMF2OBJ failed with exit code ${code}. stderr: ${stderr}`,
                    ),
                )
            }
        })

        child.on("error", (error) => {
            clearTimeout(timer)
            console.error("VMF2OBJ spawn error:", error)
            reject(error)
        })
    })
}

module.exports = {
    convertVmfToObj,
    setExtraResourcePaths,
    getExtraResourcePaths,
    ensureJreInstalled,
}