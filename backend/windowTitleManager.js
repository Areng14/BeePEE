class WindowTitleManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow
        this.currentPackageName = null
        this.hasUnsavedChanges = false
        this.updateTitle()
    }

    setCurrentPackage(packageName) {
        this.currentPackageName = packageName
        this.updateTitle()
    }

    setUnsavedChanges(hasChanges) {
        this.hasUnsavedChanges = hasChanges
        this.updateTitle()
    }

    updateTitle() {
        let title = "BeePEE"

        if (this.currentPackageName) {
            // Use the package name directly
            title = `${this.currentPackageName} - BeePEE`
        }

        if (this.hasUnsavedChanges) {
            title = `*${title}`
        }

        this.mainWindow.setTitle(title)
    }

    clearPackage() {
        this.currentPackageName = null
        this.hasUnsavedChanges = false
        this.updateTitle()
    }
}

module.exports = { WindowTitleManager }
