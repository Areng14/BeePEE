const fs = require("fs")
const path = require("path")
const { Item } = require("../models/items")

describe("Instance Naming UI Integration", () => {
    let testPackagePath
    let testItemPath
    let testItemId = "test_instance_naming_ui_item"

    beforeEach(() => {
        // Create test directory structure
        testPackagePath = path.join(__dirname, "temp_test_package")
        testItemPath = path.join(testPackagePath, "items", "testitem")

        // Clean up from previous tests
        if (fs.existsSync(testPackagePath)) {
            fs.rmSync(testPackagePath, { recursive: true, force: true })
        }

        // Create directory structure
        fs.mkdirSync(testPackagePath, { recursive: true })
        fs.mkdirSync(testItemPath, { recursive: true })
        fs.mkdirSync(path.join(testPackagePath, "resources"), {
            recursive: true,
        })
    })

    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testPackagePath)) {
            fs.rmSync(testPackagePath, { recursive: true, force: true })
        }
    })

    test("should include displayName in getInstancesWithStatus for UI", () => {
        // Create test item JSON
        const itemJSON = {
            ID: testItemId,
            Version: {
                Styles: {
                    BEE2_CLEAN: "testitem",
                },
            },
        }

        // Create editoritems.json with instances
        const editorItems = {
            Item: {
                ItemClass: "ItemBase",
                Type: "TEST_INSTANCE_NAMING_UI",
                Editor: {
                    SubType: {
                        Name: "Test Instance Naming UI Item",
                        Model: {
                            ModelName: "test_model.3ds",
                        },
                        Palette: {
                            Tooltip: "TEST INSTANCE NAMING UI ITEM",
                            Image: "palette/test/test_item.png",
                            Position: "0 0 0",
                        },
                    },
                },
                Exporting: {
                    Instances: {
                        0: {
                            Name: "instances/test_instance1.vmf",
                            EntityCount: 1,
                            BrushCount: 2,
                            BrushSideCount: 3,
                        },
                        1: {
                            Name: "instances/test_instance2.vmf",
                            EntityCount: 4,
                            BrushCount: 5,
                            BrushSideCount: 6,
                        },
                    },
                },
            },
        }

        fs.writeFileSync(
            path.join(testItemPath, "editoritems.json"),
            JSON.stringify(editorItems, null, 2),
        )

        // Create properties.json
        const properties = {
            Properties: {
                Name: "Test Instance Naming UI Item",
                Author: "Test Author",
                Description: "A test item with instance naming UI",
            },
        }

        fs.writeFileSync(
            path.join(testItemPath, "properties.json"),
            JSON.stringify(properties, null, 2),
        )

        // Create the Item instance
        const item = new Item({ packagePath: testPackagePath, itemJSON })

        // Set a custom name
        item.setInstanceName("0", "Main Door")

        // Get instances with status (this is what the UI uses)
        const instancesWithStatus = item.getInstancesWithStatus()

        // Verify displayName is included
        expect(instancesWithStatus["0"].displayName).toBe("Main Door")
        expect(instancesWithStatus["1"].displayName).toBe("Instance 1") // Default name

        // Verify other properties are preserved
        expect(instancesWithStatus["0"].Name).toBe(
            "instances/test_instance1.vmf",
        )
        expect(instancesWithStatus["0"].EntityCount).toBe(1)
        expect(instancesWithStatus["0"]._metadata).toBeDefined()
    })

    test("should handle empty custom names correctly", () => {
        // Create test item JSON
        const itemJSON = {
            ID: testItemId,
            Version: {
                Styles: {
                    BEE2_CLEAN: "testitem",
                },
            },
        }

        // Create editoritems.json with instances
        const editorItems = {
            Item: {
                ItemClass: "ItemBase",
                Type: "TEST_INSTANCE_NAMING_UI",
                Editor: {
                    SubType: {
                        Name: "Test Instance Naming UI Item",
                        Model: {
                            ModelName: "test_model.3ds",
                        },
                        Palette: {
                            Tooltip: "TEST INSTANCE NAMING UI ITEM",
                            Image: "palette/test/test_item.png",
                            Position: "0 0 0",
                        },
                    },
                },
                Exporting: {
                    Instances: {
                        0: {
                            Name: "instances/test_instance1.vmf",
                            EntityCount: 1,
                            BrushCount: 2,
                            BrushSideCount: 3,
                        },
                    },
                },
            },
        }

        fs.writeFileSync(
            path.join(testItemPath, "editoritems.json"),
            JSON.stringify(editorItems, null, 2),
        )

        // Create properties.json
        const properties = {
            Properties: {
                Name: "Test Instance Naming UI Item",
                Author: "Test Author",
                Description: "A test item with instance naming UI",
            },
        }

        fs.writeFileSync(
            path.join(testItemPath, "properties.json"),
            JSON.stringify(properties, null, 2),
        )

        // Create the Item instance
        const item = new Item({ packagePath: testPackagePath, itemJSON })

        // Set a custom name
        item.setInstanceName("0", "Main Door")

        // Verify custom name is set
        expect(item.getInstanceName("0")).toBe("Main Door")

        // Remove the custom name (set to empty)
        item.removeInstanceName("0")

        // Verify it's back to default
        expect(item.getInstanceName("0")).toBe("Instance 0")

        // Check getInstancesWithStatus
        const instancesWithStatus = item.getInstancesWithStatus()
        expect(instancesWithStatus["0"].displayName).toBe("Instance 0")
    })
})
