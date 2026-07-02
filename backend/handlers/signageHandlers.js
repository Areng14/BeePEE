/**
 * Signage CRUD handlers - open editor, save signage
 */

const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { packages, getCurrentPackageDir } = require("../packageManager")
const {
    createSignageEditor,
    sendSignageUpdateToEditor,
} = require("../items/itemEditor")

function register(ipcMain, mainWindow) {
    // Open signage editor
    ipcMain.handle("open-signage-editor", async (event, signage) => {
        try {
            // Find the actual signage object from the packages
            const actualSignage = packages
                .flatMap((p) => p.signages || [])
                .find((s) => s.id === signage.id)

            if (!actualSignage) {
                throw new Error(`Signage not found: ${signage.id}`)
            }

            createSignageEditor(actualSignage, mainWindow)
            return { success: true }
        } catch (error) {
            console.error("Failed to open signage editor:", error)
            throw error
        }
    })

    // Create a new signage
    ipcMain.handle("create-signage", async (event, { name, iconPath, iconData }) => {
        try {
            const packageDir = getCurrentPackageDir()
            if (!packageDir) {
                throw new Error("No package is currently loaded")
            }
            if (!name || !name.trim()) {
                throw new Error("Signage name is required")
            }

            const infoPath = path.join(packageDir, "info.json")
            const packageInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"))

            // Ensure Signage array exists
            if (!packageInfo.Signage) {
                packageInfo.Signage = []
            } else if (!Array.isArray(packageInfo.Signage)) {
                packageInfo.Signage = [packageInfo.Signage]
            }

            // Generate a unique ID: SIGN_BPEE_<NAME>_<4-hex chars>
            const sanitizedName = name
                .replace(/[^a-zA-Z0-9]/g, "")
                .toUpperCase()
            const existingIds = new Set([
                ...packageInfo.Signage.map((s) => s.ID),
                ...packages
                    .flatMap((p) => p.signages || [])
                    .map((s) => s.id),
            ])
            let signageId
            do {
                const uuid = crypto
                    .randomBytes(2)
                    .toString("hex")
                    .toUpperCase()
                signageId = `SIGN_BPEE_${sanitizedName}_${uuid}`
            } while (existingIds.has(signageId))

            const newSignage = { ID: signageId, Name: name.trim() }
            const resolvedStyles = {}

            // Optional starting icon — stored on the Clean style, written
            // into resources/BEE2 the same way save-signage stages icons.
            // Either a picked file (iconPath) or a designer-rasterized PNG
            // (iconData, a data URL).
            let iconFilename = null
            const bee2Dir = path.join(packageDir, "resources", "BEE2")
            if (iconPath && fs.existsSync(iconPath)) {
                if (!fs.existsSync(bee2Dir)) {
                    fs.mkdirSync(bee2Dir, { recursive: true })
                }
                iconFilename = path.basename(iconPath)
                fs.copyFileSync(iconPath, path.join(bee2Dir, iconFilename))
            } else if (
                typeof iconData === "string" &&
                iconData.startsWith("data:image/png;base64,")
            ) {
                if (!fs.existsSync(bee2Dir)) {
                    fs.mkdirSync(bee2Dir, { recursive: true })
                }
                iconFilename = `${signageId.toLowerCase()}.png`
                fs.writeFileSync(
                    path.join(bee2Dir, iconFilename),
                    Buffer.from(iconData.split(",")[1], "base64"),
                )
            }
            if (iconFilename) {
                const overlay = `signage/${iconFilename.replace(/\.[^.]+$/, "")}`
                newSignage.Styles = {
                    BEE2_CLEAN: {
                        type: "square",
                        overlay,
                        icon: iconFilename,
                    },
                }
                resolvedStyles.BEE2_CLEAN = {
                    type: "square",
                    overlay,
                    icon: path.join(bee2Dir, iconFilename),
                }
            }

            packageInfo.Signage.push(newSignage)
            fs.writeFileSync(infoPath, JSON.stringify(packageInfo, null, 2))

            // Update in-memory package
            const memSignage = {
                id: signageId,
                name: name.trim(),
                hidden: false,
                secondary: null,
                styles: resolvedStyles,
            }
            const pkg = packages.find((p) => p.packageDir === packageDir)
            if (pkg) {
                if (!pkg.signages) pkg.signages = []
                pkg.signages.push(memSignage)
            }

            // Refresh browser UI
            mainWindow.webContents.send("package:loaded", {
                items: packages
                    .flatMap((p) => p.items)
                    .map((i) => i.toJSONWithExistence()),
                signages: packages.flatMap((p) => p.signages || []),
            })

            // Open the editor so the user can configure styles right away
            createSignageEditor(memSignage, mainWindow)

            return { success: true, signageId }
        } catch (error) {
            console.error("Failed to create signage:", error)
            return { success: false, error: error.message }
        }
    })

    // Save signage
    ipcMain.handle("save-signage", async (event, signageData) => {
        try {
            const packageDir = getCurrentPackageDir()
            if (!packageDir) {
                throw new Error("No package is currently loaded")
            }

            const infoPath = path.join(packageDir, "info.json")
            const packageInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"))

            // Ensure Signage array exists
            if (!packageInfo.Signage) {
                packageInfo.Signage = []
            } else if (!Array.isArray(packageInfo.Signage)) {
                packageInfo.Signage = [packageInfo.Signage]
            }

            // Find and update signage in Signage array
            const signageIndex = packageInfo.Signage.findIndex(
                (s) => s.ID === signageData.originalId
            )

            if (signageIndex !== -1) {
                // Convert formData back to BEE2 format
                // Need to process styles to remove resolved icon paths
                const processedStyles = {}
                const bee2Dir = path.join(packageDir, "resources", "BEE2")

                // Ensure resources/BEE2 directory exists
                if (!fs.existsSync(bee2Dir)) {
                    fs.mkdirSync(bee2Dir, { recursive: true })
                }

                for (const [styleId, styleConfig] of Object.entries(
                    signageData.styles || {}
                )) {
                    if (typeof styleConfig === "string") {
                        // Style inheritance reference
                        processedStyles[styleId] = styleConfig
                    } else {
                        let iconFilename = ""

                        // Handle staged icon - copy to resources/BEE2
                        if (styleConfig._stagedIconPath) {
                            const stagedPath = styleConfig._stagedIconPath
                            iconFilename = path.basename(stagedPath)
                            const destPath = path.join(bee2Dir, iconFilename)

                            // Copy the file
                            fs.copyFileSync(stagedPath, destPath)
                            console.log(`Copied signage icon: ${stagedPath} -> ${destPath}`)
                        } else if (styleConfig.icon) {
                            // Extract filename from existing icon path
                            const iconPath = styleConfig.icon
                            if (
                                iconPath.includes("resources/BEE2") ||
                                iconPath.includes("resources\\BEE2")
                            ) {
                                const match = iconPath.match(
                                    /resources[/\\]BEE2[/\\](.+)/
                                )
                                iconFilename = match ? match[1].replace(/\\/g, "/") : path.basename(iconPath)
                            } else {
                                iconFilename = path.basename(iconPath)
                            }
                        }

                        // Auto-generate overlay from icon filename (without extension)
                        const iconBaseName = iconFilename.replace(/\.[^.]+$/, "")
                        const overlay = iconBaseName ? `signage/${iconBaseName}` : ""

                        processedStyles[styleId] = {
                            type: "square",
                            overlay: overlay,
                            icon: iconFilename,
                        }
                    }
                }

                const updatedSignage = {
                    ID: signageData.id,
                    Name: signageData.name,
                }

                // Only include optional fields if they have values
                if (signageData.hidden) {
                    updatedSignage.Hidden = "1"
                }
                if (signageData.secondary) {
                    updatedSignage.Secondary = signageData.secondary
                }
                if (Object.keys(processedStyles).length > 0) {
                    updatedSignage.Styles = processedStyles
                }

                packageInfo.Signage[signageIndex] = updatedSignage

                // Write to disk
                fs.writeFileSync(infoPath, JSON.stringify(packageInfo, null, 2))

                // Update in-memory signage in package
                const pkg = packages.find((p) => p.packageDir === packageDir)
                if (pkg && pkg.signages) {
                    const memSignageIndex = pkg.signages.findIndex(
                        (s) => s.id === signageData.originalId
                    )
                    if (memSignageIndex !== -1) {
                        // Re-resolve icon paths for in-memory version
                        const resolvedStyles = {}
                        for (const [styleId, styleConfig] of Object.entries(
                            signageData.styles || {}
                        )) {
                            if (typeof styleConfig === "string") {
                                resolvedStyles[styleId] = styleConfig
                            } else {
                                resolvedStyles[styleId] = { ...styleConfig }
                                // Re-resolve icon path if needed
                                if (
                                    styleConfig.icon &&
                                    !styleConfig.icon.includes(packageDir)
                                ) {
                                    resolvedStyles[styleId].icon = path.join(
                                        packageDir,
                                        "resources/BEE2",
                                        styleConfig.icon
                                    )
                                }
                            }
                        }

                        pkg.signages[memSignageIndex] = {
                            id: signageData.id,
                            name: signageData.name,
                            hidden: signageData.hidden || false,
                            secondary: signageData.secondary || null,
                            styles: resolvedStyles,
                        }

                        // Send update to editor
                        sendSignageUpdateToEditor(
                            signageData.originalId,
                            pkg.signages[memSignageIndex]
                        )

                        // Also update browser
                        mainWindow.webContents.send("package:loaded", {
                            items: packages
                                .flatMap((p) => p.items)
                                .map((i) => i.toJSONWithExistence()),
                            signages: packages.flatMap((p) => p.signages || []),
                        })
                    }
                }

                return { success: true }
            } else {
                throw new Error(
                    `Signage not found in info.json: ${signageData.originalId}`
                )
            }
        } catch (error) {
            console.error("Failed to save signage:", error)
            return { success: false, error: error.message }
        }
    })
}

module.exports = { register }
