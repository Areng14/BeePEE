const fs = require("fs")
const path = require("path")

class Signage {
    constructor({ packagePath, signageJSON }) {
        this.packagePath = packagePath
        this.id = signageJSON.ID
        this.name = signageJSON.Name || signageJSON.ID
        this.hidden = signageJSON.Hidden === "1" || signageJSON.Hidden === true
        this.primary = signageJSON.Primary || null
        this.secondary = signageJSON.Secondary || null
        this.styles = signageJSON.Styles || {}
        
        // Get the icon from the first available style
        this.icon = this.getIconPath()
    }

    getIconPath() {
        // Try to get icon from BEE2_CLEAN style first, then any available style
        const styleKeys = Object.keys(this.styles)
        if (styleKeys.length === 0) {
            console.log(`🔍 Signage ${this.id}: No styles found`)
            return null
        }

        // Try BEE2_CLEAN first
        let styleConfig = this.styles.BEE2_CLEAN
        let selectedStyle = 'BEE2_CLEAN'
        
        // If BEE2_CLEAN doesn't exist or is a string reference, try to find the first object config
        if (!styleConfig || typeof styleConfig === "string") {
            console.log(`🔍 Signage ${this.id}: BEE2_CLEAN not found or is a reference, searching for first object style`)
            for (const key of styleKeys) {
                const config = this.styles[key]
                if (typeof config === "object" && config !== null) {
                    styleConfig = config
                    selectedStyle = key
                    console.log(`🔍 Signage ${this.id}: Found style ${key}`, config)
                    break
                }
            }
        }

        if (!styleConfig || typeof styleConfig === "string") {
            console.log(`🔍 Signage ${this.id}: No valid style config found`)
            return null
        }

        console.log(`🔍 Signage ${this.id}: Using style ${selectedStyle}`, styleConfig)

        // Get icon path from style config
        const iconPath = styleConfig.icon
        if (!iconPath) {
            console.log(`🔍 Signage ${this.id}: No icon path in style config`)
            // If no icon is specified, try to derive from overlay material
            const overlayPath = styleConfig.overlay
            if (overlayPath) {
                console.log(`🔍 Signage ${this.id}: Has overlay: ${overlayPath}, but no icon conversion implemented yet`)
                // Try to convert overlay material name to PNG path
                // overlay format is like "signage/icon_cube" which should map to resources/materials/signage/icon_cube.png or .vtf
                return null // For now, we'll handle this later
            }
            return null
        }

        console.log(`🔍 Signage ${this.id}: Raw icon path: ${iconPath}`)

        // Parse icon path - it might be in format "PACKAGE:path/to/icon.png"
        if (iconPath.includes(":")) {
            const [packageId, relativePath] = iconPath.split(":", 2)
            console.log(`🔍 Signage ${this.id}: Package format - packageId: ${packageId}, relativePath: ${relativePath}`)
            // For now, assume it's in the current package
            // In the future, we might need to handle cross-package references
            const fullPath = path.join(this.packagePath, "resources", "BEE2", relativePath)
            console.log(`🔍 Signage ${this.id}: Full path: ${fullPath}`)
            return fullPath
        } else {
            // Assume it's a relative path - signage icons are in resources/BEE2/
            const fullPath = path.join(this.packagePath, "resources", "BEE2", iconPath)
            console.log(`🔍 Signage ${this.id}: Relative path, full path: ${fullPath}`)
            return fullPath
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            hidden: this.hidden,
            primary: this.primary,
            secondary: this.secondary,
            styles: this.styles,
            icon: this.icon,
        }
    }
}

module.exports = { Signage }

