const fs = require("fs")
const path = require("path")
const { convertImageToVTF, getVTFPathFromImagePath, updateEditorItemsWithVTF } = require("../utils/vtfConverter")

describe("VTF Conversion", () => {
    const testPackagePath = path.join(__dirname, "testPackage")
    const testImagePath = path.join(__dirname, "test-icon.png")
    const testVTFPath = path.join(testPackagePath, "resources", "materials", "models", "props_map_editor", "beepkg", "test_icon.vtf")

    beforeAll(() => {
        // Create test directory structure
        fs.mkdirSync(path.dirname(testVTFPath), { recursive: true })
        
        // Create a simple test PNG (1x1 pixel)
        const pngBuffer = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width: 1, height: 1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth: 8, color type: 2 (RGB)
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
            0x54, 0x08, 0x99, 0x01, 0x01, 0x01, 0x00, 0x00, 
            0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 
            0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, // IEND chunk
            0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        fs.writeFileSync(testImagePath, pngBuffer)
    })

    afterAll(() => {
        // Cleanup test files
        if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath)
        if (fs.existsSync(testVTFPath)) fs.unlinkSync(testVTFPath)
        if (fs.existsSync(path.dirname(testVTFPath))) {
            fs.rmSync(path.dirname(testVTFPath), { recursive: true, force: true })
        }
    })

    test("getVTFPathFromImagePath creates correct VTF path", () => {
        const imagePath = "palette/beepkg/preplaced_gel.png"
        const expectedVTFPath = path.join(testPackagePath, "resources", "materials", "models", "props_map_editor", "beepkg", "preplaced_gel.vtf")
        
        const result = getVTFPathFromImagePath(testPackagePath, imagePath)
        
        expect(result).toBe(expectedVTFPath)
    })

    test("updateEditorItemsWithVTF updates image path correctly", () => {
        const testEditorItemsPath = path.join(__dirname, "test-editoritems.json")
        const originalImagePath = "palette/beepkg/preplaced_gel.png"
        const vtfPath = path.join(testPackagePath, "resources", "materials", "models", "props_map_editor", "beepkg", "preplaced_gel.vtf")
        
        // Create test editoritems.json
        const testEditorItems = {
            "Item": {
                "Editor": {
                    "SubType": {
                        "Name": "Test Item",
                        "Palette": {
                            "Image": originalImagePath,
                            "Tooltip": "TEST_ITEM"
                        }
                    }
                }
            }
        }
        
        fs.writeFileSync(testEditorItemsPath, JSON.stringify(testEditorItems, null, 4))
        
        try {
            const result = updateEditorItemsWithVTF(testEditorItemsPath, originalImagePath, vtfPath, testPackagePath)
            
            // Should update the Image path to reference the VTF (without extension)
            expect(result.Item.Editor.SubType.Palette.Image).toBe("models/props_map_editor/beepkg/preplaced_gel")
            
        } finally {
            // Cleanup
            if (fs.existsSync(testEditorItemsPath)) fs.unlinkSync(testEditorItemsPath)
        }
    })

    // Note: VTF conversion test is commented out as it requires the vtflib.js library to work properly
    // and may fail in CI/CD environments without proper image processing setup
    /*
    test("convertImageToVTF creates VTF file", async () => {
        await convertImageToVTF(testImagePath, testVTFPath, {
            format: 'DXT5',
            generateMipmaps: true
        })
        
        expect(fs.existsSync(testVTFPath)).toBe(true)
        
        // Basic check that the file has some content
        const vtfContent = fs.readFileSync(testVTFPath)
        expect(vtfContent.length).toBeGreaterThan(0)
    }, 10000) // 10 second timeout for image processing
    */
})