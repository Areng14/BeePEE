import { useState, useEffect } from "react"
import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    List,
    ListItem,
    ListItemText,
    ListItemButton,
    TextField,
    IconButton,
    Chip,
    Stack,
    Tooltip,
    Paper,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Alert,
    Avatar,
    Grid,
} from "@mui/material"
import {
    Add,
    DragIndicator,
    Delete,
    Info,
    CheckCircle,
    Error,
    Category,
    Functions,
    AccountTree,
    SwapHoriz,
    AddCircleOutline,
    PlayArrow,
    Code,
    OpenWith,
    SwapVert,
    BugReport,
} from "@mui/icons-material"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDroppable,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// Droppable Zone Component for nested blocks
function DroppableZone({ id, children, isEmpty = false, label = "Drop blocks here" }) {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
    })

    console.log(`DroppableZone ${id}:`, { isOver, isEmpty })

    return (
        <Box
            ref={setNodeRef}
            sx={{
                minHeight: isEmpty ? 120 : "auto",
                border: "4px dashed",
                borderColor: isEmpty ? (isOver ? "#d2b019ff" : "#555") : "transparent",
                borderRadius: 2,
                p: isEmpty ? 5 : 2,
                backgroundColor: isEmpty ? (isOver ? "rgba(210, 176, 25, 0.1)" : "#2a2d30") : "transparent",
                transition: "all 0.3s ease-in-out",
                transform: isOver ? "scale(1.05)" : "scale(1)",
                boxShadow: isOver ? "0 8px 25px rgba(210, 176, 25, 0.2)" : "none",
                "&:hover": {
                    borderColor: isEmpty ? "#d2b019ff" : "transparent",
                    backgroundColor: isEmpty ? "rgba(210, 176, 25, 0.05)" : "transparent",
                },
            }}
        >
            {isEmpty ? (
                <Box sx={{ textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        {label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", opacity: 0.7 }}>
                        Click "Add Block" to create new logic blocks
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ "& > *": { mb: 1 }, "& > *:last-child": { mb: 0 } }}>
                    {children}
                </Box>
            )}
        </Box>
    )
}

// Individual Block Components
function IfBlock({ block, onUpdateProperty, availableVariables, formData }) {
    return (
        <Box sx={{ p: 2 }}>
            {/* IF Condition Configuration */}
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    IF Condition
                </Typography>
                <Box sx={{ mt: 2 }}>
                                                    <Grid container spacing={2} alignItems="center">
                                    <Grid xs={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Variable</InputLabel>
                            <Select
                                value={block.variable || ""}
                                onChange={(e) => onUpdateProperty('variable', e.target.value)}
                                label="Variable"
                                sx={{ 
                                    "& .MuiOutlinedInput-root": {
                                        height: 40,
                                        minHeight: 40,
                                        maxHeight: 40
                                    },
                                    "& .MuiSelect-select": {
                                        height: "20px !important",
                                        lineHeight: "20px !important",
                                        paddingTop: "10px !important",
                                        paddingBottom: "10px !important",
                                        minWidth: "120px",
                                        display: "flex",
                                        alignItems: "center"
                                    }
                                }}
                            >
                                {availableVariables.map((variable) => (
                                    <MenuItem key={variable.fixupName} value={variable.fixupName}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                                            <Code fontSize="small" />
                                            {variable.displayName}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid xs={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Operator</InputLabel>
                            <Select
                                value={block.operator || "=="}
                                onChange={(e) => onUpdateProperty('operator', e.target.value)}
                                label="Operator"
                                sx={{ 
                                    "& .MuiOutlinedInput-root": {
                                        height: 40,
                                        minHeight: 40,
                                        maxHeight: 40
                                    },
                                    "& .MuiSelect-select": {
                                        height: "20px !important",
                                        lineHeight: "20px !important",
                                        paddingTop: "10px !important",
                                        paddingBottom: "10px !important",
                                        minWidth: "80px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }
                                }}
                            >
                                {(() => {
                                    const selectedVariable = availableVariables.find(v => v.fixupName === block.variable);
                                    const fullVariableData = formData.variables?.find(v => v.fixupName === block.variable);
                                    
                                    // For boolean and enum types, only show == and !=
                                    if (fullVariableData?.type === "boolean" || fullVariableData?.type === "enum") {
                                        return [
                                            <MenuItem key="eq" value="==">=</MenuItem>,
                                            <MenuItem key="ne" value="!=">!=</MenuItem>
                                        ];
                                    }
                                    
                                    // For number types, show all operators
                                    if (fullVariableData?.type === "number") {
                                        return [
                                            <MenuItem key="eq" value="==">=</MenuItem>,
                                            <MenuItem key="ne" value="!=">!=</MenuItem>,
                                            <MenuItem key="gt" value=">">&gt;</MenuItem>,
                                            <MenuItem key="lt" value="<">&lt;</MenuItem>,
                                            <MenuItem key="gte" value=">=">&gt;=</MenuItem>,
                                            <MenuItem key="lte" value="<=">&lt;=</MenuItem>
                                        ];
                                    }
                                    
                                    // Default fallback - show basic operators when no variable is selected
                                    return [
                                        <MenuItem key="eq" value="==">=</MenuItem>,
                                        <MenuItem key="ne" value="!=">!=</MenuItem>
                                    ];
                                })()}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid xs={4}>
                        {/* Dynamic value field based on variable type */}
                        {(() => {
                            const selectedVariable = availableVariables.find(v => v.fixupName === block.variable);
                            if (!selectedVariable) {
                                return (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Value"
                                        value={block.value || ""}
                                        onChange={(e) => onUpdateProperty('value', e.target.value)}
                                        sx={{ 
                                            "& .MuiOutlinedInput-root": {
                                                height: 40,
                                                minHeight: 40,
                                                maxHeight: 40
                                            },
                                            "& .MuiInputBase-input": {
                                                height: "20px !important",
                                                lineHeight: "20px !important",
                                                paddingTop: "10px !important",
                                                paddingBottom: "10px !important",
                                                minWidth: "100px",
                                                display: "flex",
                                                alignItems: "center"
                                            }
                                        }}
                                    />
                                );
                            }

                            // Find the full variable data from formData to get type and enum values
                            const fullVariableData = formData.variables?.find(v => v.fixupName === block.variable);
                            
                            if (fullVariableData?.type === "boolean") {
                                return (
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Value</InputLabel>
                                        <Select
                                            value={block.value || "1"}
                                            onChange={(e) => onUpdateProperty('value', e.target.value)}
                                            label="Value"
                                            sx={{ 
                                                "& .MuiOutlinedInput-root": {
                                                    height: 40,
                                                    minHeight: 40,
                                                    maxHeight: 40
                                                },
                                                "& .MuiSelect-select": {
                                                    height: "20px !important",
                                                    lineHeight: "20px !important",
                                                    paddingTop: "10px !important",
                                                    paddingBottom: "10px !important",
                                                    minWidth: "100px",
                                                    display: "flex",
                                                    alignItems: "center"
                                                }
                                            }}
                                        >
                                            <MenuItem value="1">True</MenuItem>
                                            <MenuItem value="0">False</MenuItem>
                                        </Select>
                                    </FormControl>
                                );
                            } else if (fullVariableData?.type === "enum" && fullVariableData?.enumValues) {
                                return (
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Value</InputLabel>
                                        <Select
                                            value={block.value || Object.keys(fullVariableData.enumValues)[0]}
                                            onChange={(e) => onUpdateProperty('value', e.target.value)}
                                            label="Value"
                                            sx={{ 
                                                "& .MuiOutlinedInput-root": {
                                                    height: 40,
                                                    minHeight: 40,
                                                    maxHeight: 40
                                                },
                                                "& .MuiSelect-select": {
                                                    height: "20px !important",
                                                    lineHeight: "20px !important",
                                                    paddingTop: "10px !important",
                                                    paddingBottom: "10px !important",
                                                    minWidth: "120px",
                                                    display: "flex",
                                                    alignItems: "center"
                                                }
                                            }}
                                        >
                                            {Object.entries(fullVariableData.enumValues).map(([value, label]) => (
                                                <MenuItem key={value} value={value}>
                                                    {label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                );
                            } else {
                                return (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Value"
                                        type={fullVariableData?.type === "number" ? "number" : "text"}
                                        value={block.value || ""}
                                        onChange={(e) => onUpdateProperty('value', e.target.value)}
                                        inputProps={{
                                            min: fullVariableData?.type === "number" ? 0 : undefined,
                                            step: fullVariableData?.type === "number" ? 1 : undefined,
                                        }}
                                        sx={{ 
                                            "& .MuiOutlinedInput-root": {
                                                height: 40,
                                                minHeight: 40,
                                                maxHeight: 40
                                            },
                                            "& .MuiInputBase-input": {
                                                height: "20px !important",
                                                lineHeight: "20px !important",
                                                paddingTop: "10px !important",
                                                paddingBottom: "10px !important",
                                                minWidth: "100px",
                                                display: "flex",
                                                alignItems: "center"
                                            }
                                        }}
                                    />
                                );
                            }
                        })()}
                    </Grid>
                    </Grid>
                </Box>
            </Box>
        </Box>
    )
}

function ChangeInstanceBlock({ block, onUpdateProperty, availableInstances, editingNames }) {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Change Instance To
            </Typography>
            <Box sx={{ mt: 2 }}>
                <FormControl fullWidth size="small">
                <InputLabel>Instance</InputLabel>
                <Select
                    value={block.instanceName || ""}
                    onChange={(e) => onUpdateProperty('instanceName', e.target.value)}
                    label="Instance"
                    sx={{ 
                        "& .MuiOutlinedInput-root": {
                            height: 40,
                            minHeight: 40,
                            maxHeight: 40
                        },
                        "& .MuiSelect-select": {
                            height: "20px !important",
                            lineHeight: "20px !important",
                            paddingTop: "10px !important",
                            paddingBottom: "10px !important",
                            minWidth: "150px",
                            display: "flex",
                            alignItems: "center"
                        }
                    }}
                >
                    {availableInstances.map((instance, index) => (
                        <MenuItem key={index} value={instance.Name}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                                <Category fontSize="small" />
                                <Typography variant="body2">
                                    {editingNames[instance.index] !== undefined ? editingNames[instance.index] : (instance.displayName || `Instance ${index}`)}
                                </Typography>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            </Box>
        </Box>
    )
}

function AddOverlayBlock({ block, onUpdateProperty, availableInstances, editingNames }) {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Add Overlay Instance
            </Typography>
            <Box sx={{ mt: 2 }}>
                <FormControl fullWidth size="small">
                <InputLabel>Overlay Instance</InputLabel>
                <Select
                    value={block.overlayName || ""}
                    onChange={(e) => onUpdateProperty('overlayName', e.target.value)}
                    label="Overlay Instance"
                    sx={{ 
                        "& .MuiOutlinedInput-root": {
                            height: 40,
                            minHeight: 40,
                            maxHeight: 40
                        },
                        "& .MuiSelect-select": {
                            height: "20px !important",
                            lineHeight: "20px !important",
                            paddingTop: "10px !important",
                            paddingBottom: "10px !important",
                            minWidth: "150px",
                            display: "flex",
                            alignItems: "center"
                        }
                    }}
                >
                    {availableInstances.map((instance, index) => (
                        <MenuItem key={index} value={instance.Name}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                                <AddCircleOutline fontSize="small" />
                                <Typography variant="body2">
                                    {editingNames[instance.index] !== undefined ? editingNames[instance.index] : (instance.displayName || `Instance ${index}`)}
                                </Typography>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            </Box>
        </Box>
    )
}

function OffsetInstanceBlock({ block, onUpdateProperty }) {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Offset Instance Position
            </Typography>
            <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                {/* X Input */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, minWidth: "12px" }}>
                        X
                    </Typography>
                    <TextField
                        size="small"
                        type="number"
                        placeholder="0"
                        value={(() => {
                            const offset = block.offset || "0 0 0"
                            const parts = offset.split(' ')
                            return parts[0] || "0"
                        })()}
                        onChange={(e) => {
                            const offset = block.offset || "0 0 0"
                            const parts = offset.split(' ')
                            const newOffset = `${e.target.value} ${parts[1] || "0"} ${parts[2] || "0"}`
                            onUpdateProperty('offset', newOffset)
                        }}
                        sx={{ 
                            width: 80,
                            "& .MuiOutlinedInput-root": {
                                height: 32,
                                minHeight: 32,
                                maxHeight: 32
                            },
                            "& .MuiInputBase-input": {
                                textAlign: "center",
                                fontSize: "0.875rem",
                                padding: "6px 8px"
                            }
                        }}
                    />
                </Box>

                {/* Y Input */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, minWidth: "12px" }}>
                        Y
                    </Typography>
                    <TextField
                        size="small"
                        type="number"
                        placeholder="0"
                        value={(() => {
                            const offset = block.offset || "0 0 0"
                            const parts = offset.split(' ')
                            return parts[1] || "0"
                        })()}
                        onChange={(e) => {
                            const offset = block.offset || "0 0 0"
                            const parts = offset.split(' ')
                            const newOffset = `${parts[0] || "0"} ${e.target.value} ${parts[2] || "0"}`
                            onUpdateProperty('offset', newOffset)
                        }}
                        sx={{ 
                            width: 80,
                            "& .MuiOutlinedInput-root": {
                                height: 32,
                                minHeight: 32,
                                maxHeight: 32
                            },
                            "& .MuiInputBase-input": {
                                textAlign: "center",
                                fontSize: "0.875rem",
                                padding: "6px 8px"
                            }
                        }}
                    />
                </Box>

                {/* Z Input */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, minWidth: "12px" }}>
                        Z
                    </Typography>
                    <TextField
                        size="small"
                        type="number"
                        placeholder="0"
                        value={(() => {
                            const offset = block.offset || "0 0 0"
                            const parts = offset.split(' ')
                            return parts[2] || "0"
                        })()}
                        onChange={(e) => {
                            const offset = block.offset || "0 0 0"
                            const parts = offset.split(' ')
                            const newOffset = `${parts[0] || "0"} ${parts[1] || "0"} ${e.target.value}`
                            onUpdateProperty('offset', newOffset)
                        }}
                        sx={{ 
                            width: 80,
                            "& .MuiOutlinedInput-root": {
                                height: 32,
                                minHeight: 32,
                                maxHeight: 32
                            },
                            "& .MuiInputBase-input": {
                                textAlign: "center",
                                fontSize: "0.875rem",
                                padding: "6px 8px"
                            }
                        }}
                    />
                </Box>
            </Box>
            
            {/* Axis Descriptions */}
            <Box sx={{ mt: 1, display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Typography variant="caption" color="text.secondary">
                    X: Forward/Back
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Y: Left/Right
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Z: Up/Down
                </Typography>
            </Box>
        </Box>
    )
}

function TestBlock() {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Test Block (Empty for now)
            </Typography>
            <Alert severity="info">
                This is a test block. You can configure it later.
            </Alert>
        </Box>
    )
}

function DebugBlock({ block, onUpdateProperty, availableVariables }) {
    const [message, setMessage] = useState(block.message || '')
    
    const handleMessageChange = (newMessage) => {
        setMessage(newMessage)
        onUpdateProperty('message', newMessage)
    }
    
    // Function to replace variables in the message
    const replaceVariables = (text) => {
        if (!text) return text
        
        // Find all variable references like $variable_name
        return text.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
            const variable = availableVariables.find(v => v.fixupName === `$${varName}` || v.name === varName)
            if (variable) {
                return `<span style="color: #4CAF50; font-weight: bold;">${match}</span>`
            }
            return `<span style="color: #f44336; font-weight: bold;">${match}</span>`
        })
    }
    
    const processedMessage = replaceVariables(message)
    
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Debug Output
            </Typography>
            
            <TextField
                fullWidth
                multiline
                rows={1}
                placeholder="Enter debug message... Use $variable_name to reference variables"
                value={message}
                onChange={(e) => handleMessageChange(e.target.value)}
                sx={{ mb: 2 }}
            />
            
            {message && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                        Preview:
                    </Typography>
                    <Box 
                        sx={{ 
                            p: 1, 
                            backgroundColor: '#1a1a1a', 
                            borderRadius: 1,
                            border: '1px solid #333'
                        }}
                        dangerouslySetInnerHTML={{ __html: processedMessage }}
                    />
                </Box>
            )}
            
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Available variables: {availableVariables.map(v => v.fixupName).join(', ')}
            </Typography>
        </Box>
    )
}

// Sortable Block Component - Generic for all block types
function SortableBlock({ block, onUpdateBlock, onDeleteBlock, onAddChildBlock, availableInstances, availableVariables, formData, editingNames = {}, depth = 0, blocks = [] }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
    }

    const handleUpdateProperty = (property, value) => {
        onUpdateBlock(block.id, { ...block, [property]: value })
    }

    const handleAddChild = (containerKey) => {
        onAddChildBlock(block.id, containerKey)
    }

    // Helper function to find parent switch block
    const findParentSwitch = (caseBlockId, allBlocks) => {
        const searchInBlock = (blockList) => {
            for (const block of blockList) {
                if (block.type === 'switchCase' && block.cases) {
                    const hasCase = block.cases.some(caseBlock => caseBlock.id === caseBlockId)
                    if (hasCase) {
                        return block
                    }
                }
                
                // Check child containers
                if (BLOCK_DEFINITIONS[block.type]?.canContainChildren) {
                    const childContainers = BLOCK_DEFINITIONS[block.type].childContainers || []
                    for (const container of childContainers) {
                        if (block[container] && Array.isArray(block[container])) {
                            const found = searchInBlock(block[container])
                            if (found) return found
                        }
                    }
                }
            }
            return null
        }
        
        return searchInBlock(allBlocks)
    }

    const getBlockIcon = (blockType) => {
        switch (blockType) {
            case 'if': return <AccountTree fontSize="small" />
            case 'switchCase': return <Category fontSize="small" />
            case 'case': return <Code fontSize="small" />
            case 'changeInstance': return <SwapHoriz fontSize="small" />
            case 'addOverlay': return <AddCircleOutline fontSize="small" />
            case 'test': return <Functions fontSize="small" />
            case 'ifElse': return <AccountTree fontSize="small" />
            case 'mapInstVar': return <SwapVert fontSize="small" />
            case 'offsetInstance': return <OpenWith fontSize="small" />
            case 'debug': return <BugReport fontSize="small" />
            default: return <Info fontSize="small" />
        }
    }

    const getBlockColor = (blockType) => {
        // Logic blocks use orange color family
        const logicColors = {
            'if': '#FF9800',           // Orange - IF logic
            'switchCase': '#FF9800',   // Orange - Switch logic  
            'case': '#E65100',         // Dark Orange - Case logic
            'ifElse': '#FF9800',       // Orange - If-Else logic
        }
        
        // Action/Result blocks use purple color family
        const actionColors = {
            'changeInstance': '#9C27B0',    // Purple - Change action
            'addOverlay': '#9C27B0',        // Purple - Add action
            'mapInstVar': '#9C27B0',        // Purple - Map action
            'offsetInstance': '#9C27B0',    // Purple - Offset action
            'debug': '#9C27B0',             // Purple - Debug action
        }
        
        // Test blocks use yellow
        const testColors = {
            'test': '#FFC107',              // Amber - Test blocks
        }
        
        return logicColors[blockType] || actionColors[blockType] || testColors[blockType] || '#555'
    }

    const renderBlockContent = () => {
        const handleUpdateProperty = (property, value) => {
            onUpdateBlock(block.id, { ...block, [property]: value })
        }

        switch (block.type) {
            case 'if':
                return (
                    <>
                        <IfBlock 
                            block={block}
                            onUpdateProperty={handleUpdateProperty}
                            availableVariables={availableVariables}
                            formData={formData}
                        />
                        {/* THEN Section */}
                        <Box sx={{ p: 2, pt: 0 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <CheckCircle fontSize="small" />
                                Actions ({block.thenBlocks?.length || 0})
                                <Chip 
                                    label="Multiple actions allowed" 
                                    size="small" 
                                    variant="outlined" 
                                    sx={{ 
                                        ml: 1, 
                                        fontSize: '0.7rem',
                                        backgroundColor: 'rgba(210, 176, 25, 0.1)',
                                        borderColor: '#d2b019ff',
                                        color: '#d2b019ff'
                                    }}
                                />
                            </Typography>
                            <DroppableZone
                                id={`${block.id}-then`}
                                isEmpty={!block.thenBlocks || block.thenBlocks.length === 0}
                                label="Drop action blocks here (you can add multiple)"
                            >
                                {block.thenBlocks && block.thenBlocks.map((childBlock) => (
                                    <SortableBlock
                                        key={childBlock.id}
                                        block={childBlock}
                                        onUpdateBlock={onUpdateBlock}
                                        onDeleteBlock={onDeleteBlock}
                                        onAddChildBlock={onAddChildBlock}
                                        availableInstances={availableInstances}
                                        availableVariables={availableVariables}
                                        formData={formData}
                                        editingNames={editingNames}
                                        blocks={blocks}
                                        depth={depth + 1}
                                    />
                                ))}
                            </DroppableZone>
                        </Box>
                    </>
                )

            case 'changeInstance':
                return (
                    <ChangeInstanceBlock 
                        block={block}
                        onUpdateProperty={handleUpdateProperty}
                        availableInstances={availableInstances}
                        editingNames={editingNames}
                    />
                )

            case 'addOverlay':
                return (
                    <AddOverlayBlock 
                        block={block}
                        onUpdateProperty={handleUpdateProperty}
                        availableInstances={availableInstances}
                        editingNames={editingNames}
                    />
                )

            case 'offsetInstance':
                return (
                    <OffsetInstanceBlock 
                        block={block}
                        onUpdateProperty={handleUpdateProperty}
                    />
                )

            case 'test':
                return <TestBlock />



            case 'debug':
                return (
                    <DebugBlock 
                        block={block}
                        onUpdateProperty={handleUpdateProperty}
                        availableVariables={availableVariables}
                    />
                )

            case 'case':
                return (
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Case: {block.value || "Default"}
                            </Typography>
                        </Box>
                        
                        {/* Case Value - gets the variable type from parent switch */}
                        <Box sx={{ mt: 2 }}>
                            <Grid container spacing={2}>
                                <Grid xs={12}>
                                    {/* Dynamic value field based on parent switch variable type */}
                                    {(() => {
                                        // Find the parent switch block to get the variable type
                                        const parentSwitch = findParentSwitch(block.id, blocks)
                                        const switchVariable = parentSwitch?.variable
                                        const fullVariableData = formData.variables?.find(v => v.fixupName === switchVariable)
                                        
                                        if (!switchVariable) {
                                            return (
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Case Value"
                                                    value={block.value || ""}
                                                    onChange={(e) => handleUpdateProperty('value', e.target.value)}
                                                    placeholder="Select variable in parent switch first"
                                                />
                                            );
                                        }

                                        if (fullVariableData?.type === "boolean") {
                                            return (
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>Case Value</InputLabel>
                                                    <Select
                                                        value={block.value || "1"}
                                                        onChange={(e) => handleUpdateProperty('value', e.target.value)}
                                                        label="Case Value"
                                                    >
                                                        <MenuItem value="1">True</MenuItem>
                                                        <MenuItem value="0">False</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            );
                                        } else if (fullVariableData?.type === "enum" && fullVariableData?.enumValues) {
                                            return (
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>Case Value</InputLabel>
                                                    <Select
                                                        value={block.value || Object.keys(fullVariableData.enumValues)[0]}
                                                        onChange={(e) => handleUpdateProperty('value', e.target.value)}
                                                        label="Case Value"
                                                    >
                                                        {Object.entries(fullVariableData.enumValues).map(([value, label]) => (
                                                            <MenuItem key={value} value={value}>
                                                                {label}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            );
                                        } else {
                                            return (
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Case Value"
                                                    type={fullVariableData?.type === "number" ? "number" : "text"}
                                                    value={block.value || ""}
                                                    onChange={(e) => handleUpdateProperty('value', e.target.value)}
                                                    inputProps={{
                                                        min: fullVariableData?.type === "number" ? 0 : undefined,
                                                        step: fullVariableData?.type === "number" ? 1 : undefined,
                                                    }}
                                                />
                                            );
                                        }
                                    })()}
                                </Grid>
                            </Grid>
                        </Box>
                        
                        <Box sx={{ mt: 2 }}>
                            <DroppableZone
                                id={`${block.id}-then`}
                                isEmpty={!block.thenBlocks || block.thenBlocks.length === 0}
                                label="Drop action blocks here (you can add multiple)"
                            >
                                {block.thenBlocks && block.thenBlocks.map((childBlock) => (
                                    <SortableBlock
                                        key={childBlock.id}
                                        block={childBlock}
                                        onUpdateBlock={onUpdateBlock}
                                        onDeleteBlock={onDeleteBlock}
                                        onAddChildBlock={onAddChildBlock}
                                        availableInstances={availableInstances}
                                        availableVariables={availableVariables}
                                        formData={formData}
                                        editingNames={editingNames}
                                        blocks={blocks}
                                        depth={depth + 1}
                                    />
                                ))}
                            </DroppableZone>
                        </Box>
                    </Box>
                )

            case 'switchCase':
                return (
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                SWITCH
                            </Typography>
                            <Chip 
                                label={`${block.cases?.length || 0} cases`} 
                                size="small" 
                                color="primary"
                                sx={{ backgroundColor: "#d2b019ff", color: "#000" }}
                            />
                        </Box>
                        
                        {/* Switch Variable Selection */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Switch Variable
                            </Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel>Variable</InputLabel>
                                <Select
                                    value={block.variable || ""}
                                    onChange={(e) => handleUpdateProperty('variable', e.target.value)}
                                    label="Variable"
                                >
                                    {availableVariables.map((variable, index) => (
                                        <MenuItem key={index} value={variable.fixupName}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                                                <Functions fontSize="small" />
                                                <Typography variant="body2">
                                                    {variable.displayName}
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                        
                        <Box sx={{ mt: 2 }}>
                            <DroppableZone
                                id={`${block.id}-cases`}
                                isEmpty={!block.cases || block.cases.length === 0}
                                label="Drop case blocks here (you can add multiple)"
                            >
                                {block.cases && block.cases.map((caseBlock) => (
                                    <SortableBlock
                                        key={caseBlock.id}
                                        block={caseBlock}
                                        onUpdateBlock={onUpdateBlock}
                                        onDeleteBlock={onDeleteBlock}
                                        onAddChildBlock={onAddChildBlock}
                                        availableInstances={availableInstances}
                                        availableVariables={availableVariables}
                                        formData={formData}
                                        editingNames={editingNames}
                                        blocks={blocks}
                                        depth={depth + 1}
                                    />
                                ))}
                            </DroppableZone>
                        </Box>
                    </Box>
                )

            case 'ifElse':
                return (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            If-Else Condition: {block.condition || "No condition set"}
                        </Typography>
                        
                        {/* Then Blocks */}
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                Then:
                            </Typography>
                            <DroppableZone
                                id={`${block.id}-then`}
                                isEmpty={!block.thenBlocks || block.thenBlocks.length === 0}
                                label="Drop blocks here for THEN"
                            >
                                {block.thenBlocks && block.thenBlocks.map((thenBlock) => (
                                    <SortableBlock
                                        key={thenBlock.id}
                                        block={thenBlock}
                                        onUpdateBlock={onUpdateBlock}
                                        onDeleteBlock={onDeleteBlock}
                                        onAddChildBlock={onAddChildBlock}
                                        availableInstances={availableInstances}
                                        availableVariables={availableVariables}
                                        formData={formData}
                                        editingNames={editingNames}
                                        blocks={blocks}
                                        depth={depth + 1}
                                    />
                                ))}
                            </DroppableZone>
                        </Box>

                        {/* Else Blocks */}
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                Else:
                            </Typography>
                            <DroppableZone
                                id={`${block.id}-else`}
                                isEmpty={!block.elseBlocks || block.elseBlocks.length === 0}
                                label="Drop blocks here for ELSE"
                            >
                                {block.elseBlocks && block.elseBlocks.map((elseBlock) => (
                                    <SortableBlock
                                        key={elseBlock.id}
                                        block={elseBlock}
                                        onUpdateBlock={onUpdateBlock}
                                        onDeleteBlock={onDeleteBlock}
                                        onAddChildBlock={onAddChildBlock}
                                        availableInstances={availableInstances}
                                        availableVariables={availableVariables}
                                        formData={formData}
                                        editingNames={editingNames}
                                        blocks={blocks}
                                        depth={depth + 1}
                                    />
                                ))}
                            </DroppableZone>
                        </Box>
                    </Box>
                )

            case 'mapInstVar':
                return (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Map Instance Variable
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {typeof block.sourceVariable === 'string' ? block.sourceVariable : 'Unknown'} → {typeof block.targetVariable === 'string' ? block.targetVariable : 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {Object.keys(block.mappings || {}).length} mappings
                        </Typography>
                        {block.mappings && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Complex mapping structure detected
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )

            default:
                return (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Unknown block type: {block.type}
                        </Typography>
                    </Box>
                )
        }
    }

    return (
                 <Paper
             ref={setNodeRef}
             style={style}
             elevation={isDragging ? 4 : 1}
             sx={{
                 backgroundColor: "#2a2d30",
                 borderLeft: `4px solid ${getBlockColor(block.type)}`,
                 borderRadius: 2,
                 cursor: isDragging ? "grabbing" : "auto",
                 mb: depth === 0 ? 2 : 1,
                 ml: depth * 2, // Indent nested blocks
                 transition: "all 0.2s ease-in-out",
                 "&:hover": {
                     elevation: 2,
                     borderLeftWidth: 6,
                     backgroundColor: "#323639",
                 },
                 position: "relative",
                 overflow: "hidden",
             }}
         >
            {/* Block controls */}
            <Box
                sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    display: "flex",
                    gap: 1,
                    zIndex: 10,
                }}
            >
                                 <Box
                     {...attributes}
                     {...listeners}
                     sx={{
                         cursor: isDragging ? "grabbing" : "grab",
                         display: "flex",
                         alignItems: "center",
                         color: "#888",
                         backgroundColor: "#3a3a3a",
                         borderRadius: 1,
                         p: 0.5,
                         "&:hover": {
                             backgroundColor: "#555",
                         },
                     }}
                 >
                    <DragIndicator fontSize="small" />
                </Box>

                                 <Tooltip title="Delete this block">
                     <IconButton
                         size="small"
                         color="error"
                         sx={{ 
                             backgroundColor: "#3a3a3a",
                             "&:hover": {
                                 backgroundColor: "#d32f2f",
                                 color: "#fff",
                             }
                         }}
                         onClick={() => onDeleteBlock(block.id)}
                     >
                        <Delete fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Content */}
            {renderBlockContent()}
        </Paper>
    )
}

// Block definitions for the modular system
const BLOCK_DEFINITIONS = {
    if: {
        displayName: "IF Block",
        description: "Conditional logic block - drag action blocks inside",
        category: "Logic",
        canContainChildren: true,
        childContainers: ['thenBlocks']
    },
    changeInstance: {
        displayName: "Change Instance",
        description: "Change the current instance file",
        category: "Actions",
        canContainChildren: false
    },
    addOverlay: {
        displayName: "Add Overlay",
        description: "Add an overlay instance on top",
        category: "Actions", 
        canContainChildren: false
    },
    test: {
        displayName: "Test Block",
        description: "Empty test block for development",
        category: "Test",
        canContainChildren: false
    },
    switchCase: {
        displayName: "Switch Case",
        description: "Handle multiple conditions with different outcomes",
        category: "Logic",
        canContainChildren: true,
        childContainers: ['cases']
    },
    case: {
        displayName: "Case",
        description: "Individual case in a switch statement",
        category: "Logic",
        canContainChildren: true,
        childContainers: ['thenBlocks']
    },
    ifElse: {
        displayName: 'If-Else',
        description: 'Conditional logic with then and else branches',
        category: 'Logic',
        canContainChildren: true,
        childContainers: ['thenBlocks', 'elseBlocks']
    },
    mapInstVar: {
        displayName: 'Map Instance Variable',
        description: 'Maps one variable to another with value mappings',
        category: 'Variables',
        canContainChildren: false,
        childContainers: []
    },
    offsetInstance: {
        displayName: 'Offset Instance',
        description: 'Offset the instance position',
        category: 'Actions',
        canContainChildren: false,
        childContainers: []
    },
    debug: {
        displayName: 'Debug Output',
        description: 'Output debug messages with variable support',
        category: 'Actions',
        canContainChildren: false,
        childContainers: []
    }
}

function Conditions({ item, formData, onUpdateConditions, onImportConditions, editingNames = {} }) {
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [blocks, setBlocks] = useState([])
    const [selectedCategory, setSelectedCategory] = useState("Logic")
    const [activeId, setActiveId] = useState(null)
    
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // Get available instances from formData
    const availableInstances = formData?.instances
        ? Object.entries(formData.instances)
              .filter(([index, instance]) => !instance._toRemove)
              .map(([index, instance]) => ({
                  ...instance,
                  index,
              }))
        : []

    // Get available variables from formData (user-added variables only)
    const availableVariables = formData.variables ? 
        (Array.isArray(formData.variables) ? 
            formData.variables.map(variable => ({
                displayName: variable.displayName || variable.fixupName,
                fixupName: variable.fixupName
            })) : 
            // If it's an object, convert to array
            Object.values(formData.variables).map(variable => ({
                displayName: variable.displayName || variable.fixupName,
                fixupName: variable.fixupName
            }))
        ) : []

    useEffect(() => {
        console.log('Conditions useEffect triggered:', {
            hasBlocks: !!(formData.blocks && Array.isArray(formData.blocks)),
            blocksLength: formData.blocks?.length || 0,
            hasConditions: !!(formData.conditions && Object.keys(formData.conditions).length > 0),
            conditionsKeys: Object.keys(formData.conditions || {})
        })
        
        // Initialize blocks from formData if available
        if (formData.blocks && Array.isArray(formData.blocks)) {
            console.log('Setting blocks from formData.blocks:', formData.blocks)
            setBlocks(formData.blocks)
        } else if (formData.conditions && Object.keys(formData.conditions).length > 0) {
            // Auto-import VBSP conditions if no blocks exist but VBSP conditions do
            console.log('Converting VBSP conditions to blocks:', formData.conditions)
            const result = convertVbspToBlocks(formData.conditions)
            if (result.success) {
                console.log('Conversion successful, setting blocks:', result.blocks)
                setBlocks(result.blocks)
                onImportConditions(result.blocks) // Use import function to avoid marking as modified
            } else {
                console.error('Conversion failed:', result.error)
            }
        } else {
            console.log('No blocks or conditions to load')
        }
    }, [formData.blocks, formData.conditions])

    const handleAddBlock = (blockType) => {
        const blockDef = BLOCK_DEFINITIONS[blockType]
        const newBlock = {
            id: `block_${Date.now()}`,
            type: blockType,
            displayName: blockDef.displayName,
            // Initialize child containers if the block can contain children
            ...(blockDef.canContainChildren && blockDef.childContainers ? 
                blockDef.childContainers.reduce((acc, container) => {
                    acc[container] = []
                    return acc
                }, {}) : {}
            ),
        }
        
        const updatedBlocks = [...blocks, newBlock]
        setBlocks(updatedBlocks)
        onUpdateConditions(updatedBlocks)
        setAddDialogOpen(false)
    }

    const handleDeleteBlock = (blockId) => {
        const deleteBlockRecursive = (blockList) => {
            return blockList.filter(block => {
                if (block.id === blockId) return false
                
                // Also check child containers
                if (BLOCK_DEFINITIONS[block.type]?.canContainChildren) {
                    const childContainers = BLOCK_DEFINITIONS[block.type].childContainers || []
                    childContainers.forEach(container => {
                        if (block[container]) {
                            block[container] = deleteBlockRecursive(block[container])
                        }
                    })
                }
                return true
            })
        }

        const updatedBlocks = deleteBlockRecursive(blocks)
        setBlocks(updatedBlocks)
        onUpdateConditions(updatedBlocks)
    }

    const handleUpdateBlock = (blockId, updatedBlock) => {
        const updateBlockRecursive = (blockList) => {
            return blockList.map(block => {
                if (block.id === blockId) {
                    return updatedBlock
                }
                
                // Also check child containers
                if (BLOCK_DEFINITIONS[block.type]?.canContainChildren) {
                    const childContainers = BLOCK_DEFINITIONS[block.type].childContainers || []
                    childContainers.forEach(container => {
                        if (block[container]) {
                            block[container] = updateBlockRecursive(block[container])
                        }
                    })
                }
                return block
            })
        }

        const updatedBlocks = updateBlockRecursive(blocks)
        setBlocks(updatedBlocks)
        onUpdateConditions(updatedBlocks)
    }

    const handleAddChildBlock = (parentBlockId, containerKey) => {
        // This function is kept for compatibility but won't be used
        // since we're using drag-and-drop instead of "Add Action" buttons
        console.log("Child block addition via drag-and-drop only")
    }

    const handleDragStart = (event) => {
        setActiveId(event.active.id)
    }

    const handleDragEnd = (event) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        console.log('Drag end:', { active: active?.id, over: over?.id })

        // Check if we're dropping into a droppable zone (IF block or Switch case container)
        if (over.id && (over.id.includes('-then') || over.id.includes('-cases'))) {
            const parentBlockId = over.id.replace('-then', '').replace('-cases', '')
            const draggedBlockId = active.id
            const containerType = over.id.includes('-then') ? 'then' : 'cases'
            
            console.log('Dropping into block:', { parentBlockId, draggedBlockId, containerType })
            
            // Find and remove the dragged block from wherever it currently is
            const findAndRemoveBlock = (blockList) => {
                for (let i = 0; i < blockList.length; i++) {
                    const block = blockList[i]
                    
                    // Check if this is the block we're looking for
                    if (block.id === draggedBlockId) {
                        const removedBlock = blockList.splice(i, 1)[0]
                        return removedBlock
                    }
                    
                    // Check child containers
                    if (BLOCK_DEFINITIONS[block.type]?.canContainChildren) {
                        const childContainers = BLOCK_DEFINITIONS[block.type].childContainers || []
                        for (const container of childContainers) {
                            if (block[container] && Array.isArray(block[container])) {
                                const found = findAndRemoveBlock(block[container])
                                if (found) return found
                            }
                        }
                    }
                }
                return null
            }

            // Add block to the target block
            const addBlockToContainer = (blockList, blockToAdd) => {
                return blockList.map(block => {
                    if (block.id === parentBlockId) {
                        if (containerType === 'then') {
                            return {
                                ...block,
                                thenBlocks: [...(block.thenBlocks || []), blockToAdd]
                            }
                        } else if (containerType === 'cases') {
                            return {
                                ...block,
                                cases: [...(block.cases || []), blockToAdd]
                            }
                        }
                    }
                    
                    // Check child containers
                    if (BLOCK_DEFINITIONS[block.type]?.canContainChildren) {
                        const childContainers = BLOCK_DEFINITIONS[block.type].childContainers || []
                        for (const container of childContainers) {
                            if (block[container]) {
                                block[container] = addBlockToContainer(block[container], blockToAdd)
                            }
                        }
                    }
                    return block
                })
            }

            // First, find and remove the block from a copy
            const blocksCopy = JSON.parse(JSON.stringify(blocks)) // Deep copy
            const draggedBlock = findAndRemoveBlock(blocksCopy)
            
            if (draggedBlock) {
                console.log('Found dragged block:', draggedBlock)
                
                // Then add it to the target block
                const updatedBlocks = addBlockToContainer(blocksCopy, draggedBlock)
                setBlocks(updatedBlocks)
                onUpdateConditions(updatedBlocks)
            }
        }
        // Regular reordering within the same level
        else if (active.id !== over.id) {
            const oldIndex = blocks.findIndex(b => b.id === active.id)
            const newIndex = blocks.findIndex(b => b.id === over.id)

            if (oldIndex !== -1 && newIndex !== -1) {
                const updatedBlocks = arrayMove(blocks, oldIndex, newIndex)
                setBlocks(updatedBlocks)
                onUpdateConditions(updatedBlocks)
            }
        }
    }

    // Helper function to get all block IDs (including nested ones)
    const getAllBlockIds = (blockList) => {
        const ids = []
        blockList.forEach(block => {
            ids.push(block.id)
            // Also include child blocks
            if (BLOCK_DEFINITIONS[block.type]?.canContainChildren) {
                const childContainers = BLOCK_DEFINITIONS[block.type].childContainers || []
                childContainers.forEach(container => {
                    if (block[container]) {
                        ids.push(...getAllBlockIds(block[container]))
                    }
                })
            }
        })
        return ids
    }

    const categories = ["Logic", "Actions", "Test"]

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'Logic': return <AccountTree />
            case 'Actions': return <PlayArrow />
            case 'Test': return <Functions />
            default: return <Info />
        }
    }

    // Convert VBSP conditions to new block format
    const convertVbspToBlocks = (vbspConditions) => {
        const convertedBlocks = []
        
        // Generate UUID for this conversion to prevent duplicate keys
        const generateUniqueId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Helper function to find instance by path
        const findInstanceByPath = (instancePath) => {
            if (!formData.instances || typeof formData.instances !== 'object') {
                return null
            }
            
            // Normalize the path for comparison
            const normalizedPath = instancePath.replace(/\\/g, '/').toLowerCase()
            
            // Convert instances object to array format for searching
            const instancesArray = Object.entries(formData.instances)
                .filter(([index, instance]) => !instance._toRemove)
                .map(([index, instance]) => ({
                    ...instance,
                    index,
                }))
            
            // First try exact match
            let foundInstance = instancesArray.find(instance => {
                const instancePath = instance.Name.replace(/\\/g, '/').toLowerCase()
                return instancePath === normalizedPath
            })
            
            if (foundInstance) {
                return foundInstance
            }
            
            // If no exact match, try partial match (in case of path differences)
            foundInstance = instancesArray.find(instance => {
                const instancePath = instance.Name.replace(/\\/g, '/').toLowerCase()
                return instancePath.includes(normalizedPath) || normalizedPath.includes(instancePath)
            })
            
            return foundInstance
        }

        // Helper function to find variable by name
        const findVariableByName = (varName) => {
            if (!formData.variables || !Array.isArray(formData.variables)) {
                return null
            }
            
            // Try to find by fixupName with $ prefix
            const withDollar = `$${varName}`
            let foundVariable = formData.variables.find(variable => variable.fixupName === withDollar)
            
            // If not found with $, try without $ (in case the varName already has it)
            if (!foundVariable) {
                foundVariable = formData.variables.find(variable => variable.fixupName === varName)
            }
            
            return foundVariable
        }

        try {
            // Check if we have the expected VBSP structure
            console.log('Full VBSP conditions structure:', vbspConditions)
            
            if (!vbspConditions.Conditions) {
                throw new Error("Invalid VBSP structure: Missing Conditions")
            }
            
            console.log('vbspConditions.Conditions:', vbspConditions.Conditions)
            console.log('Available keys in Conditions:', Object.keys(vbspConditions.Conditions))

            // Handle different VBSP structure patterns
            let conditions = []
            
            if (vbspConditions.Conditions.Condition) {
                // Standard structure with Condition key
                conditions = Array.isArray(vbspConditions.Conditions.Condition) 
                    ? vbspConditions.Conditions.Condition 
                    : [vbspConditions.Conditions.Condition]
            } else {
                // Check for UUID-prefixed Condition keys or other condition patterns
                const allKeys = Object.keys(vbspConditions.Conditions)
                console.log('Checking for condition patterns in keys:', allKeys)
                
                // Look for UUID-prefixed Condition keys (like Condition_uuid)
                const conditionKeys = allKeys.filter(key => key === 'Condition' || key.startsWith('Condition_'))
                
                if (conditionKeys.length > 0) {
                    console.log('Found condition keys:', conditionKeys)
                    conditions = conditionKeys.map(key => vbspConditions.Conditions[key])
                } else {
                    // Look for any keys that contain condition-like structures
                    const structureKeys = allKeys.filter(key => {
                        const obj = vbspConditions.Conditions[key]
                        return obj && typeof obj === 'object' && (
                            obj.Switch || 
                            obj.MapInstVar || 
                            obj.Result ||
                            key.startsWith('Switch_') ||
                            key.startsWith('MapInstVar_')
                        )
                    })
                    
                    if (structureKeys.length > 0) {
                        console.log('Found structure keys:', structureKeys)
                        conditions = structureKeys.map(key => vbspConditions.Conditions[key])
                    } else {
                        // Treat the entire Conditions object as a single condition
                        console.log('Using entire Conditions object as single condition')
                        conditions = [vbspConditions.Conditions]
                    }
                }
            }
            
            console.log('Parsed conditions array:', conditions)
            
            if (conditions.length === 0) {
                console.warn('No conditions found to process!')
                return { success: true, blocks: [] }
            }
            
            // Process each top-level condition
            conditions.forEach((condition, index) => {
                console.log(`Processing condition ${index}:`, condition)
                if (condition) {
                    const processedBlocks = processCondition(condition)
                    console.log(`Condition ${index} produced ${processedBlocks.length} blocks:`, processedBlocks)
                    convertedBlocks.push(...processedBlocks)
                } else {
                    console.warn(`Condition ${index} is null or undefined, skipping`)
                }
            })

            // Recursive function to process any condition structure
            function processCondition(condition) {
                const blocks = []
                
                // Check if condition is valid
                if (!condition || typeof condition !== 'object') {
                    console.warn('processCondition called with invalid condition:', condition)
                    return blocks
                }
                
                // Process MapInstVar blocks
                const mapInstVarKeys = Object.keys(condition).filter(key => key === 'MapInstVar' || key.startsWith('MapInstVar_'))
                mapInstVarKeys.forEach(key => {
                    if (condition[key]) {
                        const mapInstVarBlocks = createMapInstVarBlock(condition[key])
                        blocks.push(...mapInstVarBlocks)
                    }
                })
                
                // Process Switch blocks
                const switchKeys = Object.keys(condition).filter(key => key === 'Switch' || key.startsWith('Switch_'))
                switchKeys.forEach(key => {
                    if (condition[key]) {
                        const switchBlock = createSwitchBlock(condition[key])
                        if (switchBlock) {
                            blocks.push(switchBlock)
                        }
                    }
                })
                
                // Process nested Condition blocks (for If-Else logic)
                const conditionKeys = Object.keys(condition).filter(key => key === 'Condition' || key.startsWith('Condition_'))
                conditionKeys.forEach(key => {
                    const nestedCondition = condition[key]
                    
                    if (!nestedCondition || typeof nestedCondition !== 'object') {
                        console.warn('Invalid nested condition:', nestedCondition)
                        return
                    }
                    
                    // Check if this is an If-Else structure
                    if (nestedCondition.InstVar && (nestedCondition.Result || nestedCondition.Else)) {
                        const ifElseBlock = createIfElseBlock(nestedCondition)
                        blocks.push(ifElseBlock)
                    } else {
                        // Regular nested condition
                        const nestedBlocks = processCondition(nestedCondition)
                        blocks.push(...nestedBlocks)
                    }
                })
                
                // Process Result blocks
                if (condition.Result && typeof condition.Result === 'object') {
                    const resultBlocks = processCondition(condition.Result)
                    blocks.push(...resultBlocks)
                }
                
                return blocks
            }



            // Helper function to create MapInstVar blocks
            function createMapInstVarBlock(mapInstVarData) {
                // Check if this is a timer structure
                const keys = Object.keys(mapInstVarData)
                const timerBlocks = []
                
                keys.forEach(key => {
                    const value = mapInstVarData[key]
                    if (typeof value === 'object' && value !== null) {
                        // Check for timer-related variables
                        const valueKeys = Object.keys(value)
                        const timerVar = valueKeys.find(k => k.startsWith('$') && k.includes('timer'))
                        const delayVar = valueKeys.find(k => k.startsWith('$') && k.includes('delay'))
                        
                        if (timerVar || delayVar) {
                            // This is a timer structure
                            const timerBlock = {
                                id: `timer_${generateUniqueId()}`,
                                type: 'timer',
                                displayName: 'Timer',
                                variable: timerVar || delayVar || 'Unknown',
                                delay: '0',
                                mappings: value
                            }
                            timerBlocks.push(timerBlock)
                        } else {
                            // Check for other variable mappings
                            const varKeys = valueKeys.filter(k => k.startsWith('$'))
                            if (varKeys.length > 0) {
                                const mapInstVarBlock = {
                                    id: `mapInstVar_${generateUniqueId()}`,
                                    type: 'mapInstVar',
                                    displayName: 'Map Instance Variable',
                                    sourceVariable: varKeys[0] || 'Unknown',
                                    targetVariable: 'Unknown',
                                    mappings: value
                                }
                                timerBlocks.push(mapInstVarBlock)
                            }
                        }
                    }
                })
                
                // If we found timer blocks, return them
                if (timerBlocks.length > 0) {
                    return timerBlocks
                }
                
                // Fallback to original logic for non-timer structures
                let sourceVariable = 'Unknown'
                let targetVariable = 'Unknown'
                
                if (keys.length > 0) {
                    const varKeys = keys.filter(key => key.startsWith('$'))
                    if (varKeys.length > 0) {
                        sourceVariable = varKeys[0]
                        const firstValue = mapInstVarData[varKeys[0]]
                        if (typeof firstValue === 'object' && firstValue !== null) {
                            const valueKeys = Object.keys(firstValue)
                            const targetVarKeys = valueKeys.filter(key => key.startsWith('$'))
                            if (targetVarKeys.length > 0) {
                                targetVariable = targetVarKeys[0]
                            }
                        }
                    } else {
                        sourceVariable = keys[0]
                    }
                }
                
                return [{
                    id: `mapInstVar_${generateUniqueId()}`,
                    type: 'mapInstVar',
                    displayName: 'Map Instance Variable',
                    sourceVariable: sourceVariable,
                    targetVariable: targetVariable,
                    mappings: mapInstVarData
                }]
            }

            // Helper function to create If-Else blocks
            function createIfElseBlock(conditionData) {
                const ifElseBlock = {
                    id: `ifElse_${generateUniqueId()}`,
                    type: 'ifElse',
                    displayName: 'If-Else',
                    condition: conditionData.InstVar || '',
                    thenBlocks: [],
                    elseBlocks: []
                }

                // Process Result (Then) blocks
                if (conditionData.Result) {
                    const thenBlocks = processCondition(conditionData.Result)
                    ifElseBlock.thenBlocks = thenBlocks
                }

                // Process Else blocks
                if (conditionData.Else) {
                    const elseBlocks = processCondition(conditionData.Else)
                    ifElseBlock.elseBlocks = elseBlocks
                }

                return ifElseBlock
            }

            // Helper function to create Switch blocks
            function createSwitchBlock(switchData) {
                if (!switchData || typeof switchData !== 'object') {
                    console.warn('createSwitchBlock called with invalid data:', switchData)
                    return null
                }

                const switchBlock = {
                    id: `switch_${generateUniqueId()}`,
                    type: 'switchCase',
                    displayName: 'Switch Case',
                    variable: '',
                    cases: []
                }

                const flag = switchData.Flag || 'instvar'
                const conditions = Object.keys(switchData).filter(key => key !== 'Flag')
                
                // Extract variable from conditions
                if (conditions.length > 0) {
                    const variableCounts = {}
                    conditions.forEach(conditionKey => {
                        const match = conditionKey.match(/^\$([^\s]+)/)
                        if (match) {
                            const varName = match[1]
                            variableCounts[varName] = (variableCounts[varName] || 0) + 1
                        }
                    })
                    
                    // Find the most common variable
                    let maxCount = 0
                    let mostCommonVariable = ''
                    for (const [varName, count] of Object.entries(variableCounts)) {
                        if (count > maxCount) {
                            maxCount = count
                            mostCommonVariable = varName
                        }
                    }
                    
                    if (mostCommonVariable) {
                        const foundVariable = findVariableByName(mostCommonVariable)
                        switchBlock.variable = foundVariable ? foundVariable.fixupName : `$${mostCommonVariable}`
                    }
                }

                // Convert each condition to a case block
                conditions.forEach(conditionKey => {
                    const caseBlock = {
                        id: `case_${generateUniqueId()}`,
                        type: 'case',
                        displayName: 'Case',
                        value: '',
                        thenBlocks: []
                    }

                    // Extract value from condition
                    const valueMatch = conditionKey.match(/[=\s]+(.+)$/)
                    if (valueMatch) {
                        caseBlock.value = valueMatch[1].trim()
                    }

                    // Process the condition data for actions
                    const conditionData = switchData[conditionKey]
                    if (conditionData && typeof conditionData === 'object') {
                        // Handle ChangeInstance
                        if (conditionData.Changeinstance) {
                            const foundInstance = findInstanceByPath(conditionData.Changeinstance)
                            const changeInstanceBlock = {
                                id: `changeInstance_${generateUniqueId()}`,
                                type: 'changeInstance',
                                displayName: 'Change Instance',
                                instanceName: foundInstance ? foundInstance.Name : conditionData.Changeinstance
                            }
                            caseBlock.thenBlocks.push(changeInstanceBlock)
                        }

                        // Handle OffsetInst
                        if (conditionData.OffsetInst) {
                            const offsetBlock = {
                                id: `offsetInst_${generateUniqueId()}`,
                                type: 'offsetInstance',
                                displayName: 'Offset Instance',
                                offset: conditionData.OffsetInst
                            }
                            caseBlock.thenBlocks.push(offsetBlock)
                        }
                    }

                    switchBlock.cases.push(caseBlock)
                })

                return switchBlock
            }



            console.log('VBSP conversion successful:', {
                totalBlocks: convertedBlocks.length,
                blocks: convertedBlocks
            })
            
            return { success: true, blocks: convertedBlocks }
        } catch (error) {
            console.error('VBSP conversion failed:', error)
            return { success: false, error: error.message }
        }
    }



    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                Conditions
            </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Build nested conditional logic using draggable blocks
                </Typography>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, backgroundColor: '#2196F3', borderRadius: 1 }} />
                        <Typography variant="caption" color="text.secondary">Logic</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, backgroundColor: '#4CAF50', borderRadius: 1 }} />
                        <Typography variant="caption" color="text.secondary">Actions</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, backgroundColor: '#FFC107', borderRadius: 1 }} />
                        <Typography variant="caption" color="text.secondary">Test</Typography>
                    </Box>
                </Box>
                </Box>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<Add />}
                    onClick={() => setAddDialogOpen(true)}
                    sx={{ 
                        px: 3,
                        py: 1,
                        background: "linear-gradient(135deg, #d2b019ff 0%, #e6c34d 100%)",
                        "&:hover": {
                            background: "linear-gradient(135deg, #b89415 0%, #d2b019ff 100%)",
                        }
                    }}
                >
                    Add Block
                </Button>
            </Box>

            {/* Blocks List */}
            {blocks.length > 0 ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={getAllBlockIds(blocks)}
                        strategy={verticalListSortingStrategy}
                    >
                        {blocks.map((block) => (
                            <SortableBlock
                                key={block.id}
                                block={block}
                                onUpdateBlock={handleUpdateBlock}
                                onDeleteBlock={handleDeleteBlock}
                                onAddChildBlock={handleAddChildBlock}
                                availableInstances={availableInstances}
                                availableVariables={availableVariables}
                                formData={formData}
                                editingNames={editingNames}
                                blocks={blocks}
                                depth={0}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            ) : (
                                 <Paper 
                     sx={{ 
                         p: 4, 
                         textAlign: "center", 
                         backgroundColor: "#2a2d30",
                         borderRadius: 2,
                         border: "2px dashed",
                         borderColor: "#555"
                     }}
                 >
                    <Box sx={{ mb: 2 }}>
                        <AccountTree sx={{ fontSize: 60, color: "text.secondary", mb: 2 }} />
                    </Box>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No blocks configured
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Click "Add Block" to start building your conditional logic
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={() => setAddDialogOpen(true)}
                    >
                        Create Your First Block
                    </Button>
                </Paper>
            )}
            
            {/* Add Block Dialog */}
            <Dialog 
                open={addDialogOpen} 
                onClose={() => setAddDialogOpen(false)} 
                maxWidth="md" 
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3 }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Add Block
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Choose a block type to add to your configuration
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                            Select Category
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                            {categories.map((category) => (
                                                                 <Chip
                                     key={category}
                                     label={category}
                                     icon={getCategoryIcon(category)}
                                     onClick={() => setSelectedCategory(category)}
                                     color={selectedCategory === category ? "primary" : "default"}
                                     variant={selectedCategory === category ? "filled" : "outlined"}
                                     sx={{ 
                                         borderRadius: 2,
                                         backgroundColor: selectedCategory === category ? "#d2b019ff" : "#3a3a3a",
                                         color: selectedCategory === category ? "#000" : "#c3c7c9ff",
                                         "&:hover": {
                                             transform: "translateY(-1px)",
                                             boxShadow: 2,
                                             backgroundColor: selectedCategory === category ? "#e6c34d" : "#555",
                                         },
                                         transition: "all 0.2s ease-in-out"
                                     }}
                                 />
                            ))}
                        </Stack>
                    </Box>

                    <List sx={{ pt: 0 }}>
                        {Object.entries(BLOCK_DEFINITIONS)
                            .filter(([key, block]) => block.category === selectedCategory)
                            .map(([key, block]) => (
                                <ListItem key={key} disablePadding sx={{ mb: 1 }}>
                                                                         <ListItemButton 
                                         onClick={() => handleAddBlock(key)}
                                         sx={{ 
                                             borderRadius: 2,
                                             border: "1px solid",
                                             borderColor: "#555",
                                             backgroundColor: "#2a2d30",
                                             "&:hover": {
                                                 borderColor: "#d2b019ff",
                                                 backgroundColor: "rgba(210, 176, 25, 0.1)",
                                             },
                                             transition: "all 0.2s ease-in-out"
                                         }}
                                     >
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                    {getCategoryIcon(block.category)}
                                                    {block.displayName}
                                                </Box>
                                            }
                                            secondary={block.description}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                    </List>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button onClick={() => setAddDialogOpen(false)} variant="outlined">
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>


        </Box>
    )
}

export default Conditions 