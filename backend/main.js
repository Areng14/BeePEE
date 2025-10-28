const { app, BrowserWindow, ipcMain, protocol, net } = require("electron")
const path = require("path")
const { createMainMenu } = require("./menu.js")
const fs = require("fs")
const { reg_events } = require("./events.js")
const { WindowTitleManager } = require("./windowTitleManager.js")
const { setMainWindow, clearPackagesDirectory } = require("./packageManager.js")

// Register custom schemes as privileged BEFORE app is ready
// This ensures that the 'beep' scheme can be used with fetch API and other web features.
protocol.registerSchemesAsPrivileged([
    {
        scheme: "beep",
        privileges: {
            standard: true,
            secure: true,
            bypassCSP: true,
            allowServiceWorkers: true,
            supportFetchAPI: true,
            corsEnabled: true,
        },
    },
])

const createWindow = () => {
    const isDev = !app.isPackaged

    const win = new BrowserWindow({
        title: "BeePEE",
        width: 1024,
        height: 512,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
        devTools: isDev,
    })

    // Initialize window title manager
    const titleManager = new WindowTitleManager(win)
    global.titleManager = titleManager

    // Set main window reference for progress updates
    setMainWindow(win)

    createMainMenu(win)

    if (isDev) {
        win.loadURL("http://localhost:5173")
    } else {
        win.loadFile(path.join(__dirname, "../dist/index.html"))
    }

    //register stuff
    reg_events(win)
}

ipcMain.handle("api:loadImage", async (event, filePath) => {
    try {
        const imageBuffer = fs.readFileSync(filePath)
        const base64 = imageBuffer.toString("base64")
        const ext = path.extname(filePath).toLowerCase()

        // Determine MIME type
        let mimeType = "image/png"
        if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg"
        if (ext === ".gif") mimeType = "image/gif"
        if (ext === ".svg") mimeType = "image/svg+xml"

        return `data:${mimeType};base64,${base64}`
    } catch (error) {
        console.error("Error loading image:", error)
        return null
    }
})

app.whenReady().then(async () => {
    // Register custom file protocol for secure local file access
    protocol.handle("beep", async (request) => {
        try {
            let url = request.url.replace("beep://", "")

            // Handle URL decoding (e.g., %20 -> space, %2F -> /)
            try {
                url = decodeURIComponent(url)
            } catch (decodeError) {
                console.error("Failed to decode URL:", url, decodeError)
                return new Response("Bad Request: Invalid URL encoding", {
                    status: 400,
                })
            }

            // Handle Windows drive letters and paths
            if (process.platform === "win32") {
                // Pattern 1: "c/Users/..." -> "C:/Users/..."
                if (url.match(/^[a-z]\//)) {
                    url = url.charAt(0).toUpperCase() + ":" + url.slice(1)
                }
                // Pattern 2: "/c/Users/..." -> "C:/Users/..." (some systems add leading slash)
                else if (url.match(/^\/[a-z]\//)) {
                    url = url.charAt(1).toUpperCase() + ":" + url.slice(2)
                }
                // Pattern 3: "c:/Users/..." -> "C:/Users/..." (already has colon)
                else if (url.match(/^[a-z]:\//)) {
                    url = url.charAt(0).toUpperCase() + url.slice(1)
                }
            }

            // Convert to absolute path
            let filePath
            try {
                filePath = path.resolve(url)
            } catch (pathError) {
                console.error("Failed to resolve path:", url, pathError)
                return new Response("Bad Request: Invalid file path", {
                    status: 400,
                })
            }

            // Security: Only allow access to files within the project directory
            const projectRoot = path.resolve(__dirname, "..")
            const normalizedFilePath = path.normalize(filePath)
            const normalizedProjectRoot = path.normalize(projectRoot)

            if (!normalizedFilePath.startsWith(normalizedProjectRoot)) {
                console.log(
                    `Security check failed: ${normalizedFilePath} is not within ${normalizedProjectRoot}`,
                )
                return new Response("Forbidden: Access denied", { status: 403 })
            }

            // Check if file exists and is accessible before attempting to fetch
            let stats
            try {
                if (!fs.existsSync(filePath)) {
                    console.log(`File not found: ${filePath}`)
                    return new Response("Not Found", { status: 404 })
                }

                stats = fs.statSync(filePath)
            } catch (fsError) {
                console.error(
                    `File system error accessing ${filePath}:`,
                    fsError,
                )
                return new Response(
                    "Internal Server Error: File access error",
                    { status: 500 },
                )
            }

            // Check if it's actually a file (not a directory)
            if (!stats.isFile()) {
                console.log(`Not a file: ${filePath}`)
                return new Response("Bad Request: Path is not a file", {
                    status: 400,
                })
            }

            // Check file permissions (readable)
            try {
                fs.accessSync(filePath, fs.constants.R_OK)
            } catch (accessError) {
                console.error(`File not readable: ${filePath}`, accessError)
                return new Response("Forbidden: File not readable", {
                    status: 403,
                })
            }

            // Construct proper file:// URL for net.fetch
            let fileUrl
            if (process.platform === "win32") {
                // Windows: file:///C:/path/to/file
                fileUrl = `file:///${filePath.replace(/\\/g, "/")}`
            } else {
                // Unix-like: file:///path/to/file
                fileUrl = `file://${filePath}`
            }

            console.log(`Serving file: ${filePath} via ${fileUrl}`)

            // Fetch the file
            const response = await net.fetch(fileUrl)

            // Check if the fetch was successful
            if (!response.ok) {
                console.error(
                    `Failed to fetch file: ${fileUrl}, status: ${response.status}`,
                )
                return new Response(
                    "Internal Server Error: Failed to read file",
                    { status: 500 },
                )
            }

            // Get file extension and set appropriate MIME type if not already set
            const ext = path.extname(filePath).toLowerCase()
            const mimeTypes = {
                ".obj": "text/plain",
                ".mtl": "text/plain",
                ".tga": "image/tga",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
                ".txt": "text/plain",
                ".json": "application/json",
                ".xml": "application/xml",
                ".css": "text/css",
                ".js": "application/javascript",
                ".html": "text/html",
            }

            // Clone response to add/modify headers if needed
            const contentType = response.headers.get("content-type")
            if (!contentType && mimeTypes[ext]) {
                const buffer = await response.arrayBuffer()
                return new Response(buffer, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        ...Object.fromEntries(response.headers.entries()),
                        "content-type": mimeTypes[ext],
                    },
                })
            }

            return response
        } catch (error) {
            console.error("Beep protocol handler error:", error)
            return new Response("Internal Server Error", { status: 500 })
        }
    })

    console.log("🔧 Registered beep:// protocol for secure file access")

    createWindow()

    // Configure VMF2OBJ resource paths on startup
    try {
        const { findPortal2Resources } = require("./data")
        const p2Resources = await findPortal2Resources(console)

        if (p2Resources?.root) {
            const { setExtraResourcePaths } = require("./utils/vmf2obj")
            const resourcePaths = []

            console.log("🔍 Portal 2 resources found:")
            console.log("  Root:", p2Resources.root)
            console.log("  Search paths:", p2Resources.searchPaths || [])
            console.log("  DLC folders:", p2Resources.dlcFolders || [])

            // Add main Portal 2 files
            resourcePaths.push(`${p2Resources.root}\\portal2\\pak01_dir.vpk`)
            resourcePaths.push(`${p2Resources.root}\\portal2\\materials`)
            resourcePaths.push(`${p2Resources.root}\\portal2\\models`)

            // Add search paths from gameinfo.txt
            if (p2Resources.searchPaths) {
                console.log(
                    `🔍 Processing ${p2Resources.searchPaths.length} search paths...`,
                )
                for (const searchPath of p2Resources.searchPaths) {
                    console.log(`  📁 Processing search path: "${searchPath}"`)

                    // Handle |gameinfo_path| placeholder
                    let processedPath = searchPath
                    if (searchPath.includes("|gameinfo_path|")) {
                        processedPath = searchPath.replace(
                            "|gameinfo_path|",
                            "",
                        )
                        console.log(
                            `    🔄 Replaced |gameinfo_path| with: "${processedPath}"`,
                        )
                    }

                    // Search paths are relative to Portal 2 root, not portal2 subfolder
                    let fullPath
                    if (processedPath.startsWith("..")) {
                        // Handle relative paths like "../bee2" - go up from portal2/ to Portal 2/
                        fullPath = path.join(p2Resources.root, processedPath)
                    } else {
                        // Handle absolute paths like "Hammer" - they're relative to Portal 2 root
                        fullPath = path.join(p2Resources.root, processedPath)
                    }
                    console.log(`    🎯 Full path: ${fullPath}`)

                    if (fs.existsSync(fullPath)) {
                        // Check if this path actually contains useful resources for VMF2OBJ
                        const materialsPath = path.join(fullPath, "materials")
                        const modelsPath = path.join(fullPath, "models")
                        const hasMaterials = fs.existsSync(materialsPath)
                        const hasModels = fs.existsSync(modelsPath)
                        const isVpk = fullPath.toLowerCase().endsWith(".vpk")

                        if (hasMaterials || hasModels || isVpk) {
                            // Add the parent folder if it's a VPK
                            if (isVpk) {
                                resourcePaths.push(fullPath)
                                console.log(`    ✅ Added VPK: ${fullPath}`)
                            }

                            // Add materials subfolder if it exists
                            if (hasMaterials) {
                                resourcePaths.push(materialsPath)
                                console.log(
                                    `    ✅ Added materials: ${materialsPath}`,
                                )
                            }

                            // Add models subfolder if it exists
                            if (hasModels) {
                                resourcePaths.push(modelsPath)
                                console.log(
                                    `    ✅ Added models: ${modelsPath}`,
                                )
                            }
                        } else {
                            console.log(
                                `    ⚠️ Path exists but no materials/models: ${fullPath}`,
                            )
                        }
                    } else {
                        console.log(`    ❌ Path does not exist: ${fullPath}`)
                    }
                }
            }

            // Add DLC folders
            if (p2Resources.dlcFolders) {
                console.log(
                    `🔍 Processing ${p2Resources.dlcFolders.length} DLC folders...`,
                )
                for (const dlc of p2Resources.dlcFolders) {
                    console.log(
                        `  📁 Processing DLC: ${dlc.name} at ${dlc.path}`,
                    )

                    // Add DLC VPK if it exists
                    const dlcVpkPath = path.join(dlc.path, "pak01_dir.vpk")
                    if (fs.existsSync(dlcVpkPath)) {
                        resourcePaths.push(dlcVpkPath)
                        console.log(`    ✅ Added DLC VPK: ${dlcVpkPath}`)
                    } else {
                        console.log(`    ❌ DLC VPK not found: ${dlcVpkPath}`)
                    }

                    // Add DLC materials and models folders for custom content
                    const dlcMaterialsPath = path.join(dlc.path, "materials")
                    const dlcModelsPath = path.join(dlc.path, "models")

                    if (fs.existsSync(dlcMaterialsPath)) {
                        resourcePaths.push(dlcMaterialsPath)
                        console.log(
                            `    ✅ Added DLC materials: ${dlcMaterialsPath}`,
                        )
                    } else {
                        console.log(
                            `    ❌ DLC materials not found: ${dlcMaterialsPath}`,
                        )
                    }

                    if (fs.existsSync(dlcModelsPath)) {
                        resourcePaths.push(dlcModelsPath)
                        console.log(`    ✅ Added DLC models: ${dlcModelsPath}`)
                    } else {
                        console.log(
                            `    ❌ DLC models not found: ${dlcModelsPath}`,
                        )
                    }
                }
            } else {
                console.log(`⚠️ No DLC folders found`)
            }

            setExtraResourcePaths(resourcePaths)
            console.log("VMF2OBJ resource paths configured:", resourcePaths)
        }
    } catch (error) {
        console.warn("Could not setup Portal 2 resource paths:", error)
    }
})

// Clean up packages directory when app exits
app.on("before-quit", async () => {
    try {
        console.log("Cleaning up packages directory...")
        await clearPackagesDirectory()
        console.log("Packages directory cleaned up successfully")
    } catch (error) {
        console.error("Failed to clean up packages directory:", error.message)
    }
})
