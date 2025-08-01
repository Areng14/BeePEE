const path = require("path")

class WindowTitleManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow
        this.currentPackagePath = null
        this.hasUnsavedChanges = false
        this.updateTitle()
    }

    setCurrentPackage(packagePath) {
        this.currentPackagePath = packagePath
        this.updateTitle()
    }

    setUnsavedChanges(hasChanges) {
        this.hasUnsavedChanges = hasChanges
        this.updateTitle()
    }

    updateTitle() {
        let title = "BeePEE"

        if (this.currentPackagePath) {
            // Get the package name from the path
            const packageName = path.basename(this.currentPackagePath)
            title = `${packageName} - BeePEE`
        }

        if (this.hasUnsavedChanges) {
            title = `*${title}`
        }

        this.mainWindow.setTitle(title)
    }

    clearPackage() {
        this.currentPackagePath = null
        this.hasUnsavedChanges = false
        this.updateTitle()
    }
}

module.exports = { WindowTitleManager }
