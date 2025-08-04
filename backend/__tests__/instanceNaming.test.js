const fs = require("fs")
const path = require("path")
const { Item } = require("../models/items")

describe("Instance Naming", () => {
    let testPackagePath
    let testItemPath
    let testItemId = "test_instance_naming_item"

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
        fs.mkdirSync(path.join(testPackagePath, "resources"), { recursive: true })
    })

    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testPackagePath)) {
            fs.rmSync(testPackagePath, { recursive: true, force: true })
        }
    })

    test("should get default instance name when no custom name is set", () => {
        // Create test item JSON
        const itemJSON = {
            ID: testItemId,
            Version: {
                Styles: {
                    BEE2_CLEAN: "testitem"
                }
            }
        }

        // Create editoritems.json with instances
        const editorItems = {
            Item: {
                ItemClass: "ItemBase",
                Type: "TEST_INSTANCE_NAMING",
                Editor: {
                    SubType: {
                        Name: "Test Instance Naming Item",
                        Model: {
                            ModelName: "test_model.3ds"
                        },
                        Palette: {
                            Tooltip: "TEST INSTANCE NAMING ITEM",
                            Image: "palette/test/test_item.png",
                            Position: "0 0 0"
                        }
                    }
                },
                Exporting: {
                    Instances: {
                        "0": {
                            Name: "instances/test_instance1.vmf",
                            EntityCount: 1,
                            BrushCount: 2,
                            BrushSideCount: 3
                        },
                        "1": {
                            Name: "instances/test_instance2.vmf",
                            EntityCount: 4,
                            BrushCount: 5,
                            BrushSideCount: 6
                        }
                    }
                }
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "editoritems.json"),
            JSON.stringify(editorItems, null, 2)
        )

        // Create properties.json
        const properties = {
            Properties: {
                Name: "Test Instance Naming Item",
                Author: "Test Author",
                Description: "A test item with instance naming"
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "properties.json"),
            JSON.stringify(properties, null, 2)
        )

        // Create the Item instance
        const item = new Item({ packagePath: testPackagePath, itemJSON })

        // Test default names
        expect(item.getInstanceName("0")).toBe("Instance 0")
        expect(item.getInstanceName("1")).toBe("Instance 1")
        expect(item.getInstanceName("999")).toBe("Instance 999") // Non-existent instance
    })

    test("should set and get custom instance names", () => {
        // Create test item JSON
        const itemJSON = {
            ID: testItemId,
            Version: {
                Styles: {
                    BEE2_CLEAN: "testitem"
                }
            }
        }

        // Create editoritems.json with instances
        const editorItems = {
            Item: {
                ItemClass: "ItemBase",
                Type: "TEST_INSTANCE_NAMING",
                Editor: {
                    SubType: {
                        Name: "Test Instance Naming Item",
                        Model: {
                            ModelName: "test_model.3ds"
                        },
                        Palette: {
                            Tooltip: "TEST INSTANCE NAMING ITEM",
                            Image: "palette/test/test_item.png",
                            Position: "0 0 0"
                        }
                    }
                },
                Exporting: {
                    Instances: {
                        "0": {
                            Name: "instances/test_instance1.vmf",
                            EntityCount: 1,
                            BrushCount: 2,
                            BrushSideCount: 3
                        },
                        "1": {
                            Name: "instances/test_instance2.vmf",
                            EntityCount: 4,
                            BrushCount: 5,
                            BrushSideCount: 6
                        }
                    }
                }
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "editoritems.json"),
            JSON.stringify(editorItems, null, 2)
        )

        // Create properties.json
        const properties = {
            Properties: {
                Name: "Test Instance Naming Item",
                Author: "Test Author",
                Description: "A test item with instance naming"
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "properties.json"),
            JSON.stringify(properties, null, 2)
        )

        // Create the Item instance
        const item = new Item({ packagePath: testPackagePath, itemJSON })

        // Set custom names
        item.setInstanceName("0", "Main Door")
        item.setInstanceName("1", "Side Window")

        // Test custom names
        expect(item.getInstanceName("0")).toBe("Main Door")
        expect(item.getInstanceName("1")).toBe("Side Window")

        // Test that meta.json was created and contains the names
        const metaPath = path.join(testItemPath, "meta.json")
        expect(fs.existsSync(metaPath)).toBe(true)

        const metadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"))
        expect(metadata.instanceNames).toBeDefined()
        expect(metadata.instanceNames["0"]).toBe("Main Door")
        expect(metadata.instanceNames["1"]).toBe("Side Window")
    })

    test("should get all instance names", () => {
        // Create test item JSON
        const itemJSON = {
            ID: testItemId,
            Version: {
                Styles: {
                    BEE2_CLEAN: "testitem"
                }
            }
        }

        // Create editoritems.json with instances
        const editorItems = {
            Item: {
                ItemClass: "ItemBase",
                Type: "TEST_INSTANCE_NAMING",
                Editor: {
                    SubType: {
                        Name: "Test Instance Naming Item",
                        Model: {
                            ModelName: "test_model.3ds"
                        },
                        Palette: {
                            Tooltip: "TEST INSTANCE NAMING ITEM",
                            Image: "palette/test/test_item.png",
                            Position: "0 0 0"
                        }
                    }
                },
                Exporting: {
                    Instances: {
                        "0": {
                            Name: "instances/test_instance1.vmf",
                            EntityCount: 1,
                            BrushCount: 2,
                            BrushSideCount: 3
                        },
                        "1": {
                            Name: "instances/test_instance2.vmf",
                            EntityCount: 4,
                            BrushCount: 5,
                            BrushSideCount: 6
                        }
                    }
                }
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "editoritems.json"),
            JSON.stringify(editorItems, null, 2)
        )

        // Create properties.json
        const properties = {
            Properties: {
                Name: "Test Instance Naming Item",
                Author: "Test Author",
                Description: "A test item with instance naming"
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "properties.json"),
            JSON.stringify(properties, null, 2)
        )

        // Create the Item instance
        const item = new Item({ packagePath: testPackagePath, itemJSON })

        // Set some custom names
        item.setInstanceName("0", "Main Door")

        // Get all instance names
        const allNames = item.getInstanceNames()
        expect(allNames).toEqual({
            "0": "Main Door"
        })

        // Set another name
        item.setInstanceName("1", "Side Window")
        const updatedNames = item.getInstanceNames()
        expect(updatedNames).toEqual({
            "0": "Main Door",
            "1": "Side Window"
        })
    })

    test("should remove instance names", () => {
        // Create test item JSON
        const itemJSON = {
            ID: testItemId,
            Version: {
                Styles: {
                    BEE2_CLEAN: "testitem"
                }
            }
        }

        // Create editoritems.json with instances
        const editorItems = {
            Item: {
                ItemClass: "ItemBase",
                Type: "TEST_INSTANCE_NAMING",
                Editor: {
                    SubType: {
                        Name: "Test Instance Naming Item",
                        Model: {
                            ModelName: "test_model.3ds"
                        },
                        Palette: {
                            Tooltip: "TEST INSTANCE NAMING ITEM",
                            Image: "palette/test/test_item.png",
                            Position: "0 0 0"
                        }
                    }
                },
                Exporting: {
                    Instances: {
                        "0": {
                            Name: "instances/test_instance1.vmf",
                            EntityCount: 1,
                            BrushCount: 2,
                            BrushSideCount: 3
                        }
                    }
                }
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "editoritems.json"),
            JSON.stringify(editorItems, null, 2)
        )

        // Create properties.json
        const properties = {
            Properties: {
                Name: "Test Instance Naming Item",
                Author: "Test Author",
                Description: "A test item with instance naming"
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "properties.json"),
            JSON.stringify(properties, null, 2)
        )

        // Create the Item instance
        const item = new Item({ packagePath: testPackagePath, itemJSON })

        // Set a custom name
        item.setInstanceName("0", "Main Door")
        expect(item.getInstanceName("0")).toBe("Main Door")

        // Remove the name
        item.removeInstanceName("0")
        expect(item.getInstanceName("0")).toBe("Instance 0") // Back to default

        // Verify meta.json no longer contains the name
        const metaPath = path.join(testItemPath, "meta.json")
        const metadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"))
        expect(metadata.instanceNames).toBeDefined()
        expect(metadata.instanceNames["0"]).toBeUndefined()
    })

    test("should include display names in getInstancesWithStatus", () => {
        // Create test item JSON
        const itemJSON = {
            ID: testItemId,
            Version: {
                Styles: {
                    BEE2_CLEAN: "testitem"
                }
            }
        }

        // Create editoritems.json with instances
        const editorItems = {
            Item: {
                ItemClass: "ItemBase",
                Type: "TEST_INSTANCE_NAMING",
                Editor: {
                    SubType: {
                        Name: "Test Instance Naming Item",
                        Model: {
                            ModelName: "test_model.3ds"
                        },
                        Palette: {
                            Tooltip: "TEST INSTANCE NAMING ITEM",
                            Image: "palette/test/test_item.png",
                            Position: "0 0 0"
                        }
                    }
                },
                Exporting: {
                    Instances: {
                        "0": {
                            Name: "instances/test_instance1.vmf",
                            EntityCount: 1,
                            BrushCount: 2,
                            BrushSideCount: 3
                        },
                        "1": {
                            Name: "instances/test_instance2.vmf",
                            EntityCount: 4,
                            BrushCount: 5,
                            BrushSideCount: 6
                        }
                    }
                }
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "editoritems.json"),
            JSON.stringify(editorItems, null, 2)
        )

        // Create properties.json
        const properties = {
            Properties: {
                Name: "Test Instance Naming Item",
                Author: "Test Author",
                Description: "A test item with instance naming"
            }
        }

        fs.writeFileSync(
            path.join(testItemPath, "properties.json"),
            JSON.stringify(properties, null, 2)
        )

        // Create the Item instance
        const item = new Item({ packagePath: testPackagePath, itemJSON })

        // Set a custom name
        item.setInstanceName("0", "Main Door")

        // Get instances with status
        const instancesWithStatus = item.getInstancesWithStatus()

        // Check that display names are included
        expect(instancesWithStatus["0"].displayName).toBe("Main Door")
        expect(instancesWithStatus["1"].displayName).toBe("Instance 1") // Default name
    })
}) 