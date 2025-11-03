const { app, BrowserWindow, ipcMain, protocol, net } = require("electron")
const path = require("path")
const { createMainMenu } = require("./menu.js")
const fs = require("fs")
const { reg_events } = require("./events.js")
const { WindowTitleManager } = require("./windowTitleManager.js")
const { setMainWindow, clearPackagesDirectory } = require("./packageManager.js")
const { logger, initializeLogger } = require("./utils/logger.js")
const { ensurePackagesDir, getPackagesDir } = require("./utils/packagesDir.js")
const isDev = require("./utils/isDev.js")

// Store reference to main window for file association handling
let mainWindow = null
let isLoadingFileOnStartup = false // Flag to prevent window from showing during file load

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
    const win = new BrowserWindow({
        title: "BeePEE",
        width: 1024,
        height: 512,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false, // Don't show until ready
    })

    // Initialize window title manager
    const titleManager = new WindowTitleManager(win)
    global.titleManager = titleManager

    // Set main window reference for progress updates
    setMainWindow(win)

    createMainMenu(win)

    // Show window when ready (unless loading a file on startup)
    win.once("ready-to-show", () => {
        if (!isLoadingFileOnStartup) {
            win.show()
            logger.info("Window shown (no file loading on startup)")
        } else {
            logger.info("Window ready but hidden (loading file on startup)")
        }
    })

    // Load content
    if (isDev) {
        win.loadURL("http://localhost:5173")
    } else {
        win.loadFile(path.join(app.getAppPath(), "dist", "index.html"))
    }

    // Register IPC handlers after window is created
    reg_events(win)

    // Store reference to main window for file association handling
    mainWindow = win

    return win
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
        logger.error("Error loading image:", error)
        return null
    }
})

app.whenReady().then(async () => {
    // Initialize logger
    initializeLogger()
    
    // Ensure packages directory exists at startup
    try {
        ensurePackagesDir()
        logger.info("Packages directory initialized")
    } catch (error) {
        logger.error("Failed to initialize packages directory:", error)
        // Continue anyway - error will be caught when trying to create packages
    }

    // Register custom file protocol for secure local file access
    protocol.handle("beep", async (request) => {
        try {
            let url = request.url.replace("beep://", "")

            // Handle URL decoding (e.g., %20 -> space, %2F -> /)
            try {
                url = decodeURIComponent(url)
            } catch (decodeError) {
                logger.error("Failed to decode URL:", url, decodeError)
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
                logger.error("Failed to resolve path:", url, pathError)
                return new Response("Bad Request: Invalid file path", {
                    status: 400,
                })
            }

            // Security: Only allow access to files within the project directory OR packages directory
            const projectRoot = path.resolve(__dirname, "..")
            const packagesRoot = path.resolve(getPackagesDir())
            const normalizedFilePath = path.normalize(filePath)
            const normalizedProjectRoot = path.normalize(projectRoot)
            const normalizedPackagesRoot = path.normalize(packagesRoot)

            const isInProject = normalizedFilePath.startsWith(normalizedProjectRoot)
            const isInPackages = normalizedFilePath.startsWith(normalizedPackagesRoot)

            if (!isInProject && !isInPackages) {
                logger.warn(
                    `Security check failed: ${normalizedFilePath} is not within ${normalizedProjectRoot} or ${normalizedPackagesRoot}`,
                )
                return new Response("Forbidden: Access denied", { status: 403 })
            }

            // Check if file exists and is accessible before attempting to fetch
            let stats
            try {
                if (!fs.existsSync(filePath)) {
                    logger.warn(`File not found: ${filePath}`)
                    return new Response("Not Found", { status: 404 })
                }

                stats = fs.statSync(filePath)
            } catch (fsError) {
                logger.error(
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
                logger.warn(`Not a file: ${filePath}`)
                return new Response("Bad Request: Path is not a file", {
                    status: 400,
                })
            }

            // Check file permissions (readable)
            try {
                fs.accessSync(filePath, fs.constants.R_OK)
            } catch (accessError) {
                logger.error(`File not readable: ${filePath}`, accessError)
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

            logger.debug(`Serving file: ${filePath} via ${fileUrl}`)

            // Fetch the file
            const response = await net.fetch(fileUrl)

            // Check if the fetch was successful
            if (!response.ok) {
                logger.error(
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
            logger.error("Beep protocol handler error:", error)
            return new Response("Internal Server Error", { status: 500 })
        }
    })

    logger.info("🔧 Registered beep:// protocol for secure file access")

    createWindow()

    // Configure VMF2OBJ resource paths on startup
    try {
        const { findPortal2Resources } = require("./data")

        // Create a console-compatible wrapper for logger
        const logWrapper = {
            log: (...args) => logger.info(...args),
            error: (...args) => logger.error(...args),
            warn: (...args) => logger.warn(...args),
            debug: (...args) => logger.debug(...args),
        }

        const p2Resources = await findPortal2Resources(logWrapper)

        if (p2Resources?.root) {
            const { setExtraResourcePaths } = require("./utils/vmf2obj")
            const resourcePaths = []

            logger.info("🔍 Portal 2 resources found:")
            logger.debug("  Root:", p2Resources.root)
            logger.debug("  Search paths:", p2Resources.searchPaths || [])
            logger.debug("  DLC folders:", p2Resources.dlcFolders || [])

            // Add main Portal 2 VPK file (contains all materials and models)
            resourcePaths.push(`${p2Resources.root}\\portal2\\pak01_dir.vpk`)
            // Note: We don't add the portal2 folder directly to avoid VMF2OBJ scanning
            // thousands of unrelated files that can cause StringIndexOutOfBoundsException

            // Add search paths from gameinfo.txt
            if (p2Resources.searchPaths) {
                logger.debug(
                    `🔍 Processing ${p2Resources.searchPaths.length} search paths...`,
                )
                for (const searchPath of p2Resources.searchPaths) {
                    logger.debug(`  📁 Processing search path: "${searchPath}"`)

                    // Handle |gameinfo_path| placeholder
                    let processedPath = searchPath
                    if (searchPath.includes("|gameinfo_path|")) {
                        processedPath = searchPath.replace(
                            "|gameinfo_path|",
                            "",
                        )
                        logger.debug(
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
                    logger.debug(`    🎯 Full path: ${fullPath}`)

                    if (fs.existsSync(fullPath)) {
                        // Check if this path actually contains useful resources for VMF2OBJ
                        const isVpk = fullPath.toLowerCase().endsWith(".vpk")

                        if (isVpk) {
                            // Only add VPK files to avoid directory scanning issues
                            resourcePaths.push(fullPath)
                            logger.debug(`    ✅ Added VPK: ${fullPath}`)
                        } else {
                            // For custom content (BEE2, mods), we allow directories with materials/models
                            // These are typically clean and won't cause VMF2OBJ crashes
                            const materialsPath = path.join(fullPath, "materials")
                            const modelsPath = path.join(fullPath, "models")
                            const hasMaterials = fs.existsSync(materialsPath)
                            const hasModels = fs.existsSync(modelsPath)

                            if (hasMaterials || hasModels) {
                                resourcePaths.push(fullPath)
                                logger.debug(
                                    `    ✅ Added custom content folder: ${fullPath}`,
                                )
                            } else {
                                logger.debug(
                                    `    ⚠️ Path exists but no materials/models/VPK: ${fullPath}`,
                                )
                            }
                        }
                    } else {
                        logger.debug(`    ❌ Path does not exist: ${fullPath}`)
                    }
                }
            }

            // Add DLC folders
            if (p2Resources.dlcFolders) {
                logger.debug(
                    `🔍 Processing ${p2Resources.dlcFolders.length} DLC folders...`,
                )
                for (const dlc of p2Resources.dlcFolders) {
                    logger.debug(
                        `  📁 Processing DLC: ${dlc.name} at ${dlc.path}`,
                    )

                    // Add DLC VPK if it exists (VPK files are safe)
                    const dlcVpkPath = path.join(dlc.path, "pak01_dir.vpk")
                    if (fs.existsSync(dlcVpkPath)) {
                        resourcePaths.push(dlcVpkPath)
                        logger.debug(`    ✅ Added DLC VPK: ${dlcVpkPath}`)
                    } else {
                        logger.debug(`    ❌ DLC VPK not found: ${dlcVpkPath}`)
                    }

                    // Note: We don't add DLC folders directly to avoid VMF2OBJ
                    // scanning issues. VPK files contain all necessary content.
                }
            } else {
                logger.debug(`⚠️ No DLC folders found`)
            }

            setExtraResourcePaths(resourcePaths)
            logger.info("VMF2OBJ resource paths configured:", resourcePaths)
        }
    } catch (error) {
        logger.warn("Could not setup Portal 2 resource paths:", error?.message || error)
    }
})

// Clean up packages directory when app exits
app.on("before-quit", async () => {
    try {
        logger.info("Cleaning up packages directory...")
        await clearPackagesDirectory()
        logger.info("Packages directory cleaned up successfully")
    } catch (error) {
        logger.error("Failed to clean up packages directory:", error.message)
    } finally {
        // Close logger stream
        logger.close()
    }
})

// ============================================
// FILE ASSOCIATION HANDLING
// ============================================

// Check if a file was passed on startup (before app is ready)
if (process.platform === "win32" || process.platform === "linux") {
    const args = process.argv.slice(1) // Skip electron executable
    const startupFilePath = args.find(arg =>
        arg.endsWith(".bpee") || arg.endsWith(".bee_pack")
    )
    if (startupFilePath && !startupFilePath.startsWith("--")) {
        logger.info(`File detected on startup (before app ready): ${startupFilePath}`)
        isLoadingFileOnStartup = true
    }
}

// Helper function to handle opening a file
async function handleFileOpen(filePath, isStartup = false) {
    if (!filePath || !fs.existsSync(filePath)) {
        logger.warn(`File does not exist: ${filePath}`)
        return
    }

    const ext = path.extname(filePath).toLowerCase()
    logger.info(`Opening file: ${filePath} (${ext}) [startup: ${isStartup}]`)

    // Wait for app to be ready
    await app.whenReady()

    // Get or create main window
    if (!mainWindow || mainWindow.isDestroyed()) {
        logger.info("Main window not available, waiting for it to be created...")
        // Window will be created by app.whenReady, wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
        logger.error("Main window still not available")
        return
    }

    try {
        if (ext === ".bpee") {
            // Load .bpee package
            logger.info("Loading .bpee package...")
            const { loadPackage } = require("./packageManager")
            const pkg = await loadPackage(filePath)
            mainWindow.webContents.send("package:loaded", pkg.items)
            logger.info("Package loaded successfully")
        } else if (ext === ".bee_pack") {
            // Import .bee_pack package
            logger.info("Importing .bee_pack package...")
            const { importPackage, loadPackage } = require("./packageManager")
            await importPackage(filePath)

            // Continue progress from import (70%) to load (80%)
            mainWindow.webContents.send("package-loading-progress", {
                progress: 80,
                message: "Loading imported package...",
            })

            const pkg = await loadPackage(filePath, true)

            // Send final completion message
            mainWindow.webContents.send("package-loading-progress", {
                progress: 100,
                message: "Package imported and loaded successfully!",
            })

            mainWindow.webContents.send("package:loaded", pkg.items)
            logger.info("Package imported and loaded successfully")
        } else {
            logger.warn(`Unsupported file type: ${ext}`)
        }

        // Show window after loading completes (if it was hidden during startup)
        if (isStartup && isLoadingFileOnStartup) {
            logger.info("Showing window after file load completed")
            mainWindow.show()
            isLoadingFileOnStartup = false // Reset flag
        }
    } catch (error) {
        logger.error(`Failed to open file ${filePath}:`, error)
        const { dialog } = require("electron")
        dialog.showErrorBox(
            "Open Failed",
            `Failed to open ${path.basename(filePath)}: ${error.message}`
        )

        // Show window even on error (if it was hidden during startup)
        if (isStartup && isLoadingFileOnStartup) {
            logger.info("Showing window after file load error")
            mainWindow.show()
            isLoadingFileOnStartup = false // Reset flag
        }
    }
}

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    // Another instance is already running, quit this one
    logger.info("Another instance is already running, quitting...")
    app.quit()
} else {
    // Handle second-instance event (when user tries to open another file while app is running)
    app.on("second-instance", (event, commandLine, workingDirectory) => {
        logger.info("Second instance detected, processing command line:", commandLine)

        // Focus the existing window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }

        // Find the file path in command line arguments
        // On Windows, the file path is typically the last argument
        const filePath = commandLine.find(arg =>
            arg.endsWith(".bpee") || arg.endsWith(".bee_pack")
        )

        if (filePath) {
            logger.info(`Opening file from second instance: ${filePath}`)
            handleFileOpen(filePath)
        }
    })

    // Handle macOS open-file event
    app.on("open-file", (event, filePath) => {
        event.preventDefault()
        logger.info(`macOS open-file event: ${filePath}`)
        handleFileOpen(filePath)
    })

    // Handle Windows/Linux command line arguments
    // Check if a file was passed as argument on startup
    if (process.platform === "win32" || process.platform === "linux") {
        const args = process.argv.slice(1) // Skip electron executable
        const filePath = args.find(arg =>
            arg.endsWith(".bpee") || arg.endsWith(".bee_pack")
        )

        if (filePath && !filePath.startsWith("--")) {
            logger.info(`Starting file load: ${filePath}`)
            // Delay the file open until the window is created
            app.whenReady().then(() => {
                setTimeout(() => handleFileOpen(filePath, true), 1500)
            })
        }
    }
}
