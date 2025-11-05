const {
    reg_loadPackagePopup,
    packages,
    loadPackage,
    importPackage,
    Package,
    getCurrentPackageDir,
} = require("./packageManager")
const {
    createItemEditor,
    sendItemUpdateToEditor,
    createItemCreationWindow,
    getCreateItemWindow,
    createPackageCreationWindow,
    getCreatePackageWindow,
} = require("./items/itemEditor")
const { ipcMain, dialog, BrowserWindow } = require("electron")
const fs = require("fs")
const path = require("path")
const { saveItem } = require("./saveItem") // Import the new saveItem function
const { Item } = require("./models/items") // Import the Item class
const { savePackageAsBpee } = require("./packageManager")
const {
    findPortal2Resources,
    getHammerPath,
    getHammerAvailability,
} = require("./data")
const { spawn } = require("child_process")
const { Instance } = require("./items/Instance")
const { getCleanInstancePath } = require("./utils/instancePaths")
const { getPackagesDir } = require("./utils/packagesDir")
const { vmfStatsCache } = require("./utils/vmfParser")
const {
    convertVmfToObj,
    setExtraResourcePaths,
    getExtraResourcePaths,
} = require("./utils/vmf2obj")
const pLimit = require("p-limit")

// Track last saved .bpee path in memory (could be improved with persistent storage)
let lastSavedBpeePath = null
// currentPackageDir is now managed in packageManager.js via getCurrentPackageDir()

// Helper to load original itemJSON from info.json
function loadOriginalItemJSON(packagePath, itemId) {
    // Try to find info.json in the packagePath or its parent
    let infoPath = fs.existsSync(path.join(packagePath, "info.json"))
        ? path.join(packagePath, "info.json")
        : path.join(path.dirname(packagePath), "info.json")
    if (!fs.existsSync(infoPath)) {
        throw new Error(`info.json not found for package: ${packagePath}`)
    }
    const parsedInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"))
    let rawitems = parsedInfo["Item"]
    if (!rawitems) throw new Error("Invalid package format - no items found")
    if (!Array.isArray(rawitems)) rawitems = [rawitems]
    const found = rawitems.find((el) => el.ID === itemId)
    if (!found) throw new Error(`Item with ID ${itemId} not found in info.json`)
    return found
}

// Track open preview windows to prevent duplicates
const openPreviewWindows = new Map()

function createIconPreviewWindow(iconPath, itemName, parentWindow) {
    // If a preview window is already open for this icon, focus it instead
    if (openPreviewWindows.has(iconPath)) {
        const existingWindow = openPreviewWindows.get(iconPath)
        if (!existingWindow.isDestroyed()) {
            existingWindow.focus()
            return
        }
        // Window was destroyed, remove from map
        openPreviewWindows.delete(iconPath)
    }

    const title = itemName ? `${itemName} - Icon Preview` : `Icon Preview`

    const previewWindow = new BrowserWindow({
        width: 296, // 256 + 40px padding for window chrome
        height: 336, // 256 + 80px for title bar and padding
        resizable: false,
        maximizable: false,
        minimizable: false,
        title: title,
        alwaysOnTop: true, // Keep preview on top without parent relationship
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Allow loading local files
        },
        icon: iconPath, // Set the window icon to the preview image
    })

    // Track the window
    openPreviewWindows.set(iconPath, previewWindow)

    // Clean up when window is closed
    previewWindow.on("closed", () => {
        openPreviewWindows.delete(iconPath)
    })

    // Create simple HTML to display the image
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Icon Preview</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                background: #2d2d2d;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: calc(100vh - 40px);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            img {
                width: 256px;
                height: 256px;
                object-fit: contain;
                border: 1px solid #555;
                background: #fff;
                image-rendering: pixelated;
            }
        </style>
    </head>
    <body>
        <img src="file://${iconPath.replace(/\\/g, "/")}" alt="Icon Preview" />
    </body>
    </html>
    `

    // Load the HTML content
    previewWindow.loadURL(
        `data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`,
    )

    // Remove menu bar
    previewWindow.setMenuBarVisibility(false)
}

function createModelPreviewWindow(objPath, mtlPath, title = "Model Preview") {
    // Normalize to beep URLs for secure protocol
    const toBeepUrl = (p) => {
        if (!p) return null

        try {
            // Remove any existing protocol prefixes to avoid double prefixes
            let cleanPath = p
                .replace(/^file:\/\/\//, "")
                .replace(/^file:\/\//, "")
                .replace(/^beep:\/\//, "")

            // Handle Windows drive letters consistently
            if (process.platform === "win32") {
                // Ensure proper drive letter format: C:/path/to/file
                if (cleanPath.match(/^[a-z]\//)) {
                    cleanPath =
                        cleanPath.charAt(0).toUpperCase() +
                        ":" +
                        cleanPath.slice(1)
                } else if (cleanPath.match(/^[a-z]:\//)) {
                    cleanPath =
                        cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1)
                }
            }

            // Normalize path and convert backslashes to forward slashes
            const normalized = path.normalize(cleanPath).replace(/\\/g, "/")

            // Construct beep:// URL
            return `beep://${normalized}`
        } catch (error) {
            console.error("Error creating beep URL from path:", p, error)
            return null
        }
    }
    const objUrl = toBeepUrl(objPath)
    const mtlUrl = mtlPath && fs.existsSync(mtlPath) ? toBeepUrl(mtlPath) : null

    console.log("createModelPreviewWindow paths:")
    console.log("  objPath input:", objPath)
    console.log("  mtlPath input:", mtlPath)
    console.log("  objUrl output:", objUrl)
    console.log("  mtlUrl output:", mtlUrl)

    const previewWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        resizable: true,
        maximizable: true,
        minimizable: true,
        title,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Required for loading local files
        },
    })

    const html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8" />
        <title>${title.replace(/</g, "&lt;")}</title>
        <style>
            html, body { 
                margin: 0; 
                padding: 0; 
                height: 100%; 
                overflow: hidden; 
                background: #1e1e1e; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            #info { 
                position: absolute; 
                top: 10px; 
                left: 10px; 
                color: #ddd; 
                font: 12px sans-serif; 
                z-index: 100;
                background: rgba(0,0,0,0.7);
                padding: 8px 12px;
                border-radius: 4px;
            }
            #container { 
                width: 100%; 
                height: 100%; 
            }
            #loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #ddd;
                font-size: 16px;
                z-index: 50;
            }
            #error {
                position: absolute;
                bottom: 20px;
                left: 20px;
                right: 20px;
                background: #d32f2f;
                color: white;
                padding: 12px;
                border-radius: 4px;
                display: none;
                z-index: 100;
            }
        </style>
    </head>
    <body>
        <div id="info">Loading model... Use mouse to orbit, zoom, and pan</div>
        <div id="loading">Loading 3D model...</div>
        <div id="error"></div>
        <div id="container"></div>
        
        <script type="importmap">
        {
            "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
            }
        }
        </script>
        
        <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
        import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
        import { TGALoader } from 'three/addons/loaders/TGALoader.js';

        const container = document.getElementById('container');
        const loading = document.getElementById('loading');
        const info = document.getElementById('info');
        const errorDiv = document.getElementById('error');
        
        // Scene setup
        const scene = new THREE.Scene();
        scene.fog = null; // ensure no fog is applied
        scene.background = new THREE.Color(0x1e1e1e);
        
        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50000);
        camera.position.set(2, 2, 3); // Start closer to the item
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        
        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        
        // Lighting - optimized for texture viewing
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        
        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight1.position.set(10, 10, 10);
        directionalLight1.castShadow = true;
        directionalLight1.shadow.mapSize.width = 2048;
        directionalLight1.shadow.mapSize.height = 2048;
        scene.add(directionalLight1);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight2.position.set(-10, -10, -10);
        scene.add(directionalLight2);
        
        // Add a fill light from the side
        const sideLight = new THREE.DirectionalLight(0xffffff, 0.3);
        sideLight.position.set(0, 5, -10);
        scene.add(sideLight);
        
        // Grid - infinite appearance with large size
        const grid = new THREE.GridHelper(20000, 200, 0x555555, 0x333333); // 20000 units total / 200 divisions = 100 units per cell
        grid.position.y = -64;
        scene.add(grid);
        
        // Model URLs
        const objUrl = ${JSON.stringify(objUrl)};
        const mtlUrl = ${JSON.stringify(mtlUrl)};
        
        console.log('Loading model with:');
        console.log('  OBJ URL:', objUrl);
        console.log('  MTL URL:', mtlUrl);
        
        function showError(message) {
            console.error(message);
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            loading.style.display = 'none';
        }
        
        function centerAndScale(object) {
            // Preserve Hammer units: do not rescale the object
            object.scale.setScalar(1);

            // Keep object at its EXACT OBJ coordinates - do not move it!
            // The OBJ file position is sacred and must be preserved

            // Compute bounding box at the object's actual position
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Fit camera so full model is visible without changing object position
            const maxSize = Math.max(size.x, size.y, size.z);
            if (maxSize === 0) return;

            // Compute required distance from FOV to fit the largest dimension
            const fov = camera.fov * (Math.PI / 180);
            const fitHeightDistance = (maxSize / 2) / Math.tan(fov / 2);
            const fitWidthDistance = (maxSize / 2) / Math.tan(Math.atan(Math.tan(fov / 2) * camera.aspect));
            const distance = Math.max(fitHeightDistance, fitWidthDistance);

            // Position camera to view the object at its actual location
            const nearDistance = distance * 0.85;
            const cameraOffset = new THREE.Vector3(nearDistance, nearDistance * 0.35, nearDistance);
            camera.position.copy(center).add(cameraOffset);

            // Look at the object's actual center position
            controls.target.copy(center);
            controls.update();
        }
        
        function loadModel() {
            const objLoader = new OBJLoader();
            
            // Override OBJ loader's load method to handle beep:// URLs
            const originalOBJLoad = objLoader.load.bind(objLoader);
            objLoader.load = function(url, onLoad, onProgress, onError) {
                console.log('OBJ Loader attempting to load:', url);
                
                if (url.startsWith('beep://')) {
                    fetch(url)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
                            }
                            return response.text();
                        })
                        .then(text => {
                            console.log('OBJ: Fetched text content from beep://', url);
                            // Parse the OBJ text directly
                            try {
                                const object = objLoader.parse(text);
                                console.log('OBJ parsed successfully from beep://', url);
                                if (onLoad) onLoad(object);
                            } catch (parseError) {
                                console.error('OBJ parsing failed:', parseError);
                                if (onError) onError(parseError);
                            }
                        })
                        .catch(error => {
                            console.error('Failed to fetch OBJ from beep://', url, error);
                            if (onError) onError(error);
                        });
                } else {
                    // Use original loader for non-beep URLs
                    return originalOBJLoad(url, onLoad, onProgress, onError);
                }
            };
            
            const onLoad = (object) => {
                loading.style.display = 'none';
                info.textContent = 'Model loaded! Left-drag: orbit • Right-drag: pan • Wheel: zoom';
                
                // Apply materials and setup rendering
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // If no material loaded, use a textured-looking default
                        if (!child.material) {
                            child.material = new THREE.MeshStandardMaterial({ 
                                color: 0xcccccc,
                                roughness: 0.7,
                                metalness: 0.1,
                                side: THREE.DoubleSide 
                            });
                        } else {
                            // Ensure materials are double-sided for complex geometry
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => {
                                    mat.side = THREE.DoubleSide;
                                    // Enable texture filtering for better quality
                                    if (mat.map) {
                                        mat.map.generateMipmaps = true;
                                        mat.map.minFilter = THREE.LinearMipmapLinearFilter;
                                        mat.map.magFilter = THREE.LinearFilter;
                                    }
                                });
                            } else {
                                child.material.side = THREE.DoubleSide;
                                if (child.material.map) {
                                    child.material.map.generateMipmaps = true;
                                    child.material.map.minFilter = THREE.LinearMipmapLinearFilter;
                                    child.material.map.magFilter = THREE.LinearFilter;
                                }
                            }
                        }
                        
                        console.log('Mesh:', child.name, 'Material:', child.material);
                    }
                });
                
                // Model is already rotated in the OBJ file from VMF2OBJ conversion
                // Just position at world origin
                object.position.set(0, 0, 0);
                
                centerAndScale(object);
                scene.add(object);
            };
            
            const onError = (error) => {
                showError('Failed to load OBJ model: ' + error.message);
            };
            
            if (mtlUrl) {
                // Load MTL first, then OBJ
                const mtlLoader = new MTLLoader();
                
                // Override MTL loader's load method to handle beep:// URLs
                const originalMTLLoad = mtlLoader.load.bind(mtlLoader);
                mtlLoader.load = function(url, onLoad, onProgress, onError) {
                    console.log('MTL Loader attempting to load:', url);
                    
                    if (url.startsWith('beep://')) {
                        fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
                                }
                                return response.text();
                            })
                            .then(text => {
                                console.log('MTL: Fetched text content from beep://', url);
                                // Parse the MTL text directly
                                try {
                                    const materials = mtlLoader.parse(text, '');
                                    console.log('MTL parsed successfully from beep://', url);
                                    if (onLoad) onLoad(materials);
                                } catch (parseError) {
                                    console.error('MTL parsing failed:', parseError);
                                    if (onError) onError(parseError);
                                }
                            })
                            .catch(error => {
                                console.error('Failed to fetch MTL from beep://', url, error);
                                if (onError) onError(error);
                            });
                    } else {
                        // Use original loader for non-beep URLs
                        return originalMTLLoad(url, onLoad, onProgress, onError);
                    }
                };
                
                // Set up LoadingManager to properly handle texture timing
                const loadingManager = new THREE.LoadingManager();
                
                // Set up TGA loader for Source engine textures
                const tgaLoader = new TGALoader();
                
                // Override the TGA loader's load method to handle beep:// URLs
                const originalTGALoad = tgaLoader.load.bind(tgaLoader);
                tgaLoader.load = function(url, onLoad, onProgress, onError) {
                    console.log('TGA Loader attempting to load:', url);
                    
                    // If it's a beep:// URL, fetch it directly and then load the blob
                    if (url.startsWith('beep://')) {
                        // Create a placeholder texture with valid default data
                        const canvas = document.createElement('canvas');
                        canvas.width = 1;
                        canvas.height = 1;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#808080'; // Gray placeholder
                        ctx.fillRect(0, 0, 1, 1);
                        
                        const texture = new THREE.Texture(canvas);
                        texture.name = url;
                        texture.needsUpdate = true;
                        
                        fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
                                }
                                return response.blob();
                            })
                            .then(blob => {
                                const objectUrl = URL.createObjectURL(blob);
                                console.log('TGA: Created object URL for beep:// resource:', objectUrl);
                                
                                // Use the original loader with the object URL
                                originalTGALoad(objectUrl, (loadedTexture) => {
                                    console.log('TGA texture loaded successfully from beep://', url);
                                    // Copy loaded texture properties to our placeholder
                                    texture.image = loadedTexture.image;
                                    texture.format = loadedTexture.format;
                                    texture.type = loadedTexture.type;
                                    texture.generateMipmaps = loadedTexture.generateMipmaps;
                                    texture.flipY = loadedTexture.flipY;
                                    texture.needsUpdate = true;
                                    
                                    // Clean up the object URL after loading
                                    URL.revokeObjectURL(objectUrl);
                                    if (onLoad) onLoad(texture);
                                }, onProgress, (error) => {
                                    console.error('TGA loading failed:', error);
                                    URL.revokeObjectURL(objectUrl);
                                    if (onError) onError(error);
                                });
                            })
                            .catch(error => {
                                console.error('Failed to fetch TGA from beep://', url, error);
                                if (onError) onError(error);
                            });
                        
                        return texture;
                    } else {
                        // Use original loader for non-beep URLs
                        return originalTGALoad(url, onLoad, onProgress, onError);
                    }
                };
                
                // Configure MTL loader to handle TGA files and beep:// URLs
                // Note: After TGA to PNG conversion, most textures will be PNG files
                const originalLoad = THREE.TextureLoader.prototype.load;
                THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
                    if (url.toLowerCase().endsWith('.tga')) {
                        console.log('Loading TGA texture:', url);
                        return tgaLoader.load(url, onLoad, onProgress, onError);
                    } else if (url.startsWith('beep://')) {
                        console.log('Loading regular texture from beep://', url);
                        
                        // Create a placeholder texture with valid default data
                        const canvas = document.createElement('canvas');
                        canvas.width = 1;
                        canvas.height = 1;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#808080'; // Gray placeholder
                        ctx.fillRect(0, 0, 1, 1);
                        
                        const texture = new THREE.Texture(canvas);
                        texture.name = url;
                        texture.needsUpdate = true;
                        
                        // For regular image formats, fetch as blob and create object URL
                        fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
                                }
                                return response.blob();
                            })
                            .then(blob => {
                                const objectUrl = URL.createObjectURL(blob);
                                console.log('Created object URL for beep:// texture:', objectUrl);
                                
                                // Use the original loader with the object URL
                                originalLoad.call(this, objectUrl, (loadedTexture) => {
                                    console.log('Texture loaded successfully from beep://', url);
                                    // Copy loaded texture properties to our placeholder
                                    texture.image = loadedTexture.image;
                                    texture.format = loadedTexture.format;
                                    texture.type = loadedTexture.type;
                                    texture.generateMipmaps = loadedTexture.generateMipmaps;
                                    texture.flipY = loadedTexture.flipY;
                                    texture.needsUpdate = true;
                                    
                                    // Clean up the object URL after loading
                                    URL.revokeObjectURL(objectUrl);
                                    if (onLoad) onLoad(texture);
                                }, onProgress, (error) => {
                                    console.error('Texture loading failed:', error);
                                    URL.revokeObjectURL(objectUrl);
                                    if (onError) onError(error);
                                });
                            })
                            .catch(error => {
                                console.error('Failed to fetch texture from beep://', url, error);
                                if (onError) onError(error);
                            });
                        
                        return texture;
                    } else {
                        return originalLoad.call(this, url, onLoad, onProgress, onError);
                    }
                };
                
                // Configure LoadingManager callbacks for proper timing
                loadingManager.onLoad = () => {
                    console.log('LoadingManager: All textures and materials fully loaded!');
                    info.textContent = 'Model loaded with textures! Left-drag: orbit • Right-drag: pan • Wheel: zoom';
                };
                
                loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
                    console.log('Loading progress: ' + itemsLoaded + '/' + itemsTotal + ' - ' + url);
                    info.textContent = 'Loading textures... ' + itemsLoaded + '/' + itemsTotal;
                };
                
                loadingManager.onError = (url) => {
                    console.error('LoadingManager error loading:', url);
                };
                
                // Set the resource path for textures - VMF2OBJ puts materials in /materials subfolder
                // But the MTL file references them as "materials/models/..." so we need the base directory
                const baseDir = mtlUrl.substring(0, mtlUrl.lastIndexOf('/') + 1);
                
                console.log('Setting MTL resource paths:');
                console.log('  MTL URL:', mtlUrl);
                console.log('  Base directory:', baseDir);
                
                // Set resource path to base directory so "materials/..." paths in MTL work correctly
                mtlLoader.setResourcePath(baseDir);
                mtlLoader.setPath('');
                
                // CRITICAL: Set the LoadingManager on the MTL loader
                mtlLoader.manager = loadingManager;
                
                mtlLoader.load(
                    mtlUrl,
                    (materials) => {
                        console.log('MTL loaded successfully:', materials);
                        materials.preload();
                        
                        // Debug: log material info
                        Object.keys(materials.materials).forEach(key => {
                            const mat = materials.materials[key];
                            console.log('Material:', key, mat);
                            if (mat.map) console.log('  - Diffuse texture:', mat.map.image?.src);
                            if (mat.normalMap) console.log('  - Normal texture:', mat.normalMap.image?.src);
                        });
                        
                        objLoader.setMaterials(materials);
                        objLoader.load(objUrl, onLoad, undefined, onError);
                    },
                    (progress) => {
                        console.log('MTL loading progress:', progress);
                    },
                    (error) => {
                        console.warn('Failed to load MTL, loading OBJ without materials:', error);
                        objLoader.load(objUrl, onLoad, undefined, onError);
                    }
                );
            } else {
                objLoader.load(objUrl, onLoad, undefined, onError);
            }
        }
        
        // Start loading
        loadModel();
        
        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        });
        </script>
    </body>
    </html>`

    previewWindow.loadURL(
        `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`,
    )
    previewWindow.setMenuBarVisibility(false)
}

async function handleItemSave(item, event, mainWindow) {
    try {
        // Validate input
        if (!item?.fullItemPath) {
            throw new Error("Invalid item path")
        }
        if (!item?.name?.trim()) {
            throw new Error("Item name cannot be empty")
        }

        // Use the new saveItem function to handle file operations
        const { editorItems, properties } = await saveItem(item)

        // Find the current item instance in memory to get the most up-to-date data
        const packagePath =
            item.packagePath || path.dirname(path.dirname(item.fullItemPath))

        // Try to find the existing item instance first
        let updatedItemInstance = packages
            .flatMap((p) => p.items)
            .find((i) => i.id === item.id)

        if (updatedItemInstance) {
            // Reload the item's data from disk to get the latest changes
            updatedItemInstance.reloadItemData()

            // Update the icon path if it was changed during save
            if (item.iconData && item.iconData.stagedIconPath) {
                const bee2ItemsPath = path.join(
                    packagePath,
                    "resources",
                    "BEE2",
                    "items",
                )
                const relativePath = path.relative(
                    bee2ItemsPath,
                    item.iconData.stagedIconPath,
                )
                updatedItemInstance.icon = item.iconData.stagedIconPath
            }
        } else {
            // Fallback: reconstruct from disk if not found in memory
            let itemJSON
            try {
                itemJSON = loadOriginalItemJSON(packagePath, item.id)
            } catch (e) {
                // fallback to minimal itemJSON if info.json is missing or item not found
                const itemFolder =
                    item.itemFolder || path.basename(item.fullItemPath)
                itemJSON = {
                    ID: item.id,
                    Version: { Styles: { BEE2_CLEAN: itemFolder } },
                }
            }
            updatedItemInstance = new Item({ packagePath, itemJSON })
        }

        const updatedItem = updatedItemInstance.toJSONWithExistence()

        // Debug logging
        console.log("Item save completed, sending update:")
        console.log("- Item ID:", updatedItem.id)
        console.log("- Item name:", updatedItem.name)
        console.log("- Icon path:", updatedItem.icon)
        console.log("- Icon data was provided:", !!item.iconData)

        // Send the updated item data to both windows
        event.sender.send("item-updated", updatedItem) // Send to editor window
        mainWindow.webContents.send("item-updated", updatedItem) // Send to main window

        // Clear unsaved changes indicator
        if (global.titleManager) {
            global.titleManager.setUnsavedChanges(false)
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to save item:", error)
        dialog.showErrorBox(
            "Save Failed",
            `Failed to save item: ${error.message}\n\nPlease check the file permissions and try again.`,
        )
        throw error
    }
}

function reg_events(mainWindow) {
    // Register package loading
    reg_loadPackagePopup()

    // Register item editor opening
    ipcMain.handle("open-item-editor", async (event, item) => {
        // Find the actual Item instance from the packages
        const actualItem = packages
            .flatMap((p) => p.items)
            .find((i) => i.id === item.id)
        if (!actualItem) {
            throw new Error(`Item not found: ${item.id}`)
        }
        createItemEditor(actualItem, mainWindow)
    })

    // Register create item window opening
    ipcMain.handle("open-create-item-window", async () => {
        createItemCreationWindow(mainWindow)
        return { success: true }
    })

    // Register generic file dialog handler
    ipcMain.handle("show-open-dialog", async (event, options) => {
        return await dialog.showOpenDialog(options)
    })

    // Register item saving
    ipcMain.handle("save-item", async (event, itemData) => {
        return handleItemSave(itemData, event, mainWindow)
    })

    // Register item creation
    ipcMain.handle(
        "create-item",
        async (
            event,
            { name, description, iconPath, instancePaths, author },
        ) => {
            try {
                // Validate required fields
                if (!name || !name.trim()) {
                    throw new Error("Item name is required")
                }
                if (!author || !author.trim()) {
                    throw new Error("Author name is required")
                }
                if (!instancePaths || instancePaths.length === 0) {
                    throw new Error("At least one instance is required")
                }

                // Get current package
                if (packages.length === 0) {
                    throw new Error("No package currently loaded")
                }
                const currentPackage = packages[0]

                // Generate item ID: bpee_item_author_{UUID}
                const cleanName = name
                    .replace(/[^a-zA-Z0-9]/g, "_")
                    .toLowerCase()
                const cleanAuthor = author
                    .replace(/[^a-zA-Z0-9]/g, "_")
                    .toLowerCase()

                // Generate a 4-character UUID
                const generateShortUuid = () => {
                    return Math.random()
                        .toString(36)
                        .substring(2, 6)
                        .toUpperCase()
                }

                let itemId = `bpee_${cleanName}_${cleanAuthor}_${generateShortUuid()}`

                // Ensure uniqueness - regenerate if collision occurs (extremely unlikely)
                while (
                    currentPackage.items.find((item) => item.id === itemId)
                ) {
                    itemId = `bpee_${cleanName}_${cleanAuthor}_${generateShortUuid()}`
                }

                // Create item folder structure
                const itemFolderName = `${cleanName.toLowerCase()}_${cleanAuthor.toLowerCase()}`
                const fullItemPath = path.join(
                    currentPackage.packageDir,
                    "items",
                    itemFolderName,
                )

                if (fs.existsSync(fullItemPath)) {
                    throw new Error(
                        `Item folder already exists: ${itemFolderName}`,
                    )
                }

                fs.mkdirSync(fullItemPath, { recursive: true })

                // Generate a safe item type ID
                const itemType =
                    `BPEE_${cleanName}_${cleanAuthor}`.toUpperCase()

                // Create editoritems.json
                const editoritems = {
                    Item: {
                        ItemClass: "ItemBase",
                        Type: itemType,
                        Editor: {
                            MovementHandle: "HANDLE_4_DIRECTIONS",
                            InvalidSurface: "",
                            DesiredFacing: "DESIRES_ANYTHING",
                            CanAnchorOnGoo: "0",
                            CanAnchorOnBarriers: "0",
                        },
                        Properties: {
                            ConnectionCount: {
                                DefaultValue: "0",
                                Index: "1",
                            },
                        },
                        Exporting: {
                            Inputs: {},
                            Outputs: {},
                            Instances: {},
                            TargetName: "item",
                            Offset: "64 64 64",
                        },
                    },
                }

                // Create SubType - always single SubType at creation
                editoritems.Item.Editor.SubType = {
                    Name: name,
                    Model: {
                        ModelName: "turret.3ds",
                    },
                    Palette: {
                        Tooltip: name.toUpperCase(),
                        Image: iconPath
                            ? "palette/bpee/item/item"
                            : "BEE2/blank.png",
                        Position: "0 0 0",
                    },
                    Sounds: {
                        SOUND_CREATED: "P2Editor.PlaceOther",
                        SOUND_EDITING_ACTIVATE: "P2Editor.ExpandOther",
                        SOUND_EDITING_DEACTIVATE: "P2Editor.CollapseOther",
                        SOUND_DELETED: "P2Editor.RemoveOther",
                    },
                    Animations: {
                        ANIM_IDLE: "0",
                        ANIM_EDITING_ACTIVATE: "1",
                        ANIM_EDITING_DEACTIVATE: "2",
                    },
                }

                // Add instances to editoritems
                instancePaths.forEach((instancePath, index) => {
                    // Use new path structure: instances/BEE2/bpee/itemId/instance.vmf (or instance_N.vmf for multiple)
                    const instanceFileName =
                        index === 0 ? "instance.vmf" : `instance_${index}.vmf`
                    const relativeInstancePath = `instances/BEE2/bpee/${itemId}/${instanceFileName}`

                    editoritems.Item.Exporting.Instances[index.toString()] = {
                        Name: relativeInstancePath,
                        EntityCount: "0",
                        BrushCount: "0",
                        BrushSideCount: "0",
                    }
                })

                // Don't write editoritems yet - we need to calculate VMF stats first

                // Create properties.json
                const properties = {
                    Properties: {
                        Authors: author,
                    },
                }

                // Format description as VDF-style with empty keys for each line
                if (description && description.trim()) {
                    const descriptionLines = description.split("\n")
                    properties.Properties.Description = {}
                    descriptionLines.forEach((line, index) => {
                        // Use desc_ prefix for keys that should be converted to empty strings in VDF
                        properties.Properties.Description[`desc_${index}`] =
                            line.trim()
                    })
                }

                // Copy icon if provided and set path
                if (iconPath && fs.existsSync(iconPath)) {
                    const iconFileName = path.basename(iconPath)

                    // Copy to BEE2/items/bpee for properties.json
                    const iconDestPath = path.join(
                        currentPackage.packageDir,
                        "resources/BEE2/items/bpee",
                        iconFileName,
                    )
                    fs.mkdirSync(path.dirname(iconDestPath), {
                        recursive: true,
                    })
                    fs.copyFileSync(iconPath, iconDestPath)

                    // Convert icon to VTF at standard location
                    const {
                        convertImageToVTF,
                    } = require("./utils/vtfConverter")
                    const vtfPath = path.join(
                        currentPackage.packageDir,
                        "resources/materials/models/props_map_editor/palette/bpee/item",
                        "item.vtf",
                    )
                    try {
                        await convertImageToVTF(iconPath, vtfPath, {
                            format: "DXT5",
                            generateMipmaps: true,
                        })
                        console.log(`Created VTF icon at: ${vtfPath}`)
                    } catch (error) {
                        console.error(
                            "Failed to convert icon to VTF during item creation:",
                            error,
                        )
                        // Don't throw - let item creation continue
                    }

                    // Set icon path relative to resources/BEE2/items/
                    properties.Properties.Icon = {
                        0: `bpee/${iconFileName}`,
                    }
                }

                const propertiesPath = path.join(
                    fullItemPath,
                    "properties.json",
                )
                fs.writeFileSync(
                    propertiesPath,
                    JSON.stringify(properties, null, 4),
                )

                // Copy instance files to the package and calculate VMF stats
                const instancesDir = path.join(
                    currentPackage.packageDir,
                    "resources/instances/bpee",
                    itemId,
                )
                fs.mkdirSync(instancesDir, { recursive: true })

                instancePaths.forEach((instancePath, index) => {
                    if (fs.existsSync(instancePath)) {
                        const instanceFileName =
                            index === 0
                                ? "instance.vmf"
                                : `instance_${index}.vmf`
                        const instanceDestPath = path.join(
                            instancesDir,
                            instanceFileName,
                        )
                        fs.copyFileSync(instancePath, instanceDestPath)

                        // Calculate VMF stats for the copied instance
                        try {
                            const vmfStats =
                                vmfStatsCache.getStats(instanceDestPath)
                            editoritems.Item.Exporting.Instances[
                                index.toString()
                            ] = {
                                ...editoritems.Item.Exporting.Instances[
                                    index.toString()
                                ],
                                EntityCount: vmfStats.EntityCount.toString(),
                                BrushCount: vmfStats.BrushCount.toString(),
                                BrushSideCount:
                                    vmfStats.BrushSideCount.toString(),
                            }
                            console.log(
                                `Calculated VMF stats for ${instanceFileName}:`,
                                vmfStats,
                            )
                        } catch (error) {
                            console.warn(
                                `Could not calculate VMF stats for ${instanceFileName}:`,
                                error.message,
                            )
                        }
                    }
                })

                // Now write editoritems.json with updated VMF stats
                const editorItemsPath = path.join(
                    fullItemPath,
                    "editoritems.json",
                )
                fs.writeFileSync(
                    editorItemsPath,
                    JSON.stringify(editoritems, null, 4),
                )

                // Add item to info.json
                const infoPath = path.join(
                    currentPackage.packageDir,
                    "info.json",
                )
                let info = {}
                if (fs.existsSync(infoPath)) {
                    info = JSON.parse(fs.readFileSync(infoPath, "utf-8"))
                }

                // Initialize structure if needed
                if (!info.Item) {
                    info.Item = []
                } else if (!Array.isArray(info.Item)) {
                    info.Item = [info.Item]
                }

                // Add new item to info.json
                const newItemInfo = {
                    ID: itemId,
                    Version: {
                        Styles: {
                            BEE2_CLEAN: {
                                Folder: itemFolderName,
                            },
                        },
                    },
                }

                info.Item.push(newItemInfo)
                fs.writeFileSync(infoPath, JSON.stringify(info, null, 4))

                // Create the Item instance
                const newItem = new Item({
                    packagePath: currentPackage.packageDir,
                    itemJSON: newItemInfo,
                })

                // Add to package
                currentPackage.items.push(newItem)

                // Send updates to frontend (main window)
                const updatedItems = currentPackage.items.map((item) =>
                    item.toJSONWithExistence(),
                )
                mainWindow.webContents.send("package:loaded", updatedItems)

                // Close the create item window if it's open
                const createWindow = getCreateItemWindow()
                if (createWindow && !createWindow.isDestroyed()) {
                    createWindow.close()
                }

                console.log(`Created new item: ${itemId}`)
                return {
                    success: true,
                    itemId,
                    item: newItem.toJSONWithExistence(),
                }
            } catch (error) {
                console.error("Failed to create item:", error)
                throw error
            }
        },
    )

    // Register simplified item creation (only requires itemId)
    ipcMain.handle("create-item-simple", async (event, { itemId }) => {
        try {
            // Validate required fields
            if (!itemId || !itemId.trim()) {
                throw new Error("Item ID is required")
            }

            // Get current package
            if (packages.length === 0) {
                throw new Error("No package currently loaded")
            }
            const currentPackage = packages[0]

            // Clean and validate item ID
            const cleanItemId = itemId.trim().toLowerCase()

            // Check if item ID already exists
            if (currentPackage.items.find((item) => item.id === cleanItemId)) {
                throw new Error(`Item with ID '${cleanItemId}' already exists`)
            }

            // Create item folder structure
            const itemFolderName = cleanItemId
            const fullItemPath = path.join(
                currentPackage.packageDir,
                "items",
                itemFolderName,
            )

            if (fs.existsSync(fullItemPath)) {
                throw new Error(`Item folder already exists: ${itemFolderName}`)
            }

            fs.mkdirSync(fullItemPath, { recursive: true })

            // Generate a safe item type ID
            const itemType = `BPEE_${cleanItemId.toUpperCase()}`

            // Create editoritems.json with minimal configuration
            const editoritems = {
                Item: {
                    ItemClass: "ItemBase",
                    Type: itemType,
                    Editor: {
                        MovementHandle: "HANDLE_4_DIRECTIONS",
                        InvalidSurface: "",
                        DesiredFacing: "DESIRES_ANYTHING",
                        CanAnchorOnGoo: "0",
                        CanAnchorOnBarriers: "0",
                    },
                    Properties: {
                        ConnectionCount: {
                            DefaultValue: "0",
                            Index: "1",
                        },
                    },
                    Exporting: {
                        Inputs: {},
                        Outputs: {},
                        Instances: {},
                        TargetName: "item",
                        Offset: "64 64 64",
                    },
                },
            }

            // Create SubType with default values
            editoritems.Item.Editor.SubType = {
                Name: cleanItemId,
                Model: {
                    ModelName: "turret.3ds",
                },
                Palette: {
                    Tooltip: cleanItemId.toUpperCase(),
                    Image: "BEE2/blank.png",
                    Position: "0 0 0",
                },
                Sounds: {
                    SOUND_CREATED: "P2Editor.PlaceOther",
                    SOUND_EDITING_ACTIVATE: "P2Editor.ExpandOther",
                    SOUND_EDITING_DEACTIVATE: "P2Editor.CollapseOther",
                    SOUND_DELETED: "P2Editor.RemoveOther",
                },
                Animations: {
                    ANIM_IDLE: "0",
                    ANIM_EDITING_ACTIVATE: "1",
                    ANIM_EDITING_DEACTIVATE: "2",
                },
            }

            // Create properties.json with minimal configuration
            const properties = {
                Properties: {
                    Authors: "Unknown",
                },
            }

            const propertiesPath = path.join(fullItemPath, "properties.json")
            fs.writeFileSync(
                propertiesPath,
                JSON.stringify(properties, null, 4),
            )

            // Write editoritems.json
            const editorItemsPath = path.join(fullItemPath, "editoritems.json")
            fs.writeFileSync(
                editorItemsPath,
                JSON.stringify(editoritems, null, 4),
            )

            // Add item to info.json
            const infoPath = path.join(currentPackage.packageDir, "info.json")
            let info = {}
            if (fs.existsSync(infoPath)) {
                info = JSON.parse(fs.readFileSync(infoPath, "utf-8"))
            }

            // Initialize structure if needed
            if (!info.Item) {
                info.Item = []
            } else if (!Array.isArray(info.Item)) {
                info.Item = [info.Item]
            }

            // Add new item to info.json
            const newItemInfo = {
                ID: cleanItemId,
                Version: {
                    Styles: {
                        BEE2_CLEAN: {
                            Folder: itemFolderName,
                        },
                    },
                },
            }

            info.Item.push(newItemInfo)
            fs.writeFileSync(infoPath, JSON.stringify(info, null, 4))

            // Create the Item instance
            const newItem = new Item({
                packagePath: currentPackage.packageDir,
                itemJSON: newItemInfo,
            })

            // Add to package
            currentPackage.items.push(newItem)

            // Send updates to frontend (main window)
            const updatedItems = currentPackage.items.map((item) =>
                item.toJSONWithExistence(),
            )
            mainWindow.webContents.send("package:loaded", updatedItems)

            // Close the create item window if it's open
            const createWindow = getCreateItemWindow()
            if (createWindow && !createWindow.isDestroyed()) {
                createWindow.close()
            }

            console.log(`Created new item: ${cleanItemId}`)
            return {
                success: true,
                itemId: cleanItemId,
                item: newItem.toJSONWithExistence(),
            }
        } catch (error) {
            console.error("Failed to create item:", error)
            throw error
        }
    })

    // Register item deletion
    ipcMain.handle("delete-item", async (event, { itemId }) => {
        try {
            // Find the package that contains this item
            const pkg = packages.find((p) =>
                p.items.some((i) => i.id === itemId),
            )
            if (!pkg) {
                throw new Error("Package containing item not found")
            }

            // Find the item
            const item = pkg.items.find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            console.log(`Deleting item: ${item.name} (${itemId})`)

            // Get the item folder path
            const itemFolderPath = path.dirname(item.paths.editorItems)

            // Delete the item folder and all its contents
            if (fs.existsSync(itemFolderPath)) {
                fs.rmSync(itemFolderPath, { recursive: true, force: true })
                console.log(`Deleted item folder: ${itemFolderPath}`)
            }

            // Delete instance files directory (resources/instances/bpee/{itemId}/)
            const instancesDir = path.join(
                pkg.packageDir,
                "resources/instances/bpee",
                itemId,
            )
            if (fs.existsSync(instancesDir)) {
                fs.rmSync(instancesDir, { recursive: true, force: true })
                console.log(`Deleted instances directory: ${instancesDir}`)
            }

            // Delete icon files if they exist
            if (item.icon) {
                // Delete from BEE2/items/
                if (fs.existsSync(item.icon)) {
                    fs.unlinkSync(item.icon)
                    console.log(`Deleted icon: ${item.icon}`)
                }

                // Delete from palette/bpee/ if it exists
                const paletteIcon = item.icon.replace(
                    /BEE2[\\\/]items/,
                    "palette",
                )
                if (fs.existsSync(paletteIcon)) {
                    fs.unlinkSync(paletteIcon)
                    console.log(`Deleted palette icon: ${paletteIcon}`)
                }
            }

            // Remove from package info.json
            const infoPath = path.join(pkg.packageDir, "info.json")
            if (fs.existsSync(infoPath)) {
                const info = JSON.parse(fs.readFileSync(infoPath, "utf-8"))
                if (info.Item) {
                    // info.Item is an array - filter out the deleted item
                    if (Array.isArray(info.Item)) {
                        info.Item = info.Item.filter(
                            (item) => item.ID !== itemId,
                        )
                    } else {
                        // Single item - remove if it matches
                        if (info.Item.ID === itemId) {
                            delete info.Item
                        }
                    }
                    fs.writeFileSync(
                        infoPath,
                        JSON.stringify(info, null, 4),
                        "utf-8",
                    )
                    console.log(`Removed item from info.json`)
                }
            }

            // Remove from in-memory package
            pkg.removeItem(itemId)

            // Send updated package to frontend
            const updatedItems = pkg.items.map((item) =>
                item.toJSONWithExistence(),
            )
            mainWindow.webContents.send("package:loaded", updatedItems)

            console.log(`Successfully deleted item: ${item.name}`)
            return { success: true }
        } catch (error) {
            console.error("Failed to delete item:", error)
            dialog.showErrorBox(
                "Failed to Delete Item",
                `Could not delete item: ${error.message}`,
            )
            return { success: false, error: error.message }
        }
    })

    // Register unsaved changes tracking
    ipcMain.handle("set-unsaved-changes", async (event, hasChanges) => {
        if (global.titleManager) {
            global.titleManager.setUnsavedChanges(hasChanges)
        }
        return { success: true }
    })

    // Register package reload handler
    ipcMain.handle("reload-package", async (event) => {
        try {
            console.log("Reloading current package...")

            // Get the current package path from the first loaded package
            if (packages.length === 0) {
                throw new Error("No package currently loaded")
            }

            const currentPackage = packages[0]
            const packagePath = currentPackage.packageDir

            console.log("Reloading package at:", packagePath)

            // Clear current packages
            packages.length = 0

            // Reload the package
            const reloadedPackage = await loadPackage(packagePath)
            packages.push(reloadedPackage)

            // Send updated items to main window
            const updatedItems = reloadedPackage.items.map((item) =>
                item.toJSONWithExistence(),
            )
            mainWindow.webContents.send("package-loaded", updatedItems)

            console.log("Package reloaded successfully")
            return { success: true, itemCount: updatedItems.length }
        } catch (error) {
            console.error("Failed to reload package:", error)
            throw error
        }
    })

    // Register get current items handler
    ipcMain.handle("get-current-items", async () => {
        try {
            if (packages.length === 0) {
                return []
            }
            const currentPackage = packages[0]
            return currentPackage.items.map((item) =>
                item.toJSONWithExistence(),
            )
        } catch (error) {
            console.error("Failed to get current items:", error)
            return []
        }
    })

    // Register create package window opener
    // Check if a package is currently loaded
    ipcMain.handle("check-package-loaded", async () => {
        const currentPackageDir = getCurrentPackageDir()
        return !!currentPackageDir
    })

    // Confirm and close current package for new package creation
    ipcMain.handle("confirm-close-for-new-package", async () => {
        try {
            const currentPackageDir = getCurrentPackageDir()
            if (!currentPackageDir) {
                return true // No package loaded, proceed
            }

            // No need to do the save or not because to be at menu screen, you must not have a active package.

            const { closePackage } = require("./packageManager")
            await closePackage()
            lastSavedBpeePath = null
            mainWindow.webContents.send("package:closed")
            return true
        } catch (error) {
            console.error("Failed to close package:", error)
            dialog.showErrorBox(
                "Close Failed",
                `Failed to close package: ${error.message}`,
            )
            return false
        }
    })

    ipcMain.handle("open-create-package-window", async () => {
        try {
            createPackageCreationWindow(mainWindow)
            return { success: true }
        } catch (error) {
            console.error("Failed to open create package window:", error)
            throw error
        }
    })

    // Register package creation handler
    ipcMain.handle("create-package", async (event, { name, description }) => {
        try {
            console.log(`Creating new package: ${name}`)

            // Validate inputs
            if (!name || !name.trim()) {
                throw new Error("Package name is required")
            }

            // Generate package ID: PACKAGENAME_UUID (4 chars)
            const cleanName = name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()
            const generateShortUuid = () => {
                return Math.random().toString(36).substring(2, 6).toUpperCase()
            }
            const packageId = `${cleanName}_${generateShortUuid()}`

            // Packages directory should already be initialized at app startup
            const packagesDir = getPackagesDir()

            // Create package directory
            const packageDir = path.join(packagesDir, packageId)
            
            if (fs.existsSync(packageDir)) {
                const stat = fs.statSync(packageDir)
                if (stat.isDirectory()) {
                    throw new Error(
                        `Package directory already exists: ${packageId}`,
                    )
                }
                // If it's a file instead of directory, remove it
                fs.unlinkSync(packageDir)
            }

            fs.mkdirSync(packageDir, { recursive: true })

            // Create items folder
            const itemsDir = path.join(packageDir, "items")
            fs.mkdirSync(itemsDir, { recursive: true })

            // Create info.json
            const info = {
                ID: packageId,
                Name: name.trim(),
                Desc: description.trim() || "",
                Item: [],
            }
            fs.writeFileSync(
                path.join(packageDir, "info.json"),
                JSON.stringify(info, null, 4),
            )

            console.log(`Package created successfully: ${packageId}`)

            // Load the new package (this will set currentPackageDir in packageManager.js)
            const pkg = await loadPackage(path.join(packageDir, "info.json"))

            // Send package loaded event to main window
            mainWindow.webContents.send(
                "package:loaded",
                pkg.items.map((item) => item.toJSONWithExistence()),
            )

            // Close the create package window
            const createWindow = getCreatePackageWindow()
            if (createWindow && !createWindow.isDestroyed()) {
                createWindow.close()
            }

            return { success: true, packageId, packageDir }
        } catch (error) {
            console.error("Failed to create package:", error)
            throw error
        }
    })

    // Register get package info handler
    ipcMain.handle("get-package-info", async () => {
        try {
            const currentPackageDir = getCurrentPackageDir()
            if (!currentPackageDir) {
                return {
                    success: false,
                    error: "No package is currently loaded",
                }
            }

            const infoPath = path.join(currentPackageDir, "info.json")
            if (!fs.existsSync(infoPath)) {
                return {
                    success: false,
                    error: "Package info.json not found",
                }
            }

            const info = JSON.parse(fs.readFileSync(infoPath, "utf-8"))
            return { success: true, info }
        } catch (error) {
            console.error("Failed to get package info:", error)
            return {
                success: false,
                error: error.message || "Failed to load package information",
            }
        }
    })

    // Register update package info handler
    ipcMain.handle(
        "update-package-info",
        async (event, { name, description }) => {
            try {
                const currentPackageDir = getCurrentPackageDir()
                if (!currentPackageDir) {
                    return {
                        success: false,
                        error: "No package is currently loaded",
                    }
                }

                // Validate inputs
                if (!name || !name.trim()) {
                    return {
                        success: false,
                        error: "Package name is required",
                    }
                }

                const infoPath = path.join(currentPackageDir, "info.json")
                if (!fs.existsSync(infoPath)) {
                    return {
                        success: false,
                        error: "Package info.json not found",
                    }
                }

                // Read existing info
                const info = JSON.parse(fs.readFileSync(infoPath, "utf-8"))

                // Update name and description (preserve ID and other fields)
                info.Name = name.trim()
                info.Desc = description.trim() || ""

                // Write back to file
                fs.writeFileSync(infoPath, JSON.stringify(info, null, 4))

                console.log(`Package info updated: ${info.Name}`)
                return { success: true }
            } catch (error) {
                console.error("Failed to update package info:", error)
                return {
                    success: false,
                    error:
                        error.message || "Failed to update package information",
                }
            }
        },
    )

    // Register package import dialog handler
    ipcMain.handle("import-package-dialog", async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            filters: [
                {
                    name: "BEEmod Package",
                    extensions: ["bee_pack", "zip"],
                },
            ],
        })

        if (result.canceled) return { success: false, canceled: true }

        try {
            // The importPackage function extracts the archive and returns the extracted info
            // It extracts to packages/<packagename>/ based on the archive's info.json content
            const originalFilePath = result.filePaths[0]

            console.log("Importing package from:", originalFilePath)

            // importPackage extracts the archive and processes it
            await importPackage(originalFilePath)

            // After extraction, determine the package directory
            // importPackage extracts to packages/<packagename>/ where <packagename> comes from the info.json INSIDE the archive
            // We need to find that directory
            const packagesDir = getPackagesDir()

            // Validate packages directory
            if (!fs.existsSync(packagesDir)) {
                throw new Error(`Packages directory does not exist: ${packagesDir}`)
            }
            
            const stat = fs.statSync(packagesDir)
            if (!stat.isDirectory()) {
                throw new Error(
                    `Packages path exists but is not a directory: ${packagesDir}`,
                )
            }

            // Find the most recently modified directory in packages/ (should be the one we just extracted)
            const packageDirs = fs
                .readdirSync(packagesDir)
                .map((name) => path.join(packagesDir, name))
                .filter((filepath) => {
                    try {
                        return fs.statSync(filepath).isDirectory()
                    } catch (error) {
                        console.error(`Error checking path: ${filepath}`, error)
                        return false
                    }
                })
                .sort((a, b) => {
                    try {
                        return fs.statSync(b).mtime - fs.statSync(a).mtime
                    } catch (error) {
                        console.error(`Error sorting directories:`, error)
                        return 0
                    }
                })

            if (packageDirs.length === 0) {
                throw new Error("No package directory found after extraction")
            }

            const extractedPackageDir = packageDirs[0]
            const infoPath = path.join(extractedPackageDir, "info.json")

            console.log("Extracted package directory:", extractedPackageDir)
            console.log("Loading from info.json:", infoPath)

            mainWindow.webContents.send("package-loading-progress", {
                progress: 80,
                message: "Loading imported package...",
            })

            // Load the package from the extracted info.json location
            const pkg = await loadPackage(infoPath)

            mainWindow.webContents.send("package-loading-progress", {
                progress: 100,
                message: "Package imported and loaded successfully!",
            })

            // Send package loaded event to main window
            mainWindow.webContents.send(
                "package:loaded",
                pkg.items.map((item) => item.toJSONWithExistence()),
            )

            return { success: true }
        } catch (error) {
            console.error("Failed to import package:", error)
            throw error
        }
    })

    // Register icon preview handler
    ipcMain.handle(
        "show-icon-preview",
        async (event, { iconPath, itemName }) => {
            try {
                if (!iconPath || !fs.existsSync(iconPath)) {
                    throw new Error("Icon file not found")
                }

                createIconPreviewWindow(iconPath, itemName, mainWindow)

                return { success: true }
            } catch (error) {
                console.error("Failed to show icon preview:", error)
                throw error
            }
        },
    )

    // Register model preview handler
    ipcMain.handle(
        "show-model-preview",
        async (event, { objPath, mtlPath, title }) => {
            try {
                if (!objPath || !fs.existsSync(objPath)) {
                    throw new Error("OBJ file not found")
                }

                // If objPath is a directory, find the first OBJ file in it
                let actualObjPath = objPath
                let actualMtlPath = mtlPath

                const stats = fs.statSync(objPath)
                if (stats.isDirectory()) {
                    // Look for the combined OBJ file (has all models in grid layout)
                    const files = fs.readdirSync(objPath)

                    // First, try to find the combined file (contains "_combined")
                    let objFile = files.find(
                        (f) =>
                            f.includes("_combined.obj") &&
                            !f.includes("_sourcecoords"),
                    )

                    // If no combined file, fall back to any .obj file
                    if (!objFile) {
                        objFile = files.find(
                            (f) =>
                                f.endsWith(".obj") &&
                                !f.includes("_sourcecoords"),
                        )
                    }

                    if (!objFile) {
                        throw new Error(
                            "No OBJ files found in temp_models directory",
                        )
                    }

                    actualObjPath = path.join(objPath, objFile)
                    actualMtlPath = actualObjPath.replace(".obj", ".mtl")

                    console.log(`Found OBJ file for preview: ${objFile}`)
                }

                createModelPreviewWindow(actualObjPath, actualMtlPath, title)
                return { success: true }
            } catch (error) {
                console.error("Failed to show model preview:", error)
                throw error
            }
        },
    )

    // Register icon file browse handler (for staging)
    ipcMain.handle("browse-for-icon-file", async (event) => {
        try {
            // Show file dialog to select image file
            const result = await dialog.showOpenDialog(mainWindow, {
                title: "Select Icon File",
                properties: ["openFile"],
                filters: [
                    {
                        name: "Image Files",
                        extensions: ["png", "jpg", "jpeg", "tga", "vtf"],
                    },
                    {
                        name: "All Files",
                        extensions: ["*"],
                    },
                ],
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)
            const fileExt = path.extname(fileName).toLowerCase()

            // Validate it's an image file
            const validExtensions = [".png", ".jpg", ".jpeg", ".tga", ".vtf"]
            if (!validExtensions.includes(fileExt)) {
                throw new Error(
                    "Selected file must be an image file (PNG, JPG, TGA, or VTF)",
                )
            }

            return {
                success: true,
                filePath: selectedFilePath,
                fileName: fileName,
            }
        } catch (error) {
            console.error("Failed to browse for icon file:", error)
            return { success: false, error: error.message }
        }
    })

    // Register icon browse handler
    ipcMain.handle("browse-for-icon", async (event, { itemId }) => {
        try {
            // Find the item in any loaded package
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            // Show file dialog to select image file
            const result = await dialog.showOpenDialog(mainWindow, {
                title: "Select Icon File",
                properties: ["openFile"],
                filters: [
                    {
                        name: "Image Files",
                        extensions: ["png", "jpg", "jpeg", "tga", "vtf"],
                    },
                    {
                        name: "All Files",
                        extensions: ["*"],
                    },
                ],
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)
            const fileExt = path.extname(fileName).toLowerCase()

            // Validate it's an image file
            const validExtensions = [".png", ".jpg", ".jpeg", ".tga", ".vtf"]
            if (!validExtensions.includes(fileExt)) {
                throw new Error(
                    "Selected file must be an image file (PNG, JPG, TGA, or VTF)",
                )
            }

            // Get the current icon path or create a new one
            let targetIconPath
            if (item.icon && fs.existsSync(item.icon)) {
                // Replace existing icon - keep same path but update extension if needed
                const currentDir = path.dirname(item.icon)
                const currentBaseName = path.basename(
                    item.icon,
                    path.extname(item.icon),
                )
                targetIconPath = path.join(
                    currentDir,
                    currentBaseName + fileExt,
                )

                // Delete the old icon file if it's different from the new target
                if (item.icon !== targetIconPath && fs.existsSync(item.icon)) {
                    fs.unlinkSync(item.icon)
                }
            } else {
                // Create new icon path - use item name as filename in the BEE2/items structure
                const iconDir = path.join(
                    item.packagePath,
                    "resources",
                    "BEE2",
                    "items",
                    "beepkg",
                )
                if (!fs.existsSync(iconDir)) {
                    fs.mkdirSync(iconDir, { recursive: true })
                }
                const safeItemName = item.name
                    .replace(/[^a-zA-Z0-9_-]/g, "_")
                    .toLowerCase()
                targetIconPath = path.join(iconDir, safeItemName + fileExt)
            }

            // Copy the new icon file
            fs.copyFileSync(selectedFilePath, targetIconPath)

            // Convert icon to VTF at standard location
            const { convertImageToVTF } = require("./utils/vtfConverter")
            const vtfPath = path.join(
                item.packagePath,
                "resources/materials/models/props_map_editor/palette/bpee/item",
                "item.vtf",
            )
            try {
                await convertImageToVTF(selectedFilePath, vtfPath, {
                    format: "DXT5",
                    generateMipmaps: true,
                })
                console.log(`Created VTF icon at: ${vtfPath}`)
            } catch (error) {
                console.error("Failed to convert icon to VTF:", error)
                // Don't throw - let icon update continue
            }

            // Update the item's icon path in the properties file (where Item class actually reads it)
            const propertiesPath = path.join(
                item.fullItemPath,
                "properties.json",
            )
            if (fs.existsSync(propertiesPath)) {
                const properties = JSON.parse(
                    fs.readFileSync(propertiesPath, "utf-8"),
                )

                // Make path relative to resources/BEE2/items/ (as expected by Item class line 84)
                const bee2ItemsPath = path.join(
                    item.packagePath,
                    "resources",
                    "BEE2",
                    "items",
                )
                const relativePath = path.relative(
                    bee2ItemsPath,
                    targetIconPath,
                )

                if (!properties.Properties) properties.Properties = {}
                if (!properties.Properties.Icon) properties.Properties.Icon = {}
                properties.Properties.Icon["0"] = relativePath.replace(
                    /\\/g,
                    "/",
                )

                fs.writeFileSync(
                    propertiesPath,
                    JSON.stringify(properties, null, 2),
                )
            }

            // Update editoritems.json to use standard palette path
            const editorItemsPath = path.join(
                item.fullItemPath,
                "editoritems.json",
            )
            if (fs.existsSync(editorItemsPath)) {
                const editorItems = JSON.parse(
                    fs.readFileSync(editorItemsPath, "utf-8"),
                )

                const editor = editorItems.Item?.Editor
                if (editor?.SubType) {
                    const subType = Array.isArray(editor.SubType)
                        ? editor.SubType[0]
                        : editor.SubType

                    if (!subType.Palette) subType.Palette = {}
                    subType.Palette.Image = "palette/bpee/item/item"

                    fs.writeFileSync(
                        editorItemsPath,
                        JSON.stringify(editorItems, null, 2),
                    )
                }
            }

            // Reload the item to get updated data
            const updatedItemInstance = new Item({
                packagePath: item.packagePath,
                itemJSON: loadOriginalItemJSON(item.packagePath, item.id),
            })
            const updatedItem = updatedItemInstance.toJSON()

            // Send updated item data to frontend
            console.log("Sending updated item after icon change:", {
                id: updatedItem.id,
                icon: updatedItem.icon,
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true, iconPath: targetIconPath }
        } catch (error) {
            console.error("Failed to browse for icon:", error)
            dialog.showErrorBox(
                "Failed to Set Icon",
                `Could not set icon: ${error.message}`,
            )
            return { success: false, error: error.message }
        }
    })

    // IPC handler for Save Package
    ipcMain.on("save-package", async (event) => {
        try {
            const currentPackageDir = getCurrentPackageDir()
            if (!currentPackageDir) throw new Error("No package loaded")
            if (!lastSavedBpeePath) {
                // If no previous path, fall back to Save As
                event.sender.send("request-save-package-as")
                return
            }
            await savePackageAsBpee(currentPackageDir, lastSavedBpeePath)
            event.sender.send("package-saved", { path: lastSavedBpeePath })

            // Clear unsaved changes indicator
            if (global.titleManager) {
                global.titleManager.setUnsavedChanges(false)
            }
        } catch (err) {
            dialog.showErrorBox("Save Failed", err.message)
        }
    })

    // IPC handler for Save Package As
    ipcMain.on("save-package-as", async (event) => {
        try {
            const currentPackageDir = getCurrentPackageDir()
            if (!currentPackageDir) throw new Error("No package loaded")
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: "Save Package As",
                defaultPath: "package.bpee",
                filters: [{ name: "BeePEE Package", extensions: ["bpee"] }],
            })
            if (canceled || !filePath) return
            await savePackageAsBpee(currentPackageDir, filePath)
            lastSavedBpeePath = filePath
            event.sender.send("package-saved", { path: filePath })

            // Clear unsaved changes indicator
            if (global.titleManager) {
                global.titleManager.setUnsavedChanges(false)
            }
        } catch (err) {
            dialog.showErrorBox("Save As Failed", err.message)
        }
    })

    // Add instance from file path (for buffered save)
    ipcMain.handle(
        "add-instance-from-file",
        async (event, { itemId, filePath, instanceName }) => {
            try {
                // Find the item in any loaded package
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) {
                    throw new Error("Item not found")
                }

                // Verify the file exists
                if (!fs.existsSync(filePath)) {
                    throw new Error("Source file not found")
                }

                // Apply path fixing to remove BEE2/ prefix for actual file structure
                const actualFilePath = fixInstancePath(instanceName)
                const targetPath = path.join(
                    item.packagePath,
                    "resources",
                    actualFilePath,
                )
                const targetDir = path.dirname(targetPath)

                // Ensure the instances directory exists
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true })
                }

                // Copy the file
                fs.copyFileSync(filePath, targetPath)

                // Perform autopacking for the instance
                try {
                    const { autopackInstance } = require("./utils/autopacker")
                    const autopackResult = await autopackInstance(
                        filePath,
                        item.packagePath,
                        item.name,
                    )

                    if (!autopackResult.success) {
                        console.warn(
                            `Autopacking failed for instance ${instanceName}: ${autopackResult.error}`,
                        )
                        // Don't throw error, just log warning - instance addition should still succeed
                    } else {
                        console.log(
                            `Autopacking completed for instance ${instanceName}: ${autopackResult.packedAssets}/${autopackResult.totalAssets} assets packed`,
                        )
                    }
                } catch (autopackError) {
                    console.warn(
                        `Autopacking error for instance ${instanceName}:`,
                        autopackError.message,
                    )
                    // Don't throw error, just log warning - instance addition should still succeed
                }

                // Add to editoritems
                const newIndex = item.addInstance(instanceName)

                // Send updated item data to frontend
                const updatedItem = item.toJSONWithExistence()
                console.log(
                    "Sending updated item after add instance from file:",
                    {
                        id: updatedItem.id,
                        instances: updatedItem.instances,
                    },
                )
                mainWindow.webContents.send("item-updated", updatedItem)
                sendItemUpdateToEditor(itemId, updatedItem)

                return { success: true, index: newIndex }
            } catch (error) {
                dialog.showErrorBox(
                    "Failed to Add Instance",
                    `Could not add instance: ${error.message}`,
                )
                return { success: false, error: error.message }
            }
        },
    )

    // Add instance
    ipcMain.handle("add-instance", async (event, { itemId, instanceName }) => {
        try {
            // Find the item in any loaded package
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            const newIndex = item.addInstance(instanceName)

            // Send updated item data to frontend
            const updatedItem = item.toJSONWithExistence()
            console.log("Sending updated item after add instance:", {
                id: updatedItem.id,
                instances: updatedItem.instances,
            })
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true, index: newIndex }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Add Instance",
                `Could not add instance: ${error.message}`,
            )
            return { success: false, error: error.message }
        }
    })

    // Helper function to fix instance paths by removing BEE2/ prefix
    function fixInstancePath(instancePath) {
        // Normalize path separators to forward slashes
        let normalizedPath = instancePath.replace(/\\/g, "/")

        if (normalizedPath.startsWith("instances/BEE2/")) {
            return normalizedPath.replace("instances/BEE2/", "instances/")
        }
        if (normalizedPath.startsWith("instances/bee2/")) {
            return normalizedPath.replace("instances/bee2/", "instances/")
        }
        return normalizedPath
    }

    // Helper function to fix all instances in an item
    function fixItemInstances(item) {
        let hasChanges = false

        // Fix instances in memory
        for (const [index, instanceData] of Object.entries(item.instances)) {
            const oldPath = instanceData.Name
            const newPath = fixInstancePath(oldPath)

            if (oldPath !== newPath) {
                console.log(`Fixing instance path: ${oldPath} -> ${newPath}`)
                instanceData.Name = newPath
                hasChanges = true
            }
        }

        // Fix instances in editoritems file
        if (hasChanges) {
            const editoritems = item.getEditorItems()
            if (editoritems.Item?.Exporting?.Instances) {
                for (const [index, instanceData] of Object.entries(
                    editoritems.Item.Exporting.Instances,
                )) {
                    const oldPath = instanceData.Name
                    const newPath = fixInstancePath(oldPath)

                    if (oldPath !== newPath) {
                        instanceData.Name = newPath
                    }
                }
                item.saveEditorItems(editoritems)
            }
        }

        return hasChanges
    }

    // Select instance file (for buffered save)
    ipcMain.handle("select-instance-file", async (event, { itemId }) => {
        try {
            // Find the item in any loaded package
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            // Show file dialog to select VMF file
            const result = await dialog.showOpenDialog(mainWindow, {
                title: "Select VMF Instance File",
                properties: ["openFile"],
                filters: [
                    {
                        name: "VMF Files",
                        extensions: ["vmf"],
                    },
                    {
                        name: "All Files",
                        extensions: ["*"],
                    },
                ],
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)

            // Check if it's a VMF file
            if (!fileName.toLowerCase().endsWith(".vmf")) {
                throw new Error("Selected file must be a VMF file")
            }

            // Calculate what the instance name would be (same logic as add-instance-file-dialog)
            // Use new structure: instances/BEE2/bpee/ITEMID/instance.vmf
            // Generate instance filename based on existing instance count
            const existingInstances = Object.values(item.instances)
            const instanceIndex = existingInstances.length
            const instanceFileName =
                instanceIndex === 0
                    ? "instance.vmf"
                    : `instance_${instanceIndex}.vmf`
            const instanceName = `instances/BEE2/bpee/${item.id}/${instanceFileName}`

            // Return file info without actually adding to backend
            return {
                success: true,
                filePath: selectedFilePath,
                instanceName: instanceName,
                fileName: fileName,
            }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Select Instance File",
                `Could not select instance file: ${error.message}`,
            )
            return { success: false, error: error.message }
        }
    })

    // Add instance with file dialog
    ipcMain.handle("add-instance-file-dialog", async (event, { itemId }) => {
        try {
            // Find the item in any loaded package
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) {
                throw new Error("Item not found")
            }

            // Show file dialog to select VMF file
            const result = await dialog.showOpenDialog(mainWindow, {
                title: "Select VMF Instance File",
                properties: ["openFile"],
                filters: [
                    {
                        name: "VMF Files",
                        extensions: ["vmf"],
                    },
                    {
                        name: "All Files",
                        extensions: ["*"],
                    },
                ],
            })

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true }
            }

            const selectedFilePath = result.filePaths[0]
            const fileName = path.basename(selectedFilePath)

            // Check if it's a VMF file
            if (!fileName.toLowerCase().endsWith(".vmf")) {
                throw new Error("Selected file must be a VMF file")
            }

            // Use new structure: instances/BEE2/bpee/ITEMID/instance.vmf
            // Generate instance filename based on existing instance count
            const existingInstances = Object.values(item.instances)
            const instanceIndex = existingInstances.length
            const instanceFileName =
                instanceIndex === 0
                    ? "instance.vmf"
                    : `instance_${instanceIndex}.vmf`
            const instanceName = `instances/BEE2/bpee/${item.id}/${instanceFileName}`

            // Copy the file to the package resources directory
            // Apply path fixing to remove BEE2/ prefix for actual file structure
            const actualFilePath = fixInstancePath(instanceName)
            const targetPath = path.join(
                item.packagePath,
                "resources",
                actualFilePath,
            )
            const targetDir = path.dirname(targetPath)

            // Ensure the instances directory exists
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true })
            }

            // Copy the file
            fs.copyFileSync(selectedFilePath, targetPath)

            // Add to editoritems
            const newIndex = item.addInstance(instanceName)

            // Send updated item data to frontend
            const updatedItem = item.toJSONWithExistence()
            console.log(
                "Sending updated item after file dialog add instance:",
                {
                    id: updatedItem.id,
                    instances: updatedItem.instances,
                },
            )
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return {
                success: true,
                index: newIndex,
                instanceName: instanceName,
            }
        } catch (error) {
            dialog.showErrorBox(
                "Failed to Add Instance",
                `Could not add instance: ${error.message}`,
            )
            return { success: false, error: error.message }
        }
    })

    // Replace instance with file dialog
    ipcMain.handle(
        "replace-instance-file-dialog",
        async (event, { itemId, instanceIndex }) => {
            try {
                // Find the item in any loaded package
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) {
                    throw new Error("Item not found")
                }

                const instanceData = item.instances[instanceIndex]
                if (!instanceData) {
                    throw new Error(`Instance ${instanceIndex} not found`)
                }

                // Show file dialog to select new VMF file
                const result = await dialog.showOpenDialog(mainWindow, {
                    title: "Select Replacement VMF Instance File",
                    properties: ["openFile"],
                    filters: [
                        {
                            name: "VMF Files",
                            extensions: ["vmf"],
                        },
                        {
                            name: "All Files",
                            extensions: ["*"],
                        },
                    ],
                })

                if (result.canceled || result.filePaths.length === 0) {
                    return { success: false, canceled: true }
                }

                const selectedFilePath = result.filePaths[0]
                const fileName = path.basename(selectedFilePath)

                // Check if it's a VMF file
                if (!fileName.toLowerCase().endsWith(".vmf")) {
                    throw new Error("Selected file must be a VMF file")
                }

                // Get the current instance file path
                // Apply path fixing to remove BEE2/ prefix for actual file structure
                const actualInstancePath = fixInstancePath(instanceData.Name)
                const currentInstancePath = Instance.getCleanPath(
                    item.packagePath,
                    actualInstancePath,
                )

                // Copy the new file over the existing one
                fs.copyFileSync(selectedFilePath, currentInstancePath)

                // Clear the cached instance so it gets reloaded
                item._loadedInstances.delete(instanceIndex)

                // Clear VMF stats cache for this instance
                vmfStatsCache.clearCache(currentInstancePath)

                // Update VMF stats in the saved editoritems file
                try {
                    const editoritems = item.getEditorItems()
                    if (
                        editoritems.Item?.Exporting?.Instances?.[instanceIndex]
                    ) {
                        // Get updated VMF stats
                        const actualInstancePath = fixInstancePath(
                            instanceData.Name,
                        )
                        const fullInstancePath = Instance.getCleanPath(
                            item.packagePath,
                            actualInstancePath,
                        )
                        const vmfStats =
                            vmfStatsCache.getStats(fullInstancePath)

                        // Update the saved instance data with new stats
                        editoritems.Item.Exporting.Instances[instanceIndex] = {
                            ...editoritems.Item.Exporting.Instances[
                                instanceIndex
                            ],
                            ...vmfStats,
                        }
                        item.saveEditorItems(editoritems)
                    }
                } catch (error) {
                    console.warn(
                        "Failed to update VMF stats in editoritems:",
                        error.message,
                    )
                }

                // Send updated item data to frontend
                const updatedItem = item.toJSONWithExistence()
                console.log("Sending updated item after replace instance:", {
                    id: updatedItem.id,
                    instances: updatedItem.instances,
                })
                mainWindow.webContents.send("item-updated", updatedItem)
                sendItemUpdateToEditor(itemId, updatedItem)

                return { success: true, instanceName: instanceData.Name }
            } catch (error) {
                dialog.showErrorBox(
                    "Failed to Replace Instance",
                    `Could not replace instance: ${error.message}`,
                )
                return { success: false, error: error.message }
            }
        },
    )

    // Remove instance
    ipcMain.handle(
        "remove-instance",
        async (event, { itemId, instanceIndex }) => {
            try {
                // Find the item in any loaded package
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) {
                    throw new Error("Item not found")
                }

                // Get instance path before removing it for cache invalidation
                const instanceData = item.instances[instanceIndex]
                if (instanceData) {
                    try {
                        const actualInstancePath = fixInstancePath(
                            instanceData.Name,
                        )
                        const fullInstancePath = Instance.getCleanPath(
                            item.packagePath,
                            actualInstancePath,
                        )
                        // Clear VMF stats cache for this instance
                        vmfStatsCache.clearCache(fullInstancePath)
                    } catch (error) {
                        console.warn(
                            "Could not clear VMF cache for removed instance:",
                            error.message,
                        )
                    }
                }

                item.removeInstance(instanceIndex)

                // Send updated item data to frontend
                const updatedItem = item.toJSONWithExistence()
                console.log("Sending updated item after remove instance:", {
                    id: updatedItem.id,
                    instances: updatedItem.instances,
                })
                mainWindow.webContents.send("item-updated", updatedItem)
                sendItemUpdateToEditor(itemId, updatedItem)

                return { success: true }
            } catch (error) {
                dialog.showErrorBox(
                    "Failed to Remove Instance",
                    `Could not remove instance: ${error.message}`,
                )
                return { success: false, error: error.message }
            }
        },
    )

    // Input management handlers
    ipcMain.handle("get-inputs", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, inputs: item.getInputs() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle(
        "add-input",
        async (event, { itemId, inputName, inputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.addInput(inputName, inputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Add Input", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle(
        "update-input",
        async (event, { itemId, inputName, inputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.updateInput(inputName, inputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Update Input", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle("remove-input", async (event, { itemId, inputName }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            item.removeInput(inputName)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Remove Input", error.message)
            return { success: false, error: error.message }
        }
    })

    // Output management handlers
    ipcMain.handle("get-outputs", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, outputs: item.getOutputs() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle(
        "add-output",
        async (event, { itemId, outputName, outputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.addOutput(outputName, outputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Add Output", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle(
        "update-output",
        async (event, { itemId, outputName, outputConfig }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                item.updateOutput(outputName, outputConfig)
                return { success: true }
            } catch (error) {
                dialog.showErrorBox("Failed to Update Output", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle("remove-output", async (event, { itemId, outputName }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            item.removeOutput(outputName)
            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Remove Output", error.message)
            return { success: false, error: error.message }
        }
    })

    // Get entities from item instances for UI dropdowns
    ipcMain.handle("get-item-entities", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const allEntities = {}

            // Get entities from all valid instances only
            for (const [instanceIndex, instanceData] of Object.entries(
                item.instances,
            )) {
                // Only process instances that actually exist
                if (!item.instanceExists(instanceIndex)) {
                    continue
                }

                const instance = item.getInstance(instanceIndex)
                if (instance) {
                    const entities = instance.getAllEntities()

                    // Merge entities (Object.assign handles duplicates by overwriting)
                    Object.assign(allEntities, entities)
                }
            }

            return { success: true, entities: allEntities }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Get valid instances only (for UI filtering)
    ipcMain.handle("get-valid-instances", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const validInstances = item.getValidInstances()
            return { success: true, instances: validInstances }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Get Portal 2 FGD data for entity inputs/outputs
    ipcMain.handle("get-fgd-data", async (event) => {
        try {
            const resources = await findPortal2Resources()
            if (!resources || !resources.entities) {
                return {
                    success: false,
                    error: "Portal 2 FGD data not available",
                }
            }

            return { success: true, entities: resources.entities }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Instance metadata handler
    ipcMain.handle(
        "get-instance-metadata",
        async (event, { itemId, instanceIndex }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                const metadata = item.getInstanceMetadata(instanceIndex)
                return { success: true, metadata }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },
    )

    // Metadata management handlers
    ipcMain.handle("get-item-metadata", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, metadata: item.getMetadata() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle(
        "update-item-metadata",
        async (event, { itemId, metadata }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                const success = item.updateMetadata(metadata)
                if (success) {
                    // Send updated item to frontend
                    const updatedItem = item.toJSONWithExistence()
                    mainWindow.webContents.send("item-updated", updatedItem)
                    sendItemUpdateToEditor(itemId, updatedItem)
                }

                return { success }
            } catch (error) {
                dialog.showErrorBox("Failed to Update Metadata", error.message)
                return { success: false, error: error.message }
            }
        },
    )

    // Register instance editing in Hammer
    ipcMain.handle(
        "edit-instance",
        async (event, { packagePath, instanceName, itemId }) => {
            try {
                const hammerStatus = getHammerAvailability()
                if (!hammerStatus.available) {
                    throw new Error(
                        "Neither Hammer++ nor Hammer was found in Portal 2's bin directory",
                    )
                }

                // Find the item to get all its instances
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) {
                    throw new Error("Item not found")
                }

                // Build absolute path to instance file
                // Apply path fixing to remove BEE2/ prefix for actual file structure
                const actualInstancePath = fixInstancePath(instanceName)
                const instancePath = path.normalize(
                    Instance.getCleanPath(packagePath, actualInstancePath),
                )

                // Verify the path is within the package resources directory
                const resourcesDir = path.normalize(
                    path.join(packagePath, "resources"),
                )
                if (!instancePath.startsWith(resourcesDir)) {
                    throw new Error(
                        `Invalid instance path: ${instancePath} (must be within package resources directory)`,
                    )
                }

                if (!fs.existsSync(instancePath)) {
                    throw new Error(`Instance file not found: ${instancePath}`)
                }

                // Launch Hammer with the instance file
                const hammer = spawn(getHammerPath(), [instancePath], {
                    detached: true,
                    stdio: "ignore",
                })

                hammer.unref()

                return { success: true, editorType: hammerStatus.type }
            } catch (error) {
                const errorMessage = `Could not open instance in Hammer: ${error.message}`
                dialog.showErrorBox("Failed to Launch Hammer", errorMessage)
                return { success: false, error: errorMessage }
            }
        },
    )

    // Instance naming handlers
    ipcMain.handle(
        "get-instance-name",
        async (event, { itemId, instanceIndex }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)

                if (!item) {
                    throw new Error(`Item ${itemId} not found`)
                }

                const name = item.getInstanceName(instanceIndex)
                return { success: true, name }
            } catch (error) {
                console.error("Error getting instance name:", error)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle(
        "set-instance-name",
        async (event, { itemId, instanceIndex, name }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)

                if (!item) {
                    throw new Error(`Item ${itemId} not found`)
                }

                item.setInstanceName(instanceIndex, name)

                // Send updated item data to both windows
                const updatedItem = item.toJSONWithExistence()
                event.sender.send("item-updated", updatedItem)

                // Find main window and send update
                const mainWindow = BrowserWindow.getAllWindows().find((w) =>
                    w.getTitle().includes("BeePEE"),
                )
                if (mainWindow) {
                    mainWindow.webContents.send("item-updated", updatedItem)
                }

                return { success: true }
            } catch (error) {
                console.error("Error setting instance name:", error)
                return { success: false, error: error.message }
            }
        },
    )

    ipcMain.handle("get-instance-names", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)

            if (!item) {
                throw new Error(`Item ${itemId} not found`)
            }

            const names = item.getInstanceNames()
            return { success: true, names }
        } catch (error) {
            console.error("Error getting instance names:", error)
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle(
        "remove-instance-name",
        async (event, { itemId, instanceIndex }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)

                if (!item) {
                    throw new Error(`Item ${itemId} not found`)
                }

                item.removeInstanceName(instanceIndex)

                // Send updated item data to both windows
                const updatedItem = item.toJSONWithExistence()
                event.sender.send("item-updated", updatedItem)

                // Find main window and send update
                const mainWindow = BrowserWindow.getAllWindows().find((w) =>
                    w.getTitle().includes("BeePEE"),
                )
                if (mainWindow) {
                    mainWindow.webContents.send("item-updated", updatedItem)
                }

                return { success: true }
            } catch (error) {
                console.error("Error removing instance name:", error)
                return { success: false, error: error.message }
            }
        },
    )

    // Variables management handlers
    ipcMain.handle("get-variables", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, variables: item.getVariables() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("save-variables", async (event, { itemId, variables }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            const success = item.saveVariables(variables)
            if (!success) {
                throw new Error("Failed to save variables to editoritems.json")
            }

            // Send updated item data to frontend
            const updatedItem = item.toJSONWithExistence()
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Save Variables", error.message)
            return { success: false, error: error.message }
        }
    })

    // Conditions management handlers
    ipcMain.handle("get-conditions", async (event, { itemId }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            return { success: true, conditions: item.getConditions() }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle("save-conditions", async (event, { itemId, conditions }) => {
        try {
            const item = packages
                .flatMap((p) => p.items)
                .find((i) => i.id === itemId)
            if (!item) throw new Error("Item not found")

            // Print blocks to main console on save (JSON only)
            if (conditions?.blocks) {
                console.log(JSON.stringify(conditions.blocks, null, 2))
            }

            // Convert blocks to VBSP format and save
            const success = item.saveConditions(conditions)
            if (!success) {
                throw new Error("Failed to save conditions to VBSP config")
            }

            // Print resulting VBSP JSON to main console
            try {
                const vbsp = item.getConditions()
                console.log(JSON.stringify(vbsp, null, 2))
            } catch (e) {
                // ignore
            }

            // Send updated item data to frontend
            const updatedItem = item.toJSONWithExistence()
            mainWindow.webContents.send("item-updated", updatedItem)
            sendItemUpdateToEditor(itemId, updatedItem)

            return { success: true }
        } catch (error) {
            dialog.showErrorBox("Failed to Save Conditions", error.message)
            return { success: false, error: error.message }
        }
    })

    // VMF2OBJ conversion handler
    ipcMain.handle(
        "convert-vmf-to-obj",
        async (event, { vmfPath, outputDir }) => {
            try {
                const result = await convertVmfToObj(vmfPath, { outputDir })
                return { success: true, ...result }
            } catch (error) {
                const details = [
                    error.message,
                    error.stack ? `stack:\n${error.stack}` : null,
                    error.cmd ? `cmd: ${error.cmd}` : null,
                    error.cwd ? `cwd: ${error.cwd}` : null,
                ]
                    .filter(Boolean)
                    .join("\n")
                dialog.showErrorBox("VMF to OBJ Conversion Failed", details)
                return {
                    success: false,
                    error: error.message,
                    cmd: error.cmd,
                    cwd: error.cwd,
                }
            }
        },
    )

    // VMF2OBJ conversion by instance key (resolves VMF path server-side)
    ipcMain.handle(
        "convert-instance-to-obj",
        async (event, { itemId, instanceKey, options = {} }) => {
            try {
                const item = packages
                    .flatMap((p) => p.items)
                    .find((i) => i.id === itemId)
                if (!item) throw new Error("Item not found")

                // If this is a variable-based conversion, handle it differently
                if (options.isVariable) {
                    console.log(
                        `🚀 Starting variable-based model conversion for item "${item.name}"`,
                    )
                    console.log(`   Variable: "${instanceKey}"`)

                    // Step 1: Parse VBSP blocks to get value -> instance mapping
                    const {
                        mapVariableValuesToInstances,
                    } = require("./utils/mdlConverter")
                    const conditions = item.getConditions()

                    console.log(
                        "Conditions structure:",
                        JSON.stringify(conditions, null, 2),
                    )
                    console.log(
                        "Conditions.blocks type:",
                        typeof conditions.blocks,
                        "isArray:",
                        Array.isArray(conditions.blocks),
                    )

                    const valueInstanceMap = mapVariableValuesToInstances(
                        conditions,
                        instanceKey,
                        item,
                    )

                    console.log("Value to instance map:", valueInstanceMap)

                    // Handle DEFAULT: use the first registered instance and run single conversion
                    if (String(instanceKey).toUpperCase() === "DEFAULT") {
                        console.log(
                            "DEFAULT selected: using the first registered instance for model generation",
                        )
                        const instanceKeys = Object.keys(item.instances).sort(
                            (a, b) => parseInt(a, 10) - parseInt(b, 10),
                        )
                        const firstKey = instanceKeys[0]
                        const firstInstance = firstKey
                            ? item.instances[firstKey]
                            : null
                        if (!firstInstance?.Name) {
                            throw new Error(
                                "No instances available for DEFAULT generation",
                            )
                        }

                        // Resolve path and ensure temp dir
                        const vmfPath = Instance.getCleanPath(
                            item.packagePath,
                            firstInstance.Name,
                        )
                        const tempDir = path.join(
                            item.packagePath,
                            "temp_models",
                        )
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true })
                        }

                        // Convert VMF -> OBJ
                        const result = await convertVmfToObj(vmfPath, {
                            outputDir: tempDir,
                            textureStyle: options.textureStyle || "cartoon",
                        })

                        // Paths for downstream steps
                        const fileBase = path.basename(
                            vmfPath,
                            path.extname(vmfPath),
                        )
                        const objPath = path.join(tempDir, `${fileBase}.obj`)
                        const mtlPath = path.join(tempDir, `${fileBase}.mtl`)

                        // Try MDL conversion and update editoritems
                        let mdlResult = null
                        try {
                            console.log(
                                "🎯 Starting MDL conversion process (DEFAULT)...",
                            )
                            const {
                                convertAndInstallMDL,
                            } = require("./utils/mdlConverter")
                            const itemName = item.id
                                .replace(/[^a-zA-Z0-9_-]/g, "_")
                                .toLowerCase()
                            mdlResult = await convertAndInstallMDL(
                                objPath,
                                item.packagePath,
                                itemName,
                                { scale: options.scale || 1.0 },
                            )

                            if (
                                mdlResult.success &&
                                mdlResult.relativeModelPath
                            ) {
                                const editorItems = item.getEditorItems()
                                const subType = Array.isArray(
                                    editorItems.Item.Editor.SubType,
                                )
                                    ? editorItems.Item.Editor.SubType[0]
                                    : editorItems.Item.Editor.SubType
                                if (!subType.Model) subType.Model = {}
                                subType.Model.ModelName =
                                    mdlResult.relativeModelPath

                                // Add 3DS collision model if available
                                // DISABLED: Don't include 3DS files in editoritems.txt
                                // if (mdlResult.threeDSResult?.relativeModelPath) {
                                //     subType.Model.CollisionModelName = mdlResult.threeDSResult.relativeModelPath
                                // }

                                if (
                                    !Array.isArray(
                                        editorItems.Item.Editor.SubType,
                                    )
                                ) {
                                    editorItems.Item.Editor.SubType = [subType]
                                }
                                item.saveEditorItems(editorItems)
                            }
                        } catch (mdlError) {
                            console.error(
                                "❌ MDL conversion failed (DEFAULT):",
                                mdlError,
                            )
                            mdlResult = {
                                success: false,
                                error: mdlError.message,
                            }
                        }

                        return {
                            success: true,
                            vmfPath,
                            tempDir,
                            objPath,
                            mtlPath,
                            mdlResult,
                            ...result,
                        }
                    }

                    // Sort the map: -1 first, then numerically ascending
                    const sortedEntries = [...valueInstanceMap.entries()].sort(
                        ([valA], [valB]) => {
                            const numA = Number(valA)
                            const numB = Number(valB)

                            if (numA === -1 && numB !== -1) return -1
                            if (numB === -1 && numA !== -1) return 1

                            return numA - numB
                        },
                    )
                    const sortedValueInstanceMap = new Map(sortedEntries)
                    console.log(
                        "Sorted value to instance map:",
                        sortedValueInstanceMap,
                    )

                    if (sortedValueInstanceMap.size === 0) {
                        // For cubeType variables, fall back to using the first instance
                        if (String(instanceKey).toLowerCase().includes("cubetype")) {
                            console.log(
                                `No instances found for cubeType variable "${instanceKey}", falling back to first instance`,
                            )
                            const instanceKeys = Object.keys(item.instances).sort(
                                (a, b) => parseInt(a, 10) - parseInt(b, 10),
                            )
                            const firstKey = instanceKeys[0]
                            const firstInstance = firstKey
                                ? item.instances[firstKey]
                                : null
                            
                            if (!firstInstance?.Name) {
                                dialog.showMessageBox({
                                    type: "error",
                                    title: "No Instances Available",
                                    message: `No instances available for fallback.`,
                                    detail: "Make sure the item has at least one instance registered.",
                                })
                                return {
                                    success: false,
                                    error: `No instances available for fallback`,
                                }
                            }

                            // Create a map with all cubeType values (0-4) pointing to the first instance
                            const cubeTypeMap = new Map()
                            for (let i = 0; i <= 4; i++) {
                                cubeTypeMap.set(String(i), firstInstance.Name)
                            }
                            sortedValueInstanceMap = cubeTypeMap
                            console.log(
                                `Created fallback cubeType map with ${cubeTypeMap.size} entries, all pointing to first instance: ${firstInstance.Name}`,
                            )
                        } else {
                            dialog.showMessageBox({
                                type: "warning",
                                title: "No Instances Found",
                                message: `No instances found for variable "${instanceKey}".`,
                                detail: "Make sure the VBSP blocks are configured correctly.",
                            })
                            return {
                                success: false,
                                error: `No instances found for variable "${instanceKey}"`,
                            }
                        }
                    }

                    // By default, use the map as-is
                    let finalInstanceMap = sortedValueInstanceMap

                    // Only apply 0–30 filling when the selected variable is a timer
                    if (String(instanceKey).toLowerCase().includes("timer")) {
                        console.log(
                            "Timer variable detected, applying 0–30 fill logic...",
                        )

                        // Determine base instance for filling missing values
                        let baseInstance = null
                        if (
                            sortedValueInstanceMap.has("0") ||
                            sortedValueInstanceMap.has(0)
                        ) {
                            const zeroKey = sortedValueInstanceMap.has("0")
                                ? "0"
                                : 0
                            baseInstance = sortedValueInstanceMap.get(zeroKey)
                        } else if (sortedValueInstanceMap.size > 0) {
                            const minKey = [...sortedValueInstanceMap.keys()]
                                .map((k) => Number(k))
                                .filter((n) => !isNaN(n))
                                .sort((a, b) => a - b)[0]
                            baseInstance = sortedValueInstanceMap.get(
                                String(minKey),
                            )
                            console.log(
                                `No '0' timer found, using instance from smallest key '${minKey}' as base.`,
                            )
                        } else {
                            dialog.showMessageBox({
                                type: "error",
                                title: "Cannot Generate Models",
                                message: "No timer instances defined.",
                                detail: "The VBSP configuration must have at least one instance defined for a timer value to generate models.",
                            })
                            return {
                                success: false,
                                error: "No timer instances found.",
                            }
                        }

                        // Create a new, complete map from 0–30
                        const completeTimerMap = new Map()
                        for (let i = 0; i <= 30; i++) {
                            const keyStr = String(i)
                            if (sortedValueInstanceMap.has(keyStr)) {
                                completeTimerMap.set(
                                    keyStr,
                                    sortedValueInstanceMap.get(keyStr),
                                )
                            } else {
                                completeTimerMap.set(keyStr, baseInstance)
                            }
                        }
                        finalInstanceMap = completeTimerMap
                        console.log(
                            `Final timer map has ${finalInstanceMap.size} entries (must be exactly 31).`,
                        )
                        // Ensure exactly 31 entries for timer (0-30)
                        if (finalInstanceMap.size !== 31) {
                            console.warn(
                                `⚠️ Timer map has ${finalInstanceMap.size} entries, expected 31. Trimming to 0-30 range.`,
                            )
                            const trimmedMap = new Map()
                            for (let i = 0; i <= 30; i++) {
                                const keyStr = String(i)
                                if (completeTimerMap.has(keyStr)) {
                                    trimmedMap.set(keyStr, completeTimerMap.get(keyStr))
                                } else {
                                    trimmedMap.set(keyStr, baseInstance)
                                }
                            }
                            finalInstanceMap = trimmedMap
                        }
                    }

                    // Step 2: Use VMF Atlas - merge all VMFs into a grid, convert once, then split
                    console.log(`📐 Using VMF Atlas approach (grid layout)...`)

                    const uniqueInstances = [
                        ...new Set(finalInstanceMap.values()),
                    ]

                    // Send initial progress
                    event.sender.send("conversion-progress", {
                        stage: "merge",
                        message: `Preparing to merge ${uniqueInstances.length} instances into grid...`,
                    })
                    const tempDir = path.join(item.packagePath, "temp_models")
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true })
                    }

                    // Prepare VMF file list for atlas
                    const vmfFiles = []
                    for (const instancePath of uniqueInstances) {
                        const vmfPath = Instance.getCleanPath(
                            item.packagePath,
                            instancePath,
                        )
                        const fileBase = path.basename(
                            instancePath,
                            path.extname(instancePath),
                        )

                        if (!fs.existsSync(vmfPath)) {
                            console.warn(`   ⚠️ VMF file not found: ${vmfPath}`)
                            continue
                        }

                        vmfFiles.push({
                            path: vmfPath,
                            name: fileBase,
                            instancePath,
                        })
                    }

                    if (vmfFiles.length === 0) {
                        return {
                            success: false,
                            error: "No valid VMF files found",
                        }
                    }

                    // Merge VMFs into grid layout
                    const {
                        mergeVMFsIntoGrid,
                        splitOBJByGrid,
                    } = require("./utils/vmfAtlas")
                    const combinedVmfPath = path.join(
                        tempDir,
                        `${item.id}_combined.vmf`,
                    )

                    const atlasResult = await mergeVMFsIntoGrid(
                        vmfFiles,
                        combinedVmfPath,
                        {
                            spacing: 256,
                        },
                    )

                    console.log(`✅ VMF Atlas created: ${combinedVmfPath}`)
                    console.log(
                        `   Grid: ${atlasResult.bounds.cols}×${atlasResult.bounds.rows}, Cell: ${Math.round(atlasResult.bounds.cellSize)}`,
                    )

                    // Convert the combined VMF to OBJ (single VMF2OBJ call!)
                    // This is a BIG VMF with multiple models - needs longer timeout!
                    console.log(
                        `🔄 Converting combined VMF to OBJ (${vmfFiles.length} models)...`,
                    )
                    console.log(`⏱️  This may take several minutes...`)

                    // Send progress update to frontend
                    event.sender.send("conversion-progress", {
                        stage: "vmf2obj",
                        message: `Converting ${vmfFiles.length} models in grid layout...`,
                        detail: "This may take several minutes",
                    })

                    const combinedResult = await convertVmfToObj(
                        combinedVmfPath,
                        {
                            outputDir: tempDir,
                            textureStyle: options.textureStyle || "cartoon",
                            timeoutMs: 600000, // 10 minutes for combined VMF (20+ models takes time!)
                        },
                    )

                    // Use the actual OBJ path from VMF2OBJ result
                    const combinedObjPath =
                        combinedResult.objPath ||
                        path.join(tempDir, `${item.id}_combined.obj`)

                    if (!fs.existsSync(combinedObjPath)) {
                        throw new Error(
                            `VMF2OBJ did not create expected output: ${combinedObjPath}`,
                        )
                    }

                    console.log(`✅ Combined OBJ created: ${combinedObjPath}`)

                    // Split the combined OBJ back into individual models
                    console.log(
                        `✂️  Splitting combined OBJ into individual models...`,
                    )
                    event.sender.send("conversion-progress", {
                        stage: "split",
                        message:
                            "Splitting combined model into individual variants...",
                    })

                    const splitResults = await splitOBJByGrid(
                        combinedObjPath,
                        atlasResult.gridLayout,
                        tempDir,
                        atlasResult.bounds.cellSize,
                    )

                    // Convert materials ONCE to a shared folder (all models use the same textures)
                    console.log(
                        `🎨 Converting materials to VTF/VMT format (shared)...`,
                    )
                    const {
                        convertMaterialsToPackage,
                    } = require("./utils/mdlConverter")
                    const materialsSourceDir = path.join(tempDir, "materials")

                    // Shared folder name - lowercase item ID
                    const sharedFolderName = item.id.toLowerCase()

                    const sharedMaterialsPath = path.join(
                        item.packagePath,
                        "resources",
                        "materials",
                        "models",
                        "props_map_editor",
                        "bpee",
                        sharedFolderName,
                    )

                    try {
                        await convertMaterialsToPackage(
                            materialsSourceDir,
                            sharedMaterialsPath,
                            tempDir,
                            sharedFolderName,
                        )
                        console.log(
                            `✅ Shared materials converted to: ${sharedMaterialsPath}`,
                        )
                    } catch (error) {
                        console.error(
                            `❌ Failed to convert shared materials:`,
                            error,
                        )
                        throw error
                    }

                    // Convert each split OBJ to MDL (skip material conversion, use shared)
                    console.log(`🔨 Converting split OBJs to MDL...`)
                    event.sender.send("conversion-progress", {
                        stage: "mdl",
                        message: `Converting ${splitResults.length} models to MDL format...`,
                    })
                    const conversionPromises = splitResults.map(
                        async (split) => {
                            const instancePath = vmfFiles.find(
                                (v) => v.name === split.name,
                            )?.instancePath
                            if (!instancePath) {
                                return {
                                    instancePath: split.name,
                                    error: "Instance path not found",
                                }
                            }

                            try {
                                console.log(
                                    `  -> Converting ${split.name} to MDL...`,
                                )

                                const {
                                    convertAndInstallMDL,
                                } = require("./utils/mdlConverter")
                                const mdlResult = await convertAndInstallMDL(
                                    split.objPath,
                                    item.packagePath,
                                    split.name,
                                    {
                                        scale: options.scale || 1.0,
                                        skipMaterialConversion: true,
                                        sharedMaterialsPath:
                                            sharedMaterialsPath,
                                        sharedModelFolder: sharedFolderName, // All models go in same folder
                                    },
                                )

                                console.log(`   ✅ Converted: ${split.name}`)

                                // Extract 3DS path if available
                                const threeDSPath =
                                    mdlResult.threeDSResult
                                        ?.relativeModelPath || null

                                return {
                                    instancePath,
                                    modelPath: mdlResult.relativeModelPath,
                                    threeDSPath: threeDSPath,
                                    value: instancePath,
                                }
                            } catch (error) {
                                console.error(
                                    `   ❌ FAILED to convert ${split.name}:`,
                                    error.message,
                                )
                                return { instancePath, error: error.message }
                            }
                        },
                    )

                    const conversionResults =
                        await Promise.all(conversionPromises)
                    console.log("Atlas conversion results:", conversionResults)

                    // Check for errors
                    const successfulResults = conversionResults.filter(
                        (r) => r.modelPath,
                    )
                    const failedResults = conversionResults.filter(
                        (r) => r.error,
                    )

                    console.log(`✅ Successful: ${successfulResults.length}`)
                    console.log(`❌ Failed: ${failedResults.length}`)

                    if (successfulResults.length === 0) {
                        dialog.showMessageBox({
                            type: "error",
                            title: "All Conversions Failed",
                            message: "No models could be generated.",
                            detail: failedResults
                                .map(
                                    (r) =>
                                        `${path.basename(r.instancePath)}: ${r.error}`,
                                )
                                .join("\n"),
                        })
                        return { success: false, results: conversionResults }
                    }

                    // Step 3: Update editoritems.json with new SubType structure
                    const editorItems = item.getEditorItems()

                    // Ensure SubType is an array
                    if (!Array.isArray(editorItems.Item.Editor.SubType)) {
                        editorItems.Item.Editor.SubType = [
                            editorItems.Item.Editor.SubType,
                        ]
                    }

                    // Get the base SubType to clone
                    const baseSubType = JSON.parse(
                        JSON.stringify(editorItems.Item.Editor.SubType[0]),
                    )

                    // Add SubTypeProperty - convert to PascalCase (e.g., "CUBE TYPE" -> "CubeType")
                    const toPascalCase = (str) => {
                        return str
                            .split(/[\s_]+/) // Split on spaces or underscores
                            .map(
                                (word) =>
                                    word.charAt(0).toUpperCase() +
                                    word.slice(1).toLowerCase(),
                            )
                            .join("")
                    }
                    editorItems.Item.Editor.SubTypeProperty =
                        toPascalCase(instanceKey)

                    // Create new SubTypes
                    const newSubTypes = []
                    let isFirstSubType = true
                    
                    // Check if this is a timer variable
                    const isTimer = String(instanceKey).toLowerCase().includes("timer")
                    
                    // Get the default model path (use first successful conversion result)
                    const defaultResult = successfulResults[0]
                    if (!defaultResult || !defaultResult.modelPath) {
                        throw new Error("No successful model conversions found for default subtype")
                    }
                    const defaultModelPath = defaultResult.modelPath
                    
                    // Create a map of value -> model path for quick lookup
                    const valueToModelMap = new Map()
                    for (const [
                        value,
                        instancePath,
                    ] of finalInstanceMap.entries()) {
                        // For timer variables, only consider values 0-30
                        if (isTimer) {
                            const numValue = Number(value)
                            if (isNaN(numValue) || numValue < 0 || numValue > 30) {
                                continue // Skip values outside 0-30 range for timers
                            }
                        }
                        const result = conversionResults.find(
                            (r) => r.instancePath === instancePath,
                        )
                        if (result && result.modelPath) {
                            valueToModelMap.set(String(value), result.modelPath)
                        }
                    }
                    
                    if (isTimer) {
                        // For timer variables: ALWAYS generate exactly 31 subtypes (0-30)
                        console.log("Timer variable detected: Generating exactly 31 subtypes (0-30)")
                        for (let i = 0; i <= 30; i++) {
                            const valueStr = String(i)
                            const modelPath = valueToModelMap.get(valueStr) || defaultModelPath
                            
                            let newSubType

                            if (isFirstSubType) {
                                // First SubType: Keep everything (Palette, Sounds, Animations, etc.)
                                newSubType = JSON.parse(
                                    JSON.stringify(baseSubType),
                                ) // Deep clone
                                isFirstSubType = false
                            } else {
                                // Other SubTypes: Name, Model, Sounds, Animations (NO Palette)
                                newSubType = {
                                    Name: baseSubType.Name,
                                    Model: {},
                                }

                                // Copy Sounds if present
                                if (baseSubType.Sounds) {
                                    newSubType.Sounds = JSON.parse(
                                        JSON.stringify(baseSubType.Sounds),
                                    )
                                }

                                // Copy Animations if present
                                if (baseSubType.Animations) {
                                    newSubType.Animations = JSON.parse(
                                        JSON.stringify(baseSubType.Animations),
                                    )
                                }
                            }

                            // Update model path (MDL for display)
                            if (!newSubType.Model) {
                                newSubType.Model = {}
                            }
                            newSubType.Model.ModelName = modelPath

                            // Keep the name as-is (don't add variant number)
                            newSubType.Name = baseSubType.Name

                            newSubTypes.push(newSubType)
                        }
                    } else {
                        // For non-timer variables: generate subtypes based on actual models found
                        for (const [
                            value,
                            instancePath,
                        ] of finalInstanceMap.entries()) {
                            const result = conversionResults.find(
                                (r) => r.instancePath === instancePath,
                            )
                            if (result && result.modelPath) {
                                let newSubType

                                if (isFirstSubType) {
                                    // First SubType: Keep everything (Palette, Sounds, Animations, etc.)
                                    newSubType = JSON.parse(
                                        JSON.stringify(baseSubType),
                                    ) // Deep clone
                                    isFirstSubType = false
                                } else {
                                    // Other SubTypes: Name, Model, Sounds, Animations (NO Palette)
                                    newSubType = {
                                        Name: baseSubType.Name,
                                        Model: {},
                                    }

                                    // Copy Sounds if present
                                    if (baseSubType.Sounds) {
                                        newSubType.Sounds = JSON.parse(
                                            JSON.stringify(baseSubType.Sounds),
                                        )
                                    }

                                    // Copy Animations if present
                                    if (baseSubType.Animations) {
                                        newSubType.Animations = JSON.parse(
                                            JSON.stringify(baseSubType.Animations),
                                        )
                                    }
                                }

                                // Update model path (MDL for display)
                                if (!newSubType.Model) {
                                    newSubType.Model = {}
                                }
                                newSubType.Model.ModelName = result.modelPath

                                // Keep the name as-is (don't add variant number)
                                newSubType.Name = baseSubType.Name

                                newSubTypes.push(newSubType)
                            }
                        }
                    }

                    // Safety check: For timer variables, ensure exactly 31 subtypes
                    if (isTimer && newSubTypes.length !== 31) {
                        console.error(
                            `❌ ERROR: Generated ${newSubTypes.length} subtypes for timer, expected 31. Trimming to exactly 31.`,
                        )
                        // Trim to exactly 31 (keep first 31)
                        newSubTypes.splice(31)
                    }

                    // Replace existing SubTypes with the new ones
                    editorItems.Item.Editor.SubType = newSubTypes
                    item.saveEditorItems(editorItems)

                    console.log(
                        `📝 Updated editoritems.json with ${newSubTypes.length} SubTypes${isTimer ? " (timer: exactly 31)" : ""}`,
                    )

                    // Show summary dialog
                    const dialogOptions = {
                        title: "Multi-Model Generation Complete",
                        message: `Successfully converted ${successfulResults.length} of ${conversionResults.length} models.`,
                    }

                    if (failedResults.length > 0) {
                        dialogOptions.type = "warning"
                        dialogOptions.detail = `Failed conversions:\n${failedResults.map((r) => `• ${path.basename(r.instancePath)}: ${r.error}`).join("\n")}`
                    } else {
                        dialogOptions.type = "info"
                        dialogOptions.detail = `All models converted successfully and editoritems.json has been updated with ${newSubTypes.length} SubTypes.`
                    }

                    dialog.showMessageBox(dialogOptions)

                    return { success: true, results: conversionResults }
                }

                // --- Original single-instance conversion logic ---
                const instance = item.instances?.[instanceKey]
                if (!instance?.Name) throw new Error("Instance not found")

                // Resolve clean on-disk path (removes BEE2 prefix, ensures instances/ prefix)
                const vmfPath = Instance.getCleanPath(
                    item.packagePath,
                    instance.Name,
                )

                // Create temp directory for models in package root
                const tempDir = path.join(item.packagePath, "temp_models")
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true })
                }

                const result = await convertVmfToObj(vmfPath, {
                    outputDir: tempDir,
                    textureStyle: options.textureStyle || "cartoon",
                })
                // Compute output paths for convenience
                const fileBase = path.basename(vmfPath, path.extname(vmfPath))
                const objPath = path.join(tempDir, `${fileBase}.obj`)
                const mtlPath = path.join(tempDir, `${fileBase}.mtl`)

                // ===== NEW: Convert OBJ to MDL and update editoritems =====
                let mdlResult = null
                try {
                    console.log("🎯 Starting MDL conversion process...")
                    const {
                        convertAndInstallMDL,
                    } = require("./utils/mdlConverter")

                    // Use item ID as the model name to ensure uniqueness
                    // Remove any special characters and make it safe for file names
                    const itemName = item.id
                        .replace(/[^a-zA-Z0-9_-]/g, "_")
                        .toLowerCase()

                    // Convert OBJ to MDL and install in package
                    mdlResult = await convertAndInstallMDL(
                        objPath,
                        item.packagePath,
                        itemName,
                        { scale: options.scale || 1.0 },
                    )

                    // Update editoritems.json to reference the custom model
                    if (mdlResult.success && mdlResult.relativeModelPath) {
                        console.log(
                            "📝 Updating editoritems.json with custom model...",
                        )

                        const editorItems = item.getEditorItems()
                        const subType = Array.isArray(
                            editorItems.Item.Editor.SubType,
                        )
                            ? editorItems.Item.Editor.SubType[0]
                            : editorItems.Item.Editor.SubType

                        // Add or update the Model section
                        if (!subType.Model) {
                            subType.Model = {}
                        }
                        subType.Model.ModelName = mdlResult.relativeModelPath

                        // Add 3DS collision model if available
                        // DISABLED: Don't include 3DS files in editoritems.txt
                        // if (mdlResult.threeDSResult?.relativeModelPath) {
                        //     subType.Model.CollisionModelName = mdlResult.threeDSResult.relativeModelPath
                        // }

                        // If SubType was not an array, convert it to an array
                        if (!Array.isArray(editorItems.Item.Editor.SubType)) {
                            editorItems.Item.Editor.SubType = [subType]
                        }

                        item.saveEditorItems(editorItems)

                        console.log(
                            `✅ Updated editoritems with model: ${mdlResult.relativeModelPath}`,
                        )
                        if (mdlResult.threeDSResult?.relativeModelPath) {
                            console.log(
                                `✅ Updated editoritems with collision: ${mdlResult.threeDSResult.relativeModelPath}`,
                            )
                        }
                    }
                } catch (mdlError) {
                    console.error("❌ MDL conversion failed:", mdlError)
                    // Don't throw - allow OBJ generation to succeed even if MDL fails
                    mdlResult = {
                        success: false,
                        error: mdlError.message,
                    }
                }
                // ===== END MDL CONVERSION =====

                return {
                    success: true,
                    vmfPath,
                    tempDir,
                    objPath,
                    mtlPath,
                    mdlResult,
                    ...result,
                }
            } catch (error) {
                const details = [
                    error.message,
                    error.stack ? `stack:\n${error.stack}` : null,
                    error.cmd ? `cmd: ${error.cmd}` : null,
                    error.cwd ? `cwd: ${error.cwd}` : null,
                ]
                    .filter(Boolean)
                    .join("\n")
                dialog.showErrorBox("VMF to OBJ Conversion Failed", details)
                return {
                    success: false,
                    error: error.message,
                    cmd: error.cmd,
                    cwd: error.cwd,
                }
            }
        },
    )

    // Allow configuring extra resource paths (folders or VPKs)
    ipcMain.handle("set-extra-resource-paths", async (event, { paths }) => {
        try {
            setExtraResourcePaths(paths)
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })
    ipcMain.handle("get-extra-resource-paths", async () => {
        try {
            const paths = getExtraResourcePaths()
            return { success: true, paths }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })
    ipcMain.handle("find-portal2-resources", async () => {
        try {
            const { findPortal2Resources } = require("./data")
            const resources = await findPortal2Resources(console)
            return { success: true, ...resources }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Get file stats (size, modified date, etc.)
    ipcMain.handle("get-file-stats", async (event, { filePath }) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: "File not found" }
            }
            const stats = fs.statSync(filePath)
            return {
                success: true,
                size: stats.size,
                modified: stats.mtime,
                created: stats.ctime,
            }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // Show file in file explorer
    ipcMain.handle("show-item-in-folder", async (event, { filePath }) => {
        try {
            const { shell } = require("electron")
            if (!fs.existsSync(filePath)) {
                // If file doesn't exist, show the directory instead
                const dir = path.dirname(filePath)
                if (fs.existsSync(dir)) {
                    shell.showItemInFolder(dir)
                    return { success: true }
                } else {
                    return { success: false, error: "Directory not found" }
                }
            }
            shell.showItemInFolder(filePath)
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    })

    // VBSP conversion handler
    ipcMain.handle("convert-blocks-to-vbsp", async (event, { blocks }) => {
        try {
            // Print blocks JSON only (for conversion calls too)
            if (blocks) {
                console.log(JSON.stringify(blocks, null, 2))
            }

            // Create a temporary item instance to use the conversion method
            const tempItem = {
                convertBlocksToVbsp: function (blockList) {
                    const vbspConditions = {
                        Conditions: {},
                    }

                    // Helper function to convert boolean values
                    function convertBooleanValue(value, variableName = "") {
                        // If value is explicitly provided, convert it
                        if (
                            value !== undefined &&
                            value !== null &&
                            value !== ""
                        ) {
                            if (value === true || value === "true") return "1"
                            if (value === false || value === "false") return "0"
                            return value.toString()
                        }

                        // If no value provided, check if it's a boolean variable and provide default
                        if (variableName) {
                            // Remove $ prefix if present for comparison
                            const cleanVariableName = variableName.replace(
                                /^\$/,
                                "",
                            )

                            // Check if the variable name suggests it's a boolean variable
                            const booleanVariables = [
                                "StartEnabled",
                                "StartActive",
                                "StartDeployed",
                                "StartOpen",
                                "StartLocked",
                                "StartReversed",
                                "AutoDrop",
                                "AutoRespawn",
                            ]
                            if (
                                booleanVariables.some((v) =>
                                    cleanVariableName.includes(v),
                                )
                            ) {
                                // For boolean variables, default to '1' (true)
                                return "1"
                            }
                        }

                        // For other cases, return '1' as a sensible default
                        return "1"
                    }

                    // Convert a single block to VBSP format
                    function convertBlockToVbsp(block) {
                        // Helper function to process child blocks
                        function processChildBlocks(
                            childBlocks,
                            containerName,
                        ) {
                            if (!childBlocks || childBlocks.length === 0)
                                return {}

                            const result = {}

                            function addMulti(obj, key, value) {
                                if (obj[key] === undefined) {
                                    obj[key] = value
                                } else if (Array.isArray(obj[key])) {
                                    obj[key].push(value)
                                } else {
                                    obj[key] = [obj[key], value]
                                }
                            }

                            childBlocks.forEach((childBlock) => {
                                const childVbsp = convertBlockToVbsp(childBlock)

                                if (
                                    childBlock.type === "if" ||
                                    childBlock.type === "ifElse"
                                ) {
                                    addMulti(result, "Condition", childVbsp)
                                    return
                                }
                                if (
                                    childBlock.type === "switchCase" ||
                                    childBlock.type === "switchGlobal"
                                ) {
                                    const inner =
                                        childVbsp.Switch ||
                                        childVbsp.switch ||
                                        childVbsp
                                    addMulti(result, "Switch", inner)
                                    return
                                }

                                Object.assign(result, childVbsp)
                            })
                            return result
                        }

                        switch (block.type) {
                            case "if":
                                const ifValue = convertBooleanValue(
                                    block.value,
                                    block.variable,
                                )
                                const ifOperator = block.operator || "=="
                                const ifResult = {
                                    instVar: `${block.variable || ""} ${ifOperator} ${ifValue}`,
                                }

                                if (
                                    block.thenBlocks &&
                                    block.thenBlocks.length > 0
                                ) {
                                    const thenResult = processChildBlocks(
                                        block.thenBlocks,
                                        "thenBlocks",
                                    )
                                    ifResult.Result = thenResult
                                }

                                return ifResult

                            case "ifElse":
                                const ifElseValue = convertBooleanValue(
                                    block.value,
                                    block.variable,
                                )
                                const ifElseOperator = block.operator || "=="
                                const ifElseResult = {
                                    instVar: `${block.variable || ""} ${ifElseOperator} ${ifElseValue}`,
                                }

                                if (
                                    block.thenBlocks &&
                                    block.thenBlocks.length > 0
                                ) {
                                    const thenResult = processChildBlocks(
                                        block.thenBlocks,
                                        "thenBlocks",
                                    )
                                    ifElseResult.Result = thenResult
                                }

                                if (
                                    block.elseBlocks &&
                                    block.elseBlocks.length > 0
                                ) {
                                    const elseResult = processChildBlocks(
                                        block.elseBlocks,
                                        "elseBlocks",
                                    )
                                    ifElseResult.Else = elseResult
                                }

                                return ifElseResult

                            case "ifHas":
                                const ifHasResult = {
                                    styleVar: block.value || "",
                                }

                                if (
                                    block.thenBlocks &&
                                    block.thenBlocks.length > 0
                                ) {
                                    const thenResult = processChildBlocks(
                                        block.thenBlocks,
                                        "thenBlocks",
                                    )
                                    ifHasResult.Result = thenResult
                                }

                                return ifHasResult

                            case "ifHasElse":
                                const ifHasElseResult = {
                                    styleVar: block.value || "",
                                }

                                if (
                                    block.thenBlocks &&
                                    block.thenBlocks.length > 0
                                ) {
                                    const thenResult = processChildBlocks(
                                        block.thenBlocks,
                                        "thenBlocks",
                                    )
                                    ifHasElseResult.Result = thenResult
                                }

                                if (
                                    block.elseBlocks &&
                                    block.elseBlocks.length > 0
                                ) {
                                    const elseResult = processChildBlocks(
                                        block.elseBlocks,
                                        "elseBlocks",
                                    )
                                    ifHasElseResult.Else = elseResult
                                }

                                return ifHasElseResult

                            case "switchCase": {
                                const variable = block.variable || ""
                                const variableWithDollar = variable.startsWith(
                                    "$",
                                )
                                    ? variable
                                    : variable
                                      ? `$${variable}`
                                      : ""
                                const switchObj = {
                                    Switch: {
                                        method: block.method || "first",
                                        test: "instvar",
                                    },
                                }

                                if (Array.isArray(block.cases)) {
                                    for (const caseBlock of block.cases) {
                                        const arg =
                                            caseBlock &&
                                            caseBlock.value !== undefined &&
                                            caseBlock.value !== null &&
                                            caseBlock.value !== ""
                                                ? `${variableWithDollar} ${convertBooleanValue(caseBlock.value, variableWithDollar)}`
                                                : "<default>"
                                        const caseResults = processChildBlocks(
                                            caseBlock?.thenBlocks || [],
                                            "thenBlocks",
                                        )
                                        switchObj.Switch[arg] = caseResults
                                    }
                                }
                                return switchObj
                            }
                            case "switchGlobal": {
                                const testName = block.test || "styleVar"
                                const switchObj = {
                                    Switch: {
                                        method: block.method || "first",
                                        test: testName,
                                    },
                                }

                                if (Array.isArray(block.cases)) {
                                    for (const caseBlock of block.cases) {
                                        const arg =
                                            caseBlock &&
                                            caseBlock.value !== undefined &&
                                            caseBlock.value !== null &&
                                            caseBlock.value !== ""
                                                ? `${caseBlock.value}`
                                                : "<default>"
                                        const caseResults = processChildBlocks(
                                            caseBlock?.thenBlocks || [],
                                            "thenBlocks",
                                        )
                                        switchObj.Switch[arg] = caseResults
                                    }
                                }
                                return switchObj
                            }

                            case "case":
                                const caseResult = {}

                                if (
                                    block.thenBlocks &&
                                    block.thenBlocks.length > 0
                                ) {
                                    const thenResult = processChildBlocks(
                                        block.thenBlocks,
                                        "thenBlocks",
                                    )
                                    Object.assign(caseResult, thenResult)
                                }

                                return caseResult

                            case "changeInstance":
                                return {
                                    changeInstance: block.instanceName || "",
                                }

                            case "addOverlay":
                                return {
                                    addOverlay: block.overlayName || "",
                                }

                            case "addGlobalEnt":
                                return {
                                    addGlobalEnt: block.instanceName || "",
                                }

                            case "offsetInstance":
                                return {
                                    offsetInstance: `${block.instanceName || ""} ${block.offset || "0 0 0"}`,
                                }

                            case "mapInstVar":
                                const mapResult = {}
                                if (
                                    block.sourceVariable &&
                                    block.targetVariable
                                ) {
                                    mapResult.setInstVar = `${block.targetVariable} ${block.sourceVariable}`
                                }
                                if (
                                    block.mappings &&
                                    Object.keys(block.mappings).length > 0
                                ) {
                                    Object.assign(mapResult, block.mappings)
                                }
                                return mapResult

                            case "debug":
                                return {
                                    debug: block.message || "",
                                }

                            default:
                                return {
                                    unknown: {
                                        type: block.type,
                                        data: block,
                                    },
                                }
                        }
                    }

                    // Process each top-level block and create Condition objects
                    const conditions = []
                    blockList.forEach((block, index) => {
                        const vbspBlock = convertBlockToVbsp(block)
                        conditions.push(vbspBlock)
                    })

                    // If there's only one condition, use a single object
                    // If there are multiple conditions, use an array
                    if (conditions.length === 1) {
                        vbspConditions.Conditions.Condition = conditions[0]
                    } else if (conditions.length > 1) {
                        vbspConditions.Conditions.Condition = conditions
                    }

                    return vbspConditions
                },
            }

            const vbspConfig = tempItem.convertBlocksToVbsp(blocks)
            return { success: true, vbspConfig }
        } catch (error) {
            console.error("Failed to convert blocks to VBSP:", error)
            return { success: false, error: error.message }
        }
    })

    // ============================================
    // AUTO-UPDATER IPC HANDLERS
    // ============================================

    // Check for updates manually (triggered by user)
    ipcMain.handle("check-for-updates", async () => {
        const { AutoUpdater } = require("./autoUpdater")
        // Get updater instance from main.js global
        if (global.updaterInstance) {
            await global.updaterInstance.checkForUpdates(false)
            return { success: true }
        }
        return { success: false, error: "Updater not initialized" }
    })

    // Download update
    ipcMain.handle("download-update", async () => {
        if (global.updaterInstance) {
            global.updaterInstance.downloadUpdate()
            return { success: true }
        }
        return { success: false, error: "Updater not initialized" }
    })

    // Install update and restart
    ipcMain.handle("quit-and-install", async () => {
        if (global.updaterInstance) {
            global.updaterInstance.quitAndInstall()
            return { success: true }
        }
        return { success: false, error: "Updater not initialized" }
    })
}

module.exports = { reg_events }
