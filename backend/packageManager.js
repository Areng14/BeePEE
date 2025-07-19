const { dialog, ipcMain } = require("electron")
const { Package } = require("./models/package") // import your new class

var packages = []

const unloadPackage = async (packageName, remove = false) => {
    const index = packages.findIndex((pkg) => pkg.name === packageName)
    if (index !== -1) {
        if (remove) {
            // maybe delete the extracted files too
        }
        return packages.splice(index, 1)[0]
    }
}

const loadPackage = async (pathToPackage) => {
    try {
        const pkg = await Package.create(pathToPackage)
        packages.push(pkg)
        return pkg
    } catch (error) {
        console.error("Failed to load package:", error)
        throw error
    }
}

const reg_loadPackagePopup = () => {
    ipcMain.handle("dialog:loadPackage", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
        })

        if (result.canceled) return null

        const pkg = await loadPackage(result.filePaths[0])
        return pkg.items // return the package's items
    })
}

module.exports = {
    reg_loadPackagePopup,
    loadPackage,
    unloadPackage,
    packages,
}
