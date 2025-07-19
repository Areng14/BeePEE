const { loadPackage, unloadPackage } = require("../packageManager")
const { Package } = require("../models/package")

// Mock the Package class
jest.mock("../models/package")
jest.mock("electron", () => ({
    dialog: {
        showOpenDialog: jest.fn(),
    },
    ipcMain: {
        handle: jest.fn(),
    },
}))

describe("PackageManager", () => {
    const mockPackagePath = "__test__/package/ArengItems.bee_pack"

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

            Package.create.mockResolvedValue(mockPackage)

            const result = await loadPackage(mockPackagePath)

            expect(Package.create).toHaveBeenCalledWith(mockPackagePath)
            expect(result).toBe(mockPackage)
        })

        test("should handle package loading errors", async () => {
            const error = new Error("Package loading failed")
            Package.create.mockRejectedValue(error)

            await expect(loadPackage(mockPackagePath)).rejects.toThrow(
                "Package loading failed",
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
