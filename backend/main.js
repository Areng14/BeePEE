const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const { createMainMenu } = require("./menu.js")
const fs = require("fs")
const { reg_events } = require("./events.js")
const { WindowTitleManager } = require("./windowTitleManager.js")
const { setMainWindow, clearPackagesDirectory } = require("./packageManager.js")

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
                console.log(`🔍 Processing ${p2Resources.searchPaths.length} search paths...`)
                for (const searchPath of p2Resources.searchPaths) {
                    console.log(`  📁 Processing search path: "${searchPath}"`)
                    
                    // Handle |gameinfo_path| placeholder
                    let processedPath = searchPath
                    if (searchPath.includes('|gameinfo_path|')) {
                        processedPath = searchPath.replace('|gameinfo_path|', '')
                        console.log(`    🔄 Replaced |gameinfo_path| with: "${processedPath}"`)
                    }
                    
                    // Search paths are relative to Portal 2 root, not portal2 subfolder
                    let fullPath
                    if (processedPath.startsWith('..')) {
                        // Handle relative paths like "../bee2" - go up from portal2/ to Portal 2/
                        fullPath = path.join(
                            p2Resources.root,
                            processedPath
                        )
                    } else {
                        // Handle absolute paths like "Hammer" - they're relative to Portal 2 root
                        fullPath = path.join(
                            p2Resources.root,
                            processedPath
                        )
                    }
                    console.log(`    🎯 Full path: ${fullPath}`)
                    
                    if (fs.existsSync(fullPath)) {
                        // Check if this path actually contains useful resources for VMF2OBJ
                        const materialsPath = path.join(fullPath, "materials")
                        const modelsPath = path.join(fullPath, "models")
                        const hasMaterials = fs.existsSync(materialsPath)
                        const hasModels = fs.existsSync(modelsPath)
                        const isVpk = fullPath.toLowerCase().endsWith('.vpk')
                        
                        if (hasMaterials || hasModels || isVpk) {
                            // Add the parent folder if it's a VPK
                            if (isVpk) {
                                resourcePaths.push(fullPath)
                                console.log(`    ✅ Added VPK: ${fullPath}`)
                            }
                            
                            // Add materials subfolder if it exists
                            if (hasMaterials) {
                                resourcePaths.push(materialsPath)
                                console.log(`    ✅ Added materials: ${materialsPath}`)
                            }
                            
                            // Add models subfolder if it exists
                            if (hasModels) {
                                resourcePaths.push(modelsPath)
                                console.log(`    ✅ Added models: ${modelsPath}`)
                            }
                        } else {
                            console.log(`    ⚠️ Path exists but no materials/models: ${fullPath}`)
                        }
                    } else {
                        console.log(`    ❌ Path does not exist: ${fullPath}`)
                    }
                }
            }

            // Add DLC folders
            if (p2Resources.dlcFolders) {
                console.log(`🔍 Processing ${p2Resources.dlcFolders.length} DLC folders...`)
                for (const dlc of p2Resources.dlcFolders) {
                    console.log(`  📁 Processing DLC: ${dlc.name} at ${dlc.path}`)
                    
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
                        console.log(`    ✅ Added DLC materials: ${dlcMaterialsPath}`)
                    } else {
                        console.log(`    ❌ DLC materials not found: ${dlcMaterialsPath}`)
                    }

                    if (fs.existsSync(dlcModelsPath)) {
                        resourcePaths.push(dlcModelsPath)
                        console.log(`    ✅ Added DLC models: ${dlcModelsPath}`)
                    } else {
                        console.log(`    ❌ DLC models not found: ${dlcModelsPath}`)
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
