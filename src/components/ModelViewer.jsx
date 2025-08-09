import { Suspense, useRef, useEffect, useState } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { OrbitControls, useGLTF, Center, Text, Html } from "@react-three/drei"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader"
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader"
import * as THREE from "three"
import { Box, CircularProgress, Typography, Switch, FormControlLabel, Button } from "@mui/material"

// Component to load and display OBJ model
function Model({ objPath, mtlPath, fullbright = false, onMaterialsLoaded }) {
    const groupRef = useRef()

    // Load MTL file if available
    const materials = mtlPath ? useLoader(MTLLoader, mtlPath) : null

    // Notify parent component when materials are loaded
    useEffect(() => {
        if (materials && onMaterialsLoaded) {
            onMaterialsLoaded(materials)
        }
    }, [materials, onMaterialsLoaded])

    // Load OBJ file
    const obj = useLoader(OBJLoader, objPath, (loader) => {
        if (materials) {
            // Apply materials to the loader
            materials.preload()
            loader.setMaterials(materials)
        }
    })

    // Auto-rotate the model slightly
    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.005
        }
    })

    useEffect(() => {
        if (obj && groupRef.current) {
            // Center the model
            const box = new THREE.Box3().setFromObject(obj)
            const center = box.getCenter(new THREE.Vector3())
            obj.position.sub(center)

            // Scale model to fit nicely in view
            const size = box.getSize(new THREE.Vector3())
            const maxDim = Math.max(size.x, size.y, size.z)
            if (maxDim > 0) {
                const scale = 3 / maxDim
                obj.scale.setScalar(scale)
            }
            
            // Apply fullbright mode if enabled
            if (fullbright) {
                obj.traverse((child) => {
                    if (child.isMesh && child.material) {
                        // Create fullbright material
                        const fullbrightMat = new THREE.MeshBasicMaterial({
                            map: child.material.map,
                            normalMap: child.material.normalMap,
                            color: child.material.color || new THREE.Color(0xffffff),
                            transparent: child.material.transparent,
                            opacity: child.material.opacity || 1.0,
                            side: child.material.side || THREE.FrontSide
                        })
                        child.material = fullbrightMat
                    }
                })
            }
            
            // Force proper material types and fix common issues
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mat = child.material
                    const isBrush = child.name?.includes('brush') || 
                                   child.name?.includes('Brush') || 
                                   child.name?.includes('displacement') ||
                                   child.name?.includes('tool') ||
                                   child.name?.includes('Tool') ||
                                   child.name?.includes('prop') ||
                                   child.name?.includes('Prop')
                    
                    // Special handling for brush materials
                    if (isBrush) {
                        // Try to force texture loading for brushes
                        if (!mat.map && materials && materials.materials) {
                            // Look for material with same name in MTL
                            const mtlMaterial = materials.materials[mat.name]
                            if (mtlMaterial && mtlMaterial.map) {
                                mat.map = mtlMaterial.map
                                mat.needsUpdate = true
                            }
                        }
                    }
                    
                    // Force MeshStandardMaterial for better texture handling
                    if (mat.type !== 'MeshStandardMaterial' && !fullbright) {
                        const newMat = new THREE.MeshStandardMaterial({
                            map: mat.map,
                            normalMap: mat.normalMap,
                            color: mat.color || new THREE.Color(0x888888),
                            roughness: 0.8,
                            metalness: 0.2,
                            transparent: mat.transparent,
                            opacity: mat.opacity || 1.0,
                            side: mat.side || THREE.FrontSide
                        })
                        child.material = newMat
                    }
                }
            })
            
            // Apply fallback materials for any materials without textures
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mat = child.material
                    
                    // If no texture map, create a colored material
                    if (!mat.map && !mat.color) {
                        mat.color = new THREE.Color(0x888888) // Default gray
                        mat.needsUpdate = true
                    }
                    
                    // Ensure material is properly configured
                    if (mat.map) {
                        mat.map.needsUpdate = true
                        mat.needsUpdate = true
                    }
                }
            })
        }
    }, [obj, fullbright])

    if (!obj) return null

    return (
        <group ref={groupRef}>
            <primitive object={obj} />
        </group>
    )
}

// Loading component
function Loading() {
    return (
        <Html center>
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={2}>
                <CircularProgress size={40} />
                <Typography variant="body2" color="textSecondary">
                    Loading 3D model...
                </Typography>
            </Box>
        </Html>
    )
}

// Error fallback component
function ModelError({ error }) {
    return (
        <Html center>
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={1}
                maxWidth={300}>
                <Typography variant="body2" color="error" align="center">
                    Could not load 3D model
                </Typography>
                <Typography
                    variant="caption"
                    color="textSecondary"
                    align="center">
                    {error?.message || "Unknown error"}
                </Typography>
            </Box>
        </Html>
    )
}

// Main ModelViewer component
export default function ModelViewer({
    objPath,
    mtlPath,
    width = 400,
    height = 300,
}) {
    const [fullbright, setFullbright] = useState(false)
    const [showDebug, setShowDebug] = useState(false)
    const [materials, setMaterials] = useState(null)

    const handleMaterialsLoaded = (loadedMaterials) => {
        setMaterials(loadedMaterials)
    }

    if (!objPath) {
        return (
            <Box
                width={width}
                height={height}
                display="flex"
                alignItems="center"
                justifyContent="center"
                bgcolor="grey.100"
                border={1}
                borderColor="grey.300"
                borderRadius={1}>
                <Typography variant="body2" color="textSecondary">
                    No model path provided
                </Typography>
            </Box>
        )
    }

    return (
        <Box
            width={width}
            height={height}
            border={1}
            borderColor="grey.300"
            borderRadius={1}
            overflow="hidden">
            
            {/* Controls Bar */}
            <Box 
                sx={{ 
                    p: 1, 
                    bgcolor: 'grey.50', 
                    borderBottom: 1, 
                    borderColor: 'grey.300',
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center'
                }}
            >
                <FormControlLabel
                    control={
                        <Switch
                            checked={fullbright}
                            onChange={(e) => setFullbright(e.target.checked)}
                            size="small"
                        />
                    }
                    label="Fullbright"
                    labelPlacement="start"
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={showDebug}
                            onChange={(e) => setShowDebug(e.target.checked)}
                            size="small"
                        />
                    }
                    label="Debug Info"
                    labelPlacement="start"
                />
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        // Test texture loading
                        const testTexture = new THREE.TextureLoader().load(
                            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGHwBAABgAB6kGv1QAAAABJRU5ErkJggg==',
                            (tex) => console.log("Test texture loaded successfully"),
                            undefined,
                            (err) => console.log("Test texture failed:", err)
                        )
                    }}
                >
                    Test Textures
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        // Inspect MTL file contents
                        if (materials && materials.materials) {
                            console.log("MTL Materials:", Object.keys(materials.materials))
                        } else {
                            console.log("No materials loaded")
                        }
                    }}
                >
                    Inspect MTL
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        // Debug brush materials specifically
                        if (materials && materials.materials) {
                            const brushMaterials = Object.keys(materials.materials).filter(name => 
                                name.toLowerCase().includes('brush') || 
                                name.toLowerCase().includes('displacement') ||
                                name.toLowerCase().includes('tool')
                            )
                            
                            console.log(`Found ${brushMaterials.length} brush materials:`, brushMaterials)
                        } else {
                            console.log("No materials loaded")
                        }
                    }}
                >
                    Debug Brushes
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        // Show material summary
                        if (materials && materials.materials) {
                            const allMaterials = Object.keys(materials.materials)
                            const withTextures = allMaterials.filter(name => {
                                const mat = materials.materials[name]
                                return mat.map && mat.map.image
                            })
                            const brushMaterials = allMaterials.filter(name => 
                                name.toLowerCase().includes('brush') || 
                                name.toLowerCase().includes('displacement') ||
                                name.toLowerCase().includes('tool')
                            )
                            
                            console.log(`Summary: ${allMaterials.length} total, ${withTextures.length} with textures, ${brushMaterials.length} brush materials`)
                        } else {
                            console.log("No materials loaded")
                        }
                    }}
                >
                    Material Summary
                </Button>
            </Box>

            <Canvas
                camera={{
                    position: [5, 5, 5],
                    fov: 50,
                    near: 0.1,
                    far: 1000,
                }}
                style={{ background: "#f5f5f5" }}>
                
                {/* Conditional Lighting */}
                {!fullbright ? (
                    <>
                        {/* Enhanced lighting for normal mode */}
                        <ambientLight intensity={0.8} />
                        <directionalLight
                            position={[10, 10, 5]}
                            intensity={1.2}
                            castShadow
                            shadow-mapSize-width={2048}
                            shadow-mapSize-height={2048}
                        />
                        <directionalLight 
                            position={[-10, -10, 5]} 
                            intensity={0.6} 
                        />
                        <directionalLight 
                            position={[0, -10, 0]} 
                            intensity={0.4} 
                        />
                        <hemisphereLight 
                            intensity={0.3} 
                            groundColor="#404040" 
                        />
                    </>
                ) : (
                    // No lighting for fullbright mode
                    null
                )}

                {/* Controls */}
                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    maxPolarAngle={Math.PI}
                    minDistance={1}
                    maxDistance={50}
                />

                {/* Model */}
                <Suspense fallback={<Loading />}>
                    <Center>
                        <Model 
                            objPath={objPath} 
                            mtlPath={mtlPath} 
                            fullbright={fullbright}
                            onMaterialsLoaded={handleMaterialsLoaded}
                        />
                    </Center>
                </Suspense>

                {/* Debug Info Overlay */}
                {showDebug && (
                    <Html position={[0, 3, 0]}>
                        <Box
                            sx={{
                                bgcolor: 'rgba(0,0,0,0.8)',
                                color: 'white',
                                p: 1,
                                borderRadius: 1,
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <div>Fullbright: {fullbright ? 'ON' : 'OFF'}</div>
                            <div>OBJ: {objPath.split('/').pop()}</div>
                            <div>MTL: {mtlPath ? mtlPath.split('/').pop() : 'None'}</div>
                            {materials && (
                                <>
                                    <div>Materials: {Object.keys(materials.materials || {}).length}</div>
                                    <div>Brush Materials: {Object.keys(materials.materials || {}).filter(name => 
                                        name.toLowerCase().includes('brush') || 
                                        name.toLowerCase().includes('displacement') ||
                                        name.toLowerCase().includes('tool')
                                    ).length}</div>
                                    <div>With Textures: {Object.keys(materials.materials || {}).filter(name => {
                                        const mat = materials.materials[name]
                                        return mat.map && mat.map.image
                                    }).length}</div>
                                </>
                            )}
                        </Box>
                    </Html>
                )}
            </Canvas>
        </Box>
    )
}

// Error boundary wrapper
export function ModelViewerWithErrorBoundary({
    objPath,
    mtlPath,
    width,
    height,
}) {
    try {
        return (
            <ModelViewer
                objPath={objPath}
                mtlPath={mtlPath}
                width={width}
                height={height}
            />
        )
    } catch (error) {
        return (
            <Box
                width={width || 400}
                height={height || 300}
                display="flex"
                alignItems="center"
                justifyContent="center"
                bgcolor="grey.100"
                border={1}
                borderColor="error.main"
                borderRadius={1}>
                <ModelError error={error} />
            </Box>
        )
    }
}
