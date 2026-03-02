const fs = require("fs")
const path = require("path")
const { Item } = require("./items")
const { getPackagesDir } = require("../utils/packagesDir")

class Package {
    constructor(packagePath) {
        this.path = packagePath
        this.name = path.parse(this.path).name
        const packageName = path.parse(this.path).name
        this.packageDir = path.join(getPackagesDir(), packageName)
        this.items = []
        this.signages = []
    }

    isLoaded() {
        return fs.existsSync(this.packageDir)
    }

    async load() {
        try {
            const infoPath = path.join(this.packageDir, "info.json")
            if (!fs.existsSync(infoPath)) {
                throw new Error(
                    `[package : ${this.name}]: Missing info.json file`,
                )
            }

            // Read and parse info.json
            const parsedInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"))

            // Use the actual package name from info.json if available
            if (parsedInfo.Name) {
                this.name = parsedInfo.Name
            } else if (parsedInfo.ID) {
                this.name = parsedInfo.ID
            }

            // Items (now optional - packages can have only signages)
            let rawitems = parsedInfo["Item"] || []

            // Convert single item to array
            if (!Array.isArray(rawitems)) {
                rawitems = [rawitems]
            }

            // Create items directly in this package
            this.items = rawitems.map(
                (element) =>
                    new Item({
                        packagePath: this.packageDir,
                        itemJSON: element,
                    }),
            )

            // Signages (also optional)
            let rawSignages = parsedInfo["Signage"] || []

            // Convert single signage to array
            if (!Array.isArray(rawSignages)) {
                rawSignages = [rawSignages]
            }

            // Parse signages and resolve icon paths
            this.signages = rawSignages.map((sig) => {
                // Process styles to resolve icon paths
                const processedStyles = {}
                if (sig.Styles) {
                    for (const [styleKey, styleValue] of Object.entries(
                        sig.Styles,
                    )) {
                        // Handle style inheritance (e.g., "BORING_STYLE" = "FANCY_STYLE")
                        if (typeof styleValue === "string") {
                            processedStyles[styleKey] = styleValue
                        } else if (styleValue && typeof styleValue === "object") {
                            const iconPath = styleValue.icon
                            let resolvedIcon = null
                            if (iconPath) {
                                // Resolve icon path relative to package
                                // Icon can be:
                                // - "items/clean/BEE/signage/cake.png" -> resources/BEE2/items/...
                                // - "PACKAGE:path/file.png" -> resources/BEE2/path/file.png
                                // - "filename.png" -> resources/BEE2/items/filename.png
                                if (iconPath.includes(":")) {
                                    // Package reference - just use the part after ':'
                                    const pathPart = iconPath.split(":")[1]
                                    resolvedIcon = path.join(
                                        this.packageDir,
                                        "resources/BEE2",
                                        pathPart,
                                    )
                                } else if (iconPath.includes("/")) {
                                    // Path with directories - prepend resources/BEE2
                                    resolvedIcon = path.join(
                                        this.packageDir,
                                        "resources/BEE2",
                                        iconPath,
                                    )
                                } else {
                                    // Simple filename - look in BEE2/items
                                    resolvedIcon = path.join(
                                        this.packageDir,
                                        "resources/BEE2/items",
                                        iconPath,
                                    )
                                }
                            }
                            processedStyles[styleKey] = {
                                ...styleValue,
                                icon: resolvedIcon,
                            }
                        }
                    }
                }

                return {
                    id: sig.ID,
                    name: sig.Name,
                    hidden: sig.Hidden === "1" || sig.Hidden === true,
                    primary: sig.Primary || null,
                    secondary: sig.Secondary || null,
                    styles: processedStyles,
                }
            })

            // Set importedVersion for items that don't have it (for imported packages)
            try {
                const packageJson = require("../../package.json")
                const appVersion = packageJson.version
                if (appVersion) {
                    for (const item of this.items) {
                        const metadata = item.getMetadata()
                        // Only set importedVersion if it doesn't exist (meaning it was imported)
                        // and if createdVersion doesn't exist (meaning it wasn't created in this app)
                        if (!metadata.importedVersion && !metadata.createdVersion) {
                            item.updateMetadata({ importedVersion: appVersion })
                        }
                    }
                }
            } catch (error) {
                console.warn("Failed to set importedVersion:", error.message)
            }

            // Auto-import VBSP instances for all items (runs once per item)
            console.log(`\n🔍 Checking for VBSP instances to auto-import...`)
            let totalImported = 0
            for (const item of this.items) {
                if (item.autoImportVBSPInstances()) {
                    totalImported++
                }
            }
            if (totalImported > 0) {
                console.log(
                    `✅ Auto-imported VBSP instances for ${totalImported} item(s) in ${this.name}\n`,
                )
            } else {
                console.log(`⏭️ No VBSP instances to import in ${this.name}\n`)
            }

            return { items: this.items, signages: this.signages }
        } catch (error) {
            console.error(
                `[package : ${this.name}]: Failed to load - ${error.message}`,
            )
            this.items = []
            this.signages = []
            throw error
        }
    }

    addItem(packagePath, itemJSON) {
        //Adds a item to the itemsArray
        //NOTE: YOU NEED TO MAKE THE FOLDER STRUCUTRE + EDITORITEMS BEFORE CALLING THIS
        return this.items.push(new Item({ packagePath, itemJSON }))
    }

    getItemByName(name) {
        if (!name) {
            throw new Error("Name is empty!")
        }

        return this.items.find((item) => item.name === name)
    }

    getItemById(id) {
        if (!id) {
            throw new Error("ID is empty!")
        }

        return this.items.find((item) => item.id === id)
    }

    removeItem(identifier) {
        const index = this.items.findIndex(
            (item) => item.name === identifier || item.id === identifier,
        )
        if (index !== -1) {
            return this.items.splice(index, 1)[0]
        }
        return null
    }

    removeAllItems() {
        this.items.length = 0
    }

    // Static method for creating and loading a package
    static async create(packagePath) {
        const pkg = new Package(packagePath)
        await pkg.load()
        return pkg
    }
}

module.exports = { Package }
