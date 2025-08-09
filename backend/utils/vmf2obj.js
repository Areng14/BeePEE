const fs = require("fs")
const path = require("path")
const { app } = require("electron")
const { findPortal2Resources } = require("../data")

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
    const isDev = !app.isPackaged
    const bundledJava = isDev
        ? path.join(
              __dirname,
              "..",
              "libs",
              "VMF2OBJ",
              "jre",
              "bin",
              "java.exe",
          )
        : path.join(
              process.resourcesPath,
              "extraResources",
              "VMF2OBJ",
              "jre",
              "bin",
              "java.exe",
          )

    if (fs.existsSync(bundledJava)) return bundledJava

    // Fallback to system Java; rely on PATH
    return "java"
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
 * @param {{outputDir?: string, timeoutMs?: number, resourcePaths?: string[], textureStyle?: 'cartoon' | 'raw', debug?: boolean, applySourceRotation?: boolean}} options
 * @returns {Promise<{objPath?: string, mtlPath?: string}>}
 */
async function convertVmfToObj(vmfPath, options = {}) {
    if (!vmfPath || !fs.existsSync(vmfPath)) {
        throw new Error(`VMF file not found: ${vmfPath}`)
    }

    const javaPath = getJavaPath()
    const jarPath = getJarPath()
    if (!fs.existsSync(jarPath)) {
        throw new Error("VMF2OBJ tool not found")
    }

    const { spawn } = require("child_process")
    const timeoutMs = options.timeoutMs ?? 120000 // 2 minutes

    const baseName = path.basename(vmfPath, path.extname(vmfPath))
    const outputDir = options.outputDir || path.dirname(vmfPath)
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

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
        // Add package resources folder if VMF is under .../resources/instances/...
        try {
            const instancesDir = path.dirname(vmfPath)
            const resourcesDir = path.dirname(instancesDir) // up from instances -> resources
            if (path.basename(resourcesDir).toLowerCase() === "resources") {
                resourcePaths.push(resourcesDir)
            }
        } catch {}
    }

    // If textureStyle is raw, also include the portal2 folder for direct material/model lookup
    try {
        if (options.textureStyle === "raw") {
            const p2 = await findPortal2Resources(console)
            if (p2?.root) {
                const portal2Folder = path.join(p2.root, "portal2")
                if (fs.existsSync(portal2Folder)) {
                    resourcePaths.push(portal2Folder)
                }
            }
        }
    } catch {}

    // Merge extras, then de-duplicate
    resourcePaths = uniquePaths([
        ...(resourcePaths || []),
        ...getExtraResourcePaths(),
    ])

    // Log all resource paths for debugging
    if (resourcePaths.length > 0) {
        console.log(`🔍 VMF2OBJ resource paths:`, resourcePaths)
    }

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
}
