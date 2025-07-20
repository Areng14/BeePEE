const fs = require("fs")
const path = require("path")
const { Package } = require("../models/package")

// Mock all the dependencies
jest.mock("fs")
jest.mock("node-7z")
jest.mock("7zip-bin")
jest.mock("electron", () => ({
    dialog: {
        showErrorBox: jest.fn(),
    },
}))

// Mock the Item class
jest.mock("../models/items", () => ({
    Item: jest.fn().mockImplementation(({ packagePath, itemJSON }) => ({
        id: itemJSON.ID,
        name: `Mock Item ${itemJSON.ID}`,
        packagePath,
    })),
}))

describe("Package", () => {
    const mockPackagePath = "/test/path/test-package.zip"

    beforeEach(() => {
        jest.clearAllMocks()

        // Default mock implementations
        fs.mkdirSync.mockImplementation(() => {})
        fs.existsSync.mockReturnValue(true)
        fs.rmSync.mockImplementation(() => {})
        fs.statSync.mockReturnValue({ isDirectory: () => false })
        fs.readdirSync.mockReturnValue(["info.txt"])
        fs.writeFileSync.mockImplementation(() => {})

        // Mock successful 7z extraction
        const mockStream = {
            on: jest.fn((event, callback) => {
                if (event === "end") {
                    setTimeout(callback, 0) // Simulate async
                }
                return mockStream
            }),
        }
        require("node-7z").extractFull.mockReturnValue(mockStream)
        require("7zip-bin").path7za = "/mock/7za"
    })

    describe("constructor", () => {
        test("should create package with correct properties", () => {
            const pkg = new Package(mockPackagePath)

            expect(pkg.path).toBe(mockPackagePath)
            expect(pkg.name).toBe("test-package")
            expect(pkg.packageDir).toContain(
                path.join("packages", "test-package"),
            )
        })

        test("should handle package names with special characters", () => {
            const pkg = new Package("/path/my-cool_package.zip")
            expect(pkg.name).toBe("my-cool_package")
        })
    })

    describe("isLoaded", () => {
        test("should return true when package directory exists", () => {
            fs.existsSync.mockReturnValue(true)
            const pkg = new Package(mockPackagePath)

            expect(pkg.isLoaded()).toBe(true)
        })

        test("should return false when package directory does not exist", () => {
            fs.existsSync.mockReturnValue(false)
            const pkg = new Package(mockPackagePath)

            expect(pkg.isLoaded()).toBe(false)
        })
    })

    describe("Package.create", () => {
        const mockInfoContent = {
            Item: [
                {
                    ID: "TEST_ITEM_1",
                    Version: {
                        Styles: {
                            BEE2_CLEAN: "test_item",
                        },
                    },
                },
                {
                    ID: "TEST_ITEM_2",
                    Version: {
                        Styles: {
                            BEE2_CLEAN: "test_item_2",
                        },
                    },
                },
            ],
        }

        test("should successfully load package with multiple items", async () => {
            fs.readFileSync.mockReturnValue(JSON.stringify(mockInfoContent))

            const pkg = await Package.create(mockPackagePath)

            expect(pkg).toBeInstanceOf(Package)
            expect(pkg.items).toHaveLength(2)
            expect(pkg.items[0].id).toBe("TEST_ITEM_1")
            expect(pkg.items[1].id).toBe("TEST_ITEM_2")
        })

        test("should handle single item packages", async () => {
            const singleItemContent = {
                Item: {
                    ID: "SINGLE_ITEM",
                    Version: {
                        Styles: {
                            BEE2_CLEAN: "single",
                        },
                    },
                },
            }
            fs.readFileSync.mockReturnValue(JSON.stringify(singleItemContent))

            const pkg = await Package.create(mockPackagePath)

            expect(pkg.items).toHaveLength(1)
            expect(pkg.items[0].id).toBe("SINGLE_ITEM")
        })

        test("should handle empty keys in JSON", async () => {
            const contentWithEmptyKeys = {
                Item: {
                    ID: "TEST_ITEM",
                    "": "some value",
                    desc_0: "another value",
                },
            }
            fs.readFileSync.mockReturnValue(
                JSON.stringify(contentWithEmptyKeys),
            )

            const pkg = await Package.create(mockPackagePath)

            expect(pkg.items).toHaveLength(1)
        })
    })

    describe("error handling", () => {
        test("should throw error when info.txt is missing", async () => {
            fs.existsSync.mockReturnValue(false)

            await expect(Package.create(mockPackagePath)).rejects.toThrow(
                "Package missing info.txt file",
            )
        })

        test("should cleanup on extraction failure", async () => {
            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === "error") {
                        setTimeout(
                            () => callback(new Error("Extraction failed")),
                            0,
                        )
                    }
                    return mockStream
                }),
            }
            require("node-7z").extractFull.mockReturnValue(mockStream)

            await expect(Package.create(mockPackagePath)).rejects.toThrow(
                "Extraction failed",
            )

            expect(fs.rmSync).toHaveBeenCalledWith(
                expect.stringContaining("test-package"),
                { recursive: true, force: true },
            )
        })
    })

    describe("item management", () => {
        let pkg

        beforeEach(() => {
            pkg = new Package(mockPackagePath)
            pkg.items = [
                { id: "ITEM_1", name: "Test Item 1" },
                { id: "ITEM_2", name: "Test Item 2" },
            ]
        })

        test("should add new item", () => {
            const newItemData = { ID: "NEW_ITEM" }
            pkg.addItem("/package/path", newItemData)

            expect(pkg.items).toHaveLength(3)
        })

        test("should get item by ID", () => {
            const item = pkg.getItemById("ITEM_1")
            expect(item.id).toBe("ITEM_1")
        })

        test("should get item by name", () => {
            const item = pkg.getItemByName("Test Item 1")
            expect(item.name).toBe("Test Item 1")
        })

        test("should return undefined for non-existent item", () => {
            const item = pkg.getItemById("NON_EXISTENT")
            expect(item).toBeUndefined()
        })

        test("should remove item by ID", () => {
            const removed = pkg.removeItem("ITEM_1")

            expect(removed.id).toBe("ITEM_1")
            expect(pkg.items).toHaveLength(1)
            expect(pkg.getItemById("ITEM_1")).toBeUndefined()
        })

        test("should remove item by name", () => {
            const removed = pkg.removeItem("Test Item 2")

            expect(removed.name).toBe("Test Item 2")
            expect(pkg.items).toHaveLength(1)
        })

        test("should return null when removing non-existent item", () => {
            const removed = pkg.removeItem("NON_EXISTENT")
            expect(removed).toBeNull()
        })

        test("should remove all items", () => {
            pkg.removeAllItems()
            expect(pkg.items).toHaveLength(0)
        })

        test("should throw error when getting item with empty name", () => {
            expect(() => pkg.getItemByName("")).toThrow("Name is empty!")
        })

        test("should throw error when getting item with empty ID", () => {
            expect(() => pkg.getItemById("")).toThrow("ID is empty!")
        })
    })
})
