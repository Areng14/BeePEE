const fs = require("fs")
const path = require("path")
const { Item } = require("./items")

class Package {
    constructor(packagePath) {
        this.path = packagePath
        this.name = path.parse(this.path).name
        const packageName = path.parse(this.path).name
        this.packageDir = path.join(
            __dirname,
            "..",
            "..",
            "packages",
            packageName,
        )
        this.items = []
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

            // Items
            let rawitems = parsedInfo["Item"]
            if (!rawitems) {
                throw new Error(
                    `[package : ${this.name}]: Invalid package format - no items found`,
                )
            }

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

            return this.items
        } catch (error) {
            console.error(
                `[package : ${this.name}]: Failed to load - ${error.message}`,
            )
            this.items = []
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
