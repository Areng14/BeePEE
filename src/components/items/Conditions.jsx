import { useState, useEffect } from "react"
import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
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
                        Drag action blocks from the left to build your logic
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
            default: return <Info fontSize="small" />
        }
    }

    const getBlockColor = (blockType) => {
        switch (blockType) {
            case 'if': return '#d2b019ff' // Primary gold
            case 'switchCase': return '#9c27b0' // Purple
            case 'case': return '#673ab7' // Deep purple
            case 'changeInstance': return '#1db34fff' // Success green
            case 'addOverlay': return '#dc004e' // Secondary pink
            case 'test': return '#ff9800' // Orange
            default: return '#555'
        }
    }

    const renderBlockContent = () => {
        switch (block.type) {
            case 'if':
                return (
                    <Box sx={{ p: 2 }}>
                        {/* IF Condition Configuration */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                IF Condition
                            </Typography>
                            <Box sx={{ mt: 2 }}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Variable</InputLabel>
                                        <Select
                                            value={block.variable || ""}
                                            onChange={(e) => handleUpdateProperty('variable', e.target.value)}
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
                                <Grid item xs={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Operator</InputLabel>
                                        <Select
                                            value={block.operator || "=="}
                                            onChange={(e) => handleUpdateProperty('operator', e.target.value)}
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
                                <Grid item xs={4}>
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
                                                    onChange={(e) => handleUpdateProperty('value', e.target.value)}
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
                                                        onChange={(e) => handleUpdateProperty('value', e.target.value)}
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
                                                        onChange={(e) => handleUpdateProperty('value', e.target.value)}
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
                                                    onChange={(e) => handleUpdateProperty('value', e.target.value)}
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

                        {/* THEN Section */}
                        <Box>
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
                    </Box>
                )

            case 'changeInstance':
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
                                onChange={(e) => handleUpdateProperty('instanceName', e.target.value)}
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

            case 'addOverlay':
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
                                onChange={(e) => handleUpdateProperty('overlayName', e.target.value)}
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
                                <Grid item xs={12}>
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

                                        if (fullVariableData?.type === "boolean") {
                                            return (
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>Case Value</InputLabel>
                                                    <Select
                                                        value={block.value || "1"}
                                                        onChange={(e) => handleUpdateProperty('value', e.target.value)}
                                                        label="Case Value"
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
                                                    <InputLabel>Case Value</InputLabel>
                                                    <Select
                                                        value={block.value || Object.keys(fullVariableData.enumValues)[0]}
                                                        onChange={(e) => handleUpdateProperty('value', e.target.value)}
                                                        label="Case Value"
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
                                                    label="Case Value"
                                                    type={fullVariableData?.type === "number" ? "number" : "text"}
                                                    value={block.value || ""}
                                                    onChange={(e) => handleUpdateProperty('value', e.target.value)}
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

            case 'test':
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
    }
}

function Conditions({ item, formData, onUpdateConditions, editingNames = {} }) {
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
        // Initialize blocks from formData if available
        if (formData.blocks && Array.isArray(formData.blocks)) {
            setBlocks(formData.blocks)
        }
    }, [formData.blocks])

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

    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                Conditions
            </Typography>
                <Typography variant="body2" color="text.secondary">
                        Build nested conditional logic using draggable blocks
                </Typography>
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