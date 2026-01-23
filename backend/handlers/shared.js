/**
 * Shared state and helper functions for IPC handlers
 */

const { BrowserWindow, dialog } = require("electron")
const fs = require("fs")
const path = require("path")
const { saveItem } = require("../saveItem")
const { Item } = require("../models/items")
const { packages } = require("../packageManager")
const { sendItemUpdateToEditor } = require("../items/itemEditor")

// Track last saved .bpee path in memory
let lastSavedBpeePath = null

// Track open preview windows to prevent duplicates
const openPreviewWindows = new Map()

/**
 * Get the last saved .bpee path
 */
function getLastSavedBpeePath() {
    return lastSavedBpeePath
}

/**
 * Set the last saved .bpee path
 */
function setLastSavedBpeePath(bpeePath) {
    lastSavedBpeePath = bpeePath
}

/**
 * Helper to load original itemJSON from info.json
 */
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

/**
 * Create an icon preview window
 */
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

/**
 * Create a 3D model preview window
 */
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

/**
 * Handle item save logic - shared by multiple handlers
 */
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

        // Also notify the editor window through the dedicated function
        sendItemUpdateToEditor(item.id, updatedItem)

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

module.exports = {
    getLastSavedBpeePath,
    setLastSavedBpeePath,
    openPreviewWindows,
    loadOriginalItemJSON,
    createIconPreviewWindow,
    createModelPreviewWindow,
    handleItemSave,
}
