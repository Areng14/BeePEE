const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")
const { Item } = require("./items")
const path7za = require('7zip-bin').path7za
const { extractFull } = require('node-7z')
const { dialog } = require('electron')

class Package {
    constructor(packagePath) {
        this.path = packagePath
        this.name = path.parse(this.path).name
        const packageName = path.parse(this.path).name
        this.packageDir = path.join(__dirname, "..", "packages", packageName)
    }

    static async create(packagePath) {
        const pkg = new Package(packagePath)
        await pkg.loadItems()
        return pkg
    }

    isLoaded = () => {
        fs.existsSync(this.packageDir)
    }

    async getStats() {
        //Check if the package is there if not then well it aint loaded
        stats = {
            "Items" : 0,
            "Signages" : 0,
            "Music" : 0,
            "Style" : 0,
            //Thats the plan for now...
        }
    }

    async loadInfo() {
        try {
            // Extract package
            fs.mkdirSync(this.packageDir, { recursive: true })

            const stream = extractFull(this.path, this.packageDir, {
                $bin: path7za,
                recursive: true,
            })

            await new Promise((resolve, reject) => {
                stream.on("end", resolve)
                stream.on("error", reject)
            })

            const infoPath = path.join(this.packageDir, "info.txt")

            if (!fs.existsSync(infoPath)) {
                throw new Error("Package missing info.txt file")
            }

            const rawInfo = fs.readFileSync(infoPath, "utf-8")
            let emptyKeyCounter = 0
            const fixedInfo = rawInfo.replace(
                /""\s+"/g,
                () => `"desc_${emptyKeyCounter++}" "`,
            )
            const parsedInfo = vdf.parse(fixedInfo)

            // Items
            let rawitems = parsedInfo["Item"]
            if (!rawitems) {
                throw new Error("Invalid package format - no items found")
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

            return this.items
        } catch (error) {
            console.error("Failed to load package:", error.message)

            // Cleanup on failure
            if (this.packageDir && fs.existsSync(this.packageDir)) {
                try {
                    fs.rmSync(this.packageDir, { recursive: true, force: true })
                    console.log("Cleaned up failed package directory")
                } catch (cleanupError) {
                    console.error(
                        "Failed to cleanup package directory:",
                        cleanupError.message,
                    )
                }
            }

            // Reset items state
            this.items = []

            dialog.showErrorBox(
                "Package Load Failed",
                `Failed to load package ${path.parse(this.path).name}: ${error.message}`,
            )

            this.items = []

            return false
        }
    }

    addItem(packagePath, itemJSON) {
        //Adds a item to the itemsArray
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
}
