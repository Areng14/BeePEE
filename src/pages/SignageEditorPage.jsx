import { useState, useRef, useEffect } from "react"
import { Box, Paper, TextField, Button, IconButton, ToggleButton, Divider, Tooltip } from "@mui/material"
import { Save, Delete, AlignHorizontalLeft, AlignHorizontalCenter, AlignHorizontalRight, AlignVerticalTop, AlignVerticalCenter, AlignVerticalBottom, GridOn } from "@mui/icons-material"

function SignageEditorPage() {
    const canvasRef = useRef(null)
    const [presetImages, setPresetImages] = useState([])
    const [backgroundImage, setBackgroundImage] = useState(null)
    const [placedElements, setPlacedElements] = useState([])
    const [selectedElementIndex, setSelectedElementIndex] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [draggedImage, setDraggedImage] = useState(null)
    const [isMoving, setIsMoving] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [isRotating, setIsRotating] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [signageName, setSignageName] = useState("")
    const [resizeHandle, setResizeHandle] = useState(null)
    const [showGrid, setShowGrid] = useState(true)
    const [snapToGrid, setSnapToGrid] = useState(false)
    const [gridSize, setGridSize] = useState(32)

    // Load background image (signage_blank.png)
    useEffect(() => {
        const img = new Image()
        img.src = "beep://public/signage_blank.png"
        img.onload = () => {
            setBackgroundImage(img)
        }
    }, [])

    // Load preset images from signagePresets folder
    useEffect(() => {
        const loadPresets = async () => {
            try {
                const presets = await window.package.getSignagePresets()
                console.log("Loaded signage presets:", presets)
                setPresetImages(presets)
            } catch (error) {
                console.error("Failed to load presets:", error)
            }
        }
        loadPresets()
    }, [])

    // Helper function to snap to grid
    const snapToGridValue = (value) => {
        if (!snapToGrid) return value
        return Math.round(value / gridSize) * gridSize
    }

    // Draw canvas
    useEffect(() => {
        if (!canvasRef.current || !backgroundImage) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw background
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)

        // Draw grid if enabled
        if (showGrid) {
            ctx.strokeStyle = "rgba(100, 100, 100, 0.3)"
            ctx.lineWidth = 1
            ctx.setLineDash([])
            
            // Vertical lines
            for (let x = 0; x <= canvas.width; x += gridSize) {
                ctx.beginPath()
                ctx.moveTo(x, 0)
                ctx.lineTo(x, canvas.height)
                ctx.stroke()
            }
            
            // Horizontal lines
            for (let y = 0; y <= canvas.height; y += gridSize) {
                ctx.beginPath()
                ctx.moveTo(0, y)
                ctx.lineTo(canvas.width, y)
                ctx.stroke()
            }
        }

        // Draw placed elements
        placedElements.forEach((element, index) => {
            if (element.image.complete) {
                ctx.save()
                
                // Apply transformations
                const centerX = element.x + element.width / 2
                const centerY = element.y + element.height / 2
                ctx.translate(centerX, centerY)
                ctx.rotate((element.rotation || 0) * Math.PI / 180)
                ctx.translate(-centerX, -centerY)
                
                // Draw image
                ctx.drawImage(
                    element.image,
                    element.x,
                    element.y,
                    element.width,
                    element.height
                )
                
                ctx.restore()

                // Draw selection outline and handles if selected
                if (index === selectedElementIndex) {
                    ctx.strokeStyle = "#00bfff"
                    ctx.lineWidth = 2
                    ctx.setLineDash([5, 5])
                    
                    ctx.save()
                    ctx.translate(centerX, centerY)
                    ctx.rotate((element.rotation || 0) * Math.PI / 180)
                    ctx.translate(-centerX, -centerY)
                    
                    ctx.strokeRect(element.x, element.y, element.width, element.height)
                    
                    // Draw corner resize handles
                    ctx.setLineDash([])
                    ctx.fillStyle = "#00bfff"
                    const handleSize = 8
                    const corners = [
                        { x: element.x, y: element.y }, // top-left
                        { x: element.x + element.width, y: element.y }, // top-right
                        { x: element.x, y: element.y + element.height }, // bottom-left
                        { x: element.x + element.width, y: element.y + element.height }, // bottom-right
                    ]
                    corners.forEach((corner) => {
                        ctx.fillRect(
                            corner.x - handleSize / 2,
                            corner.y - handleSize / 2,
                            handleSize,
                            handleSize
                        )
                    })
                    
                    // Draw rotation handle
                    ctx.fillStyle = "#ff6b6b"
                    ctx.beginPath()
                    ctx.arc(centerX, element.y - 20, 6, 0, 2 * Math.PI)
                    ctx.fill()
                    
                    ctx.restore()
                }
            }
        })
    }, [backgroundImage, placedElements, selectedElementIndex, showGrid, gridSize])

    const handleCanvasDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
    }

    const handleCanvasDrop = (e) => {
        e.preventDefault()
        
        if (!draggedImage) return

        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const x = snapToGridValue(e.clientX - rect.left - 50)
        const y = snapToGridValue(e.clientY - rect.top - 50)

        // Add the dropped image to placed elements
        const newElement = {
            image: draggedImage,
            presetSrc: draggedImage.src, // Store the preset source URL for saving
            x: x, // Center on cursor
            y: y,
            width: 100,
            height: 100,
            rotation: 0,
        }

        setPlacedElements([...placedElements, newElement])
        setDraggedImage(null)
        setIsDragging(false)
    }

    const getMousePos = (e) => {
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        }
    }

    const getHandleAtPosition = (element, mousePos) => {
        const handleSize = 8
        const corners = [
            { name: "tl", x: element.x, y: element.y },
            { name: "tr", x: element.x + element.width, y: element.y },
            { name: "bl", x: element.x, y: element.y + element.height },
            { name: "br", x: element.x + element.width, y: element.y + element.height },
        ]
        
        for (const corner of corners) {
            if (
                mousePos.x >= corner.x - handleSize / 2 &&
                mousePos.x <= corner.x + handleSize / 2 &&
                mousePos.y >= corner.y - handleSize / 2 &&
                mousePos.y <= corner.y + handleSize / 2
            ) {
                return corner.name
            }
        }
        
        // Check rotation handle
        const centerX = element.x + element.width / 2
        const rotHandleY = element.y - 20
        const dist = Math.sqrt(
            Math.pow(mousePos.x - centerX, 2) + Math.pow(mousePos.y - rotHandleY, 2)
        )
        if (dist <= 6) {
            return "rotate"
        }
        
        return null
    }

    const isPointInElement = (element, point) => {
        return (
            point.x >= element.x &&
            point.x <= element.x + element.width &&
            point.y >= element.y &&
            point.y <= element.y + element.height
        )
    }

    const handleCanvasMouseDown = (e) => {
        const mousePos = getMousePos(e)
        
        // Check if clicking on any element (reverse order to get topmost)
        for (let i = placedElements.length - 1; i >= 0; i--) {
            const element = placedElements[i]
            
            // Check if clicking on a handle
            if (i === selectedElementIndex) {
                const handle = getHandleAtPosition(element, mousePos)
                if (handle === "rotate") {
                    setIsRotating(true)
                    setDragStart(mousePos)
                    return
                } else if (handle) {
                    setIsResizing(true)
                    setResizeHandle(handle)
                    setDragStart(mousePos)
                    return
                }
            }
            
            // Check if clicking on element body
            if (isPointInElement(element, mousePos)) {
                setSelectedElementIndex(i)
                setIsMoving(true)
                setDragStart({
                    x: mousePos.x - element.x,
                    y: mousePos.y - element.y,
                })
                return
            }
        }
        
        // Clicked on empty space - deselect
        setSelectedElementIndex(null)
    }

    const handleCanvasMouseMove = (e) => {
        if (selectedElementIndex === null) return
        const mousePos = getMousePos(e)
        
        if (isMoving) {
            const newElements = [...placedElements]
            const newX = snapToGridValue(mousePos.x - dragStart.x)
            const newY = snapToGridValue(mousePos.y - dragStart.y)
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                x: newX,
                y: newY,
            }
            setPlacedElements(newElements)
        } else if (isResizing && resizeHandle) {
            const element = placedElements[selectedElementIndex]
            const newElements = [...placedElements]
            
            const deltaX = mousePos.x - dragStart.x
            const deltaY = mousePos.y - dragStart.y
            
            let newX = element.x
            let newY = element.y
            let newWidth = element.width
            let newHeight = element.height
            
            switch (resizeHandle) {
                case "tl":
                    newX = element.x + deltaX
                    newY = element.y + deltaY
                    newWidth = element.width - deltaX
                    newHeight = element.height - deltaY
                    break
                case "tr":
                    newY = element.y + deltaY
                    newWidth = element.width + deltaX
                    newHeight = element.height - deltaY
                    break
                case "bl":
                    newX = element.x + deltaX
                    newWidth = element.width - deltaX
                    newHeight = element.height + deltaY
                    break
                case "br":
                    newWidth = element.width + deltaX
                    newHeight = element.height + deltaY
                    break
            }
            
            // Prevent negative dimensions
            if (newWidth > 10 && newHeight > 10) {
                newElements[selectedElementIndex] = {
                    ...element,
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                }
                setPlacedElements(newElements)
                setDragStart(mousePos)
            }
        } else if (isRotating) {
            const element = placedElements[selectedElementIndex]
            const centerX = element.x + element.width / 2
            const centerY = element.y + element.height / 2
            
            const angle = Math.atan2(
                mousePos.y - centerY,
                mousePos.x - centerX
            ) * 180 / Math.PI + 90
            
            const newElements = [...placedElements]
            newElements[selectedElementIndex] = {
                ...element,
                rotation: angle,
            }
            setPlacedElements(newElements)
        }
    }

    const handleCanvasMouseUp = () => {
        setIsMoving(false)
        setIsResizing(false)
        setIsRotating(false)
        setResizeHandle(null)
    }

    const handleDeleteSelected = () => {
        if (selectedElementIndex !== null) {
            const newElements = placedElements.filter((_, i) => i !== selectedElementIndex)
            setPlacedElements(newElements)
            setSelectedElementIndex(null)
        }
    }

    // Alignment functions
    const handleAlignLeft = () => {
        if (selectedElementIndex !== null) {
            const newElements = [...placedElements]
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                x: 0,
            }
            setPlacedElements(newElements)
        }
    }

    const handleAlignCenter = () => {
        if (selectedElementIndex !== null) {
            const element = placedElements[selectedElementIndex]
            const newElements = [...placedElements]
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                x: (512 - element.width) / 2,
            }
            setPlacedElements(newElements)
        }
    }

    const handleAlignRight = () => {
        if (selectedElementIndex !== null) {
            const element = placedElements[selectedElementIndex]
            const newElements = [...placedElements]
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                x: 512 - element.width,
            }
            setPlacedElements(newElements)
        }
    }

    const handleAlignTop = () => {
        if (selectedElementIndex !== null) {
            const newElements = [...placedElements]
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                y: 0,
            }
            setPlacedElements(newElements)
        }
    }

    const handleAlignMiddle = () => {
        if (selectedElementIndex !== null) {
            const element = placedElements[selectedElementIndex]
            const newElements = [...placedElements]
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                y: (512 - element.height) / 2,
            }
            setPlacedElements(newElements)
        }
    }

    const handleAlignBottom = () => {
        if (selectedElementIndex !== null) {
            const element = placedElements[selectedElementIndex]
            const newElements = [...placedElements]
            newElements[selectedElementIndex] = {
                ...newElements[selectedElementIndex],
                y: 512 - element.height,
            }
            setPlacedElements(newElements)
        }
    }

    const handleSave = async () => {
        if (!signageName.trim()) {
            alert("Please enter a name for the signage")
            return
        }

        try {
            // Convert elements to serializable format
            const elementsData = placedElements.map((element) => ({
                presetSrc: element.presetSrc,
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                rotation: element.rotation || 0,
            }))

            const signageData = {
                name: signageName,
                elements: elementsData,
                background: "beep://public/signage_blank.png",
                canvasWidth: 512,
                canvasHeight: 512,
            }

            await window.package.saveSignage(signageName, signageData)
            alert("Signage saved successfully!")
        } catch (error) {
            console.error("Failed to save signage:", error)
            alert("Failed to save signage: " + error.message)
        }
    }

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Delete" && selectedElementIndex !== null) {
                const newElements = placedElements.filter((_, i) => i !== selectedElementIndex)
                setPlacedElements(newElements)
                setSelectedElementIndex(null)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [selectedElementIndex, placedElements])

    const handlePresetDragStart = (imageSrc) => {
        const img = new Image()
        img.src = imageSrc
        setDraggedImage(img)
        setIsDragging(true)
    }

    const handlePresetDragEnd = () => {
        setIsDragging(false)
    }

    return (
        <Box
            sx={{
                display: "flex",
                height: "100vh",
                backgroundColor: "#1a1a1a",
                color: "#fff",
            }}>
            {/* Left sidebar - Preset images */}
            <Paper
                sx={{
                    width: 200,
                    backgroundColor: "#2a2a2a",
                    overflowY: "auto",
                    p: 2,
                }}>
                <Box sx={{ mb: 2, fontSize: 14, fontWeight: "bold" }}>
                    Signage Presets
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {presetImages.map((preset, index) => (
                        <Box
                            key={index}
                            draggable
                            onDragStart={() => handlePresetDragStart(preset.src)}
                            onDragEnd={handlePresetDragEnd}
                            sx={{
                                width: "100%",
                                height: 80,
                                backgroundColor: "#3a3a3a",
                                borderRadius: 1,
                                cursor: "grab",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                "&:hover": {
                                    backgroundColor: "#4a4a4a",
                                },
                                "&:active": {
                                    cursor: "grabbing",
                                },
                            }}>
                            <img
                                src={preset.src}
                                alt={preset.name}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                    pointerEvents: "none",
                                }}
                            />
                        </Box>
                    ))}
                    {presetImages.length === 0 && (
                        <Box sx={{ color: "#888", fontSize: 12, mt: 2 }}>
                            No presets available.
                            <br />
                            Add images to public/signagePresets/
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* Main canvas area */}
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 4,
                    gap: 2,
                }}>
                {/* Top toolbar */}
                <Paper
                    sx={{
                        backgroundColor: "#2a2a2a",
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        width: "100%",
                        maxWidth: 900,
                    }}>
                    <TextField
                        label="Signage Name"
                        value={signageName}
                        onChange={(e) => setSignageName(e.target.value)}
                        size="small"
                        sx={{ minWidth: 200 }}
                    />
                    
                    <Divider orientation="vertical" flexItem />
                    
                    {/* Alignment tools */}
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip title="Align Left">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleAlignLeft}
                                    disabled={selectedElementIndex === null}>
                                    <AlignHorizontalLeft />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Align Center">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleAlignCenter}
                                    disabled={selectedElementIndex === null}>
                                    <AlignHorizontalCenter />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Align Right">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleAlignRight}
                                    disabled={selectedElementIndex === null}>
                                    <AlignHorizontalRight />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                    
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip title="Align Top">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleAlignTop}
                                    disabled={selectedElementIndex === null}>
                                    <AlignVerticalTop />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Align Middle">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleAlignMiddle}
                                    disabled={selectedElementIndex === null}>
                                    <AlignVerticalCenter />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Align Bottom">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleAlignBottom}
                                    disabled={selectedElementIndex === null}>
                                    <AlignVerticalBottom />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>

                    <Divider orientation="vertical" flexItem />

                    {/* Grid controls */}
                    <ToggleButton
                        value="grid"
                        selected={showGrid}
                        onChange={() => setShowGrid(!showGrid)}
                        size="small"
                        sx={{ border: "1px solid #444" }}>
                        <Tooltip title="Toggle Grid">
                            <GridOn />
                        </Tooltip>
                    </ToggleButton>
                    
                    <ToggleButton
                        value="snap"
                        selected={snapToGrid}
                        onChange={() => setSnapToGrid(!snapToGrid)}
                        size="small"
                        sx={{ border: "1px solid #444" }}>
                        <Tooltip title="Snap to Grid">
                            <Box sx={{ fontSize: 12, fontWeight: "bold" }}>SNAP</Box>
                        </Tooltip>
                    </ToggleButton>

                    <Box sx={{ flex: 1 }} />
                    
                    <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSave}
                        disabled={!signageName.trim()}>
                        Save
                    </Button>
                    <IconButton
                        onClick={handleDeleteSelected}
                        disabled={selectedElementIndex === null}
                        color="error"
                        title="Delete selected (Del)">
                        <Delete />
                    </IconButton>
                </Paper>

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    width={512}
                    height={512}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    style={{
                        border: "2px solid #444",
                        borderRadius: 4,
                        backgroundColor: "#fff",
                        cursor: isMoving ? "grabbing" : isResizing || isRotating ? "pointer" : "default",
                    }}
                />

                {/* Help text */}
                <Box sx={{ color: "#888", fontSize: 12, textAlign: "center", maxWidth: 600 }}>
                    {selectedElementIndex !== null ? (
                        <>
                            <strong>Selected:</strong> Drag to move • Drag corners to resize •
                            Drag red circle to rotate • Use alignment buttons • Press Delete to remove
                        </>
                    ) : (
                        <>
                            Drag images from the left panel onto the canvas • 
                            Grid: {showGrid ? "ON" : "OFF"} • 
                            Snap: {snapToGrid ? "ON" : "OFF"} ({gridSize}px)
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    )
}

export default SignageEditorPage

