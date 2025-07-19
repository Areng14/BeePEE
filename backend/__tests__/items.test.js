const fs = require("fs")
const path = require("path")
const vdf = require("vdf-parser")
const { Item } = require("../models/items")

// Mock dependencies
jest.mock("fs")
jest.mock("vdf-parser")

describe("Item", () => {
    const mockPackagePath = "/test/packages/test-package"
    const mockItemJSON = {
        ID: "TEST_ITEM_001",
        Version: {
            Styles: {
                BEE2_CLEAN: "test_button",
            },
        },
    }

    const mockEditorItemsVDF = `
"Item"
{
    "ItemClass" "ItemButtonFloor"
    "Type" "TEST_ITEM_001"
    "Editor"
    {
        "SubType"
        {
            "Name" "Test Button"
            "Model" { "ModelName" "buttonweight.3ds" }
            "Palette"
            {
                "Tooltip" "TEST BUTTON"
                "Image" "palette/beepkg/test_button.png"
                "Position" "4 2 0"
            }
        }
        "MovementHandle" "HANDLE_4_DIRECTIONS"
    }
}
`

    const mockPropertiesVDF = `
"Properties"
{
    "Authors" "Test Author"
    "Description" "A test button item"
    "Icon"
    {
        "0" "beepkg/test_button.png"
    }
}
`

    beforeEach(() => {
        jest.clearAllMocks()

        // Default mocks
        fs.existsSync.mockReturnValue(true)
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes("editoritems.txt")) {
                return mockEditorItemsVDF
            }
            if (filePath.includes("properties.txt")) {
                return mockPropertiesVDF
            }
            return ""
        })

        vdf.parse.mockImplementation((content) => {
            if (content.includes("ItemClass")) {
                return {
                    Item: {
                        Editor: {
                            SubType: {
                                Name: "Test Button",
                            },
                        },
                    },
                }
            }
            if (content.includes("Authors")) {
                return {
                    Properties: {
                        Authors: "Test Author",
                        Description: "A test button item",
                        Icon: {
                            0: "beepkg/test_button.png",
                        },
                    },
                }
            }
            return {}
        })
    })

    describe("constructor", () => {
        test("should create item with basic properties", () => {
            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.packagePath).toBe(mockPackagePath)
            expect(item.id).toBe("TEST_ITEM_001")
            expect(item.name).toBe("Test Button")
            expect(item.itemFolder).toBe("test_button")
        })

        test("should handle different style folder formats", () => {
            const itemWithObjectFolder = {
                ID: "TEST_ITEM_002",
                Version: {
                    Styles: {
                        BEE2_CLEAN: {
                            folder: "custom_folder",
                        },
                    },
                },
            }

            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: itemWithObjectFolder,
            })

            expect(item.itemFolder).toBe("custom_folder")
        })

        test("should handle missing BEE2_CLEAN style", () => {
            const itemWithOtherStyle = {
                ID: "TEST_ITEM_003",
                Version: {
                    Styles: {
                        CUSTOM_STYLE: "custom_item",
                    },
                },
            }

            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: itemWithOtherStyle,
            })

            expect(item.itemFolder).toBe("custom_item")
        })

        test("should set correct file paths", () => {
            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.paths.editorItems).toBe(
                path.join(
                    mockPackagePath,
                    "items",
                    "test_button",
                    "editoritems.txt",
                ),
            )
            expect(item.paths.properties).toBe(
                path.join(
                    mockPackagePath,
                    "items",
                    "test_button",
                    "properties.txt",
                ),
            )
        })

        test("should set vbsp_config path when file exists", () => {
            fs.existsSync.mockImplementation((filePath) => {
                return (
                    filePath.includes("vbsp_config.cfg") ||
                    !filePath.includes("missing")
                )
            })

            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.paths.vbsp_config).toBeDefined()
            expect(item.paths.vbsp_config).toContain("vbsp_config.cfg")
        })

        test("should not set vbsp_config path when file missing", () => {
            fs.existsSync.mockImplementation((filePath) => {
                return !filePath.includes("vbsp_config.cfg")
            })

            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.paths.vbsp_config).toBeUndefined()
        })

        test("should handle array of SubTypes", () => {
            vdf.parse.mockReturnValue({
                Item: {
                    Editor: {
                        SubType: [
                            { Name: "First SubType" },
                            { Name: "Second SubType" },
                        ],
                    },
                },
            })

            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.name).toBe("First SubType")
        })

        test("should set icon path correctly", () => {
            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.icon).toBe(
                path.join(
                    mockPackagePath,
                    "resources/BEE2/items",
                    "beepkg/test_button.png",
                ),
            )
        })

        test("should handle missing icon", () => {
            vdf.parse.mockImplementation((content) => {
                if (content.includes("Authors")) {
                    return {
                        Properties: {
                            Authors: "Test Author",
                            Description: "A test button item",
                        },
                    }
                }
                return {
                    Item: {
                        Editor: {
                            SubType: { Name: "Test Button" },
                        },
                    },
                }
            })

            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.icon).toBeNull()
        })
    })

    describe("error handling", () => {
        test("should throw error when no item folder found", () => {
            const invalidItemJSON = {
                ID: "INVALID_ITEM",
                Version: {},
            }

            expect(() => {
                new Item({
                    packagePath: mockPackagePath,
                    itemJSON: invalidItemJSON,
                })
            }).toThrow("No item folder found for item INVALID_ITEM")
        })

        test("should throw error when editoritems.txt missing", () => {
            fs.existsSync.mockImplementation((filePath) => {
                return !filePath.includes("editoritems.txt")
            })

            expect(() => {
                new Item({
                    packagePath: mockPackagePath,
                    itemJSON: mockItemJSON,
                })
            }).toThrow("Missing editoritems.txt!")
        })

        test("should throw error when properties.txt missing", () => {
            fs.existsSync.mockImplementation((filePath) => {
                return !filePath.includes("properties.txt")
            })

            expect(() => {
                new Item({
                    packagePath: mockPackagePath,
                    itemJSON: mockItemJSON,
                })
            }).toThrow("Missing properties.txt!")
        })

        test("should throw error when SubType Name missing", () => {
            vdf.parse.mockReturnValue({
                Item: {
                    Editor: {
                        SubType: {},
                    },
                },
            })

            expect(() => {
                new Item({
                    packagePath: mockPackagePath,
                    itemJSON: mockItemJSON,
                })
            }).toThrow("Invalid editoritems - missing SubType Name")
        })

        test("should handle malformed properties.txt with empty keys", () => {
            const malformedProperties = `
"Properties"
{
    "Authors" "Test Author"
    "" "empty key value"
    "" "another empty key"
    "Description" "Test description"
}
`

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes("properties.txt")) {
                    return malformedProperties
                }
                return mockEditorItemsVDF
            })

            // Should fix empty keys and parse successfully
            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })

            expect(item.details.Authors).toBe("Test Author")
        })
    })

    describe("file operations", () => {
        let item

        beforeEach(() => {
            item = new Item({
                packagePath: mockPackagePath,
                itemJSON: mockItemJSON,
            })
        })

        test("should return parsed editor items", () => {
            const editorItems = item.getEditorItems()

            expect(vdf.parse).toHaveBeenCalledWith(mockEditorItemsVDF)
            expect(editorItems).toHaveProperty("Item")
        })

        test('should return raw editor items when requested', () => {
            vdf.parse.mockClear()
            
            const rawEditorItems = item.getEditorItems(true)
            
            expect(rawEditorItems).toBe(mockEditorItemsVDF)
            expect(vdf.parse).not.toHaveBeenCalled()
        })

        test("should save editor items", () => {
            const mockVDF = { Item: { test: "data" } }
            vdf.stringify = jest.fn().mockReturnValue("stringified vdf")
            fs.writeFileSync = jest.fn()

            item.saveEditorItems(mockVDF)

            expect(vdf.stringify).toHaveBeenCalledWith(mockVDF)
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                item.paths.editorItems,
                "stringified vdf",
                "utf8",
            )
        })

        test("should save properties", () => {
            const mockPropertiesVDF = { Properties: { test: "data" } }
            vdf.stringify = jest.fn().mockReturnValue("stringified properties")
            fs.writeFileSync = jest.fn()

            item.saveProperties(mockPropertiesVDF)

            expect(vdf.stringify).toHaveBeenCalledWith(mockPropertiesVDF)
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                item.paths.properties,
                "stringified properties",
                "utf8",
            )
        })

        test("should check if item exists", () => {
            fs.existsSync.mockReturnValue(true)

            expect(item.exists()).toBe(true)
        })

        test("should return false when item files missing", () => {
            fs.existsSync.mockReturnValue(false)

            expect(item.exists()).toBe(false)
        })
    })

    describe("edge cases", () => {
        test("should handle item with no Version section", () => {
            const noVersionItem = {
                ID: "NO_VERSION_ITEM",
            }

            expect(() => {
                new Item({
                    packagePath: mockPackagePath,
                    itemJSON: noVersionItem,
                })
            }).toThrow("No item folder found")
        })

        test("should handle item with empty Styles section", () => {
            const emptyStylesItem = {
                ID: "EMPTY_STYLES_ITEM",
                Version: {
                    Styles: {},
                },
            }

            expect(() => {
                new Item({
                    packagePath: mockPackagePath,
                    itemJSON: emptyStylesItem,
                })
            }).toThrow("No item folder found")
        })

        test("should convert folder name to lowercase", () => {
            const upperCaseFolder = {
                ID: "UPPER_CASE_ITEM",
                Version: {
                    Styles: {
                        BEE2_CLEAN: "UPPER_CASE_FOLDER",
                    },
                },
            }

            const item = new Item({
                packagePath: mockPackagePath,
                itemJSON: upperCaseFolder,
            })

            expect(item.itemFolder).toBe("upper_case_folder")
        })
    })
})
