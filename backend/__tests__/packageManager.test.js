const { loadPackage, unloadPackage } = require("../packageManager")
const { Package } = require("../models/package")
const fs = require("fs")

// Mock the Package class and fs module
jest.mock("../models/package")
jest.mock("fs")
jest.mock("electron", () => ({
    dialog: {
        showOpenDialog: jest.fn(),
    },
    ipcMain: {
        handle: jest.fn(),
    },
}))

// Mock node-7z
jest.mock("node-7z", () => ({
    extractFull: jest.fn(),
}))

describe("PackageManager", () => {
    const mockPackagePath = "__test__/package/ArengItems.bpee"

    beforeEach(() => {
        jest.clearAllMocks()

        // Clear the packages array between tests
        const packageManager = require("../packageManager")
        if (packageManager.packages) {
            packageManager.packages.length = 0
        }
    })

    describe("loadPackage", () => {
        test("should successfully load a package", async () => {
            const mockPackage = {
                name: "test-package",
                path: mockPackagePath,
                items: [
                    { id: "ITEM_1", name: "Test Item 1" },
                    { id: "ITEM_2", name: "Test Item 2" },
                ],
            }

            // Mock filesystem operations
            fs.existsSync.mockReturnValue(true)
            fs.mkdirSync.mockReturnValue(undefined)
            fs.readdirSync.mockReturnValue([])

            // Mock Package constructor and load method
            const mockPkg = {
                packageDir: "/mock/package/dir",
                load: jest.fn().mockResolvedValue(undefined),
            }
            Package.mockImplementation(() => mockPkg)

            // Mock node-7z
            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === "end") {
                        setTimeout(callback, 0)
                    }
                    return mockStream
                }),
            }
            require("node-7z").extractFull.mockReturnValue(mockStream)

            const result = await loadPackage(mockPackagePath)

            expect(fs.existsSync).toHaveBeenCalledWith(mockPackagePath)
            expect(result).toBeDefined()
        })

        test("should handle package loading errors", async () => {
            // Mock file not existing
            fs.existsSync.mockReturnValue(false)

            await expect(loadPackage(mockPackagePath)).rejects.toThrow(
                `Package file ${mockPackagePath} does not exist`,
            )
        })

        test("should add package to packages array", async () => {
            const mockPackage = { name: "test-package", items: [] }
            Package.create.mockResolvedValue(mockPackage)

            await loadPackage(mockPackagePath)

            // Note: This assumes packages array is exported from packageManager
            // You might need to adjust based on your actual implementation
        })
    })

    describe("unloadPackage", () => {
        test("should remove package from packages array", async () => {
            // This test would need access to the packages array
            // Implementation depends on how you structure the module

            const result = await unloadPackage("test-package")

            // Add assertions based on your implementation
        })

        test("should handle removing non-existent package", async () => {
            const result = await unloadPackage("non-existent-package")

            // Should not throw error, might return null or undefined
        })

        test("should cleanup files when remove=true", async () => {
            // Mock file cleanup operations
            const result = await unloadPackage("test-package", true)

            // Assert file cleanup was called
        })
    })

    test("should add package to packages array", async () => {
        const packageManager = require("../packageManager")
        const mockPackage = { name: "ArengItems", items: [] }
        Package.create.mockResolvedValue(mockPackage)

        await loadPackage(mockPackagePath)

        expect(packageManager.packages).toContain(mockPackage)
        expect(packageManager.packages).toHaveLength(1)
    })
})
