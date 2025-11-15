import {
    Box,
    Typography,
    Stack,
    Paper,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    DialogContentText,
    Tooltip,
    Collapse,
    Chip,
    Divider,
    TextField,
} from "@mui/material"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import AddIcon from "@mui/icons-material/Add"
import SwapHorizIcon from "@mui/icons-material/SwapHoriz"
import CodeIcon from "@mui/icons-material/Code"
import SubjectIcon from "@mui/icons-material/Subject"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import InfoIcon from "@mui/icons-material/Info"
import LabelIcon from "@mui/icons-material/Label"
import { useState, useEffect } from "react"
import ViewInAr from "@mui/icons-material/ViewInAr"

function Instances({
    item,
    formData,
    onUpdateInstances,
    editingNames,
    setEditingNames,
}) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [instanceToDelete, setInstanceToDelete] = useState(null)
    const [isRemovingMissing, setIsRemovingMissing] = useState(false)
    const [expandedStats, setExpandedStats] = useState(new Set())

    // Convert formData instances to array format for rendering
    const instances = formData?.instances
        ? Object.entries(formData.instances)
              .filter(([index, instance]) => !instance._toRemove) // Hide instances marked for removal
              .map(([index, instance]) => ({
                  ...instance,
                  index,
              }))
        : []

    // Debug effect to log when instances change
    useEffect(() => {
        console.log("Instances component: Item or instances changed:", {
            itemId: item?.id,
            instanceCount: instances.length,
            instanceNames: instances.map((i) => i.Name),
            instanceExists: instances.map((i) => ({
                name: i.Name,
                exists: i._metadata?.exists ?? true,
            })),
        })
    }, [item, instances])

    const toggleStatsExpansion = (instanceIndex) => {
        setExpandedStats((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(instanceIndex)) {
                newSet.delete(instanceIndex)
            } else {
                newSet.add(instanceIndex)
            }
            return newSet
        })
    }

    const handleEditInstance = async (packagePath, instancePath) => {
        try {
            await window.package.editInstance({
                packagePath,
                instanceName: instancePath,
                itemId: item.id,
            })
        } catch (error) {
            console.error("Failed to edit instance:", error)
        }
    }

    const handleAddInstanceWithFileDialog = async () => {
        console.log("Instances: Selecting instance file(s) for item:", item.id)
        try {
            const result = await window.package.selectInstanceFile(item.id)
            console.log("Instances: File dialog result:", result)
            if (result.success && result.files && result.files.length > 0) {
                // Start with current instances
                let updatedInstances = { ...formData.instances }

                // Process each selected file
                for (const fileResult of result.files) {
                    if (fileResult.success) {
                        // Generate a unique index for each new instance
                        const newIndex = `pending_${Date.now()}_${Math.random()
                            .toString(36)
                            .substr(2, 9)}` // Use timestamp + random string to ensure uniqueness

                        // Create new instance object with pending data
                        const newInstance = {
                            Name: fileResult.instanceName,
                            _pending: true,
                            _filePath: fileResult.filePath, // Store the source file path for when we actually save
                        }

                        // Add to instances collection
                        updatedInstances[newIndex] = newInstance

                        console.log(
                            `Instances: Added pending instance: ${newInstance.Name} (will be saved on Save button)`,
                        )

                        // Small delay to ensure unique timestamps
                        await new Promise((resolve) => setTimeout(resolve, 10))
                    } else {
                        console.error(
                            "Instances: Failed to process file:",
                            fileResult.error,
                        )
                    }
                }

                // Update formData with all new pending instances
                onUpdateInstances(updatedInstances)
                console.log(
                    `Instances: Added ${result.files.length} pending instance(s)`,
                )
            } else if (!result.canceled) {
                console.error(
                    "Instances: Failed to select instance:",
                    result.error,
                )
            }
        } catch (error) {
            console.error("Instances: Failed to select instance:", error)
        }
    }

    const handleReplaceInstance = async (instanceIndex) => {
        console.log(
            "Instances: Replacing instance at index:",
            instanceIndex,
            "for item:",
            item.id,
        )
        try {
            const result = await window.package.replaceInstanceFileDialog(
                item.id,
                instanceIndex,
            )
            if (result.success) {
                // Update the local formData to match the backend change
                const existingInstance = formData.instances[instanceIndex]
                const updatedInstance = {
                    ...existingInstance,
                    Name: result.instanceName || existingInstance.Name,
                }

                const updatedInstances = {
                    ...formData.instances,
                    [instanceIndex]: updatedInstance,
                }

                onUpdateInstances(updatedInstances)
                console.log(
                    `Instances: Replaced instance: ${updatedInstance.Name}`,
                )
            } else if (!result.canceled) {
                console.error(
                    "Instances: Failed to replace instance:",
                    result.error,
                )
            }
        } catch (error) {
            console.error("Instances: Failed to replace instance:", error)
        }
    }

    const handleRemoveInstance = () => {
        if (instanceToDelete === null) return
        console.log(
            "Instances: Marking instance for removal at index:",
            instanceToDelete,
            "for item:",
            item.id,
        )
        try {
            const updatedInstances = { ...formData.instances }
            const instanceData = updatedInstances[instanceToDelete]

            if (instanceData && instanceData._pending) {
                // If it's a pending instance (not yet saved), just remove it completely
                delete updatedInstances[instanceToDelete]
                console.log(
                    "Instances: Removed pending instance (not saved yet)",
                )
            } else {
                // Mark existing instance for removal
                updatedInstances[instanceToDelete] = {
                    ...instanceData,
                    _toRemove: true,
                }
                console.log(
                    "Instances: Marked instance for removal (will be deleted on Save)",
                )
            }

            onUpdateInstances(updatedInstances)
            setDeleteDialogOpen(false)
            setInstanceToDelete(null)
        } catch (error) {
            console.error(
                "Instances: Failed to mark instance for removal:",
                error,
            )
        }
    }

    const handleRemoveAllMissingInstances = () => {
        const missingInstances = instances.filter((instance) => {
            const metadata = instance._metadata || {
                exists: true,
                source: "editor",
            }
            return !metadata.exists && metadata.source !== "vbsp"
        })
        if (missingInstances.length === 0) return

        setIsRemovingMissing(true)
        console.log(
            "Instances: Marking all missing instances for removal (excluding VBSP):",
            missingInstances.length,
            "for item:",
            item.id,
        )

        try {
            const updatedInstances = { ...formData.instances }

            missingInstances.forEach((instance) => {
                const instanceData = updatedInstances[instance.index]
                if (instanceData && instanceData._pending) {
                    // If it's a pending instance (not yet saved), just remove it completely
                    delete updatedInstances[instance.index]
                } else {
                    // Mark existing instance for removal
                    updatedInstances[instance.index] = {
                        ...instanceData,
                        _toRemove: true,
                    }
                }
            })

            onUpdateInstances(updatedInstances)
            console.log(
                "Instances: All missing instances marked for removal (will be deleted on Save)",
            )
        } catch (error) {
            console.error(
                "Instances: Failed to mark missing instances for removal:",
                error,
            )
        } finally {
            setIsRemovingMissing(false)
        }
    }

    return (
        <Box
            sx={{
                overflow: "hidden",
                "&::-webkit-scrollbar": {
                    display: "none",
                },
                msOverflowStyle: "none",
                scrollbarWidth: "none",
            }}>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}>
                <Typography variant="h6">
                    Instance Files ({instances.length})
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Tooltip title="Select one or more VMF files to add as new instances">
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleAddInstanceWithFileDialog}>
                            Add VMF Instance(s)
                        </Button>
                    </Tooltip>
                    {instances.some((instance) => {
                        const metadata = instance._metadata || {
                            exists: true,
                            source: "editor",
                        }
                        return !metadata.exists && metadata.source !== "vbsp"
                    }) &&
                        !isRemovingMissing && (
                            <Tooltip title="Remove all instances with missing files (excluding VBSP instances)">
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={handleRemoveAllMissingInstances}
                                    size="small">
                                    Remove Missing
                                </Button>
                            </Tooltip>
                        )}
                </Box>
            </Box>

            {instances.length > 0 ? (
                <Stack spacing={2}>
                    {instances.map((instance, arrayIndex) => {
                        // Get metadata from the instance or fallback to defaults
                        const metadata = instance._metadata || {
                            exists: true,
                            source: "editor",
                        }
                        const isVBSP = metadata.source === "vbsp"
                        const instanceExists = metadata.exists
                        const isDisabled = !instanceExists
                        const isPending = instance._pending === true
                        // Use the array index for sequential numbering instead of trying to parse from filename
                        const instanceNumber = arrayIndex

                        const hasStats =
                            instanceExists &&
                            !isVBSP &&
                            (instance.EntityCount > 0 ||
                                instance.BrushCount > 0 ||
                                instance.BrushSideCount > 0)
                        const isStatsExpanded = expandedStats.has(
                            instance.index,
                        )

                        return (
                            <Paper
                                key={instance.Name || "unknown"}
                                variant="outlined"
                                sx={{
                                    backgroundColor: isDisabled
                                        ? "rgba(0, 0, 0, 0.3)"
                                        : "background.paper",
                                    borderColor: isDisabled
                                        ? "error.main"
                                        : "divider",
                                    borderWidth: isDisabled ? 1 : 1,
                                    opacity: isDisabled ? 0.8 : 1,
                                }}>
                                <Box sx={{ p: 2 }}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            width: "100%",
                                            minWidth: 0,
                                        }}>
                                        {/* Instance Type Icon */}
                                        <Tooltip
                                            title={
                                                isDisabled
                                                    ? "Missing File"
                                                    : isVBSP
                                                      ? "VBSP Instance"
                                                      : "Editor Instance"
                                            }>
                                            {isVBSP ? (
                                                <CodeIcon fontSize="small" />
                                            ) : (
                                                <SubjectIcon fontSize="small" />
                                            )}
                                        </Tooltip>

                                        {/* Instance Name - Always Editable */}
                                        <Box
                                            sx={{
                                                minWidth: "120px",
                                                maxWidth: "250px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                            }}>
                                            <TextField
                                                size="small"
                                                value={
                                                    editingNames[
                                                        instance.index
                                                    ] !== undefined
                                                        ? editingNames[
                                                              instance.index
                                                          ]
                                                        : instance.displayName ||
                                                          `Instance ${instanceNumber}`
                                                }
                                                onChange={(e) => {
                                                    // Just update the local state, don't save to meta.json yet
                                                    const newName =
                                                        e.target.value
                                                    setEditingNames((prev) => ({
                                                        ...prev,
                                                        [instance.index]:
                                                            newName,
                                                    }))
                                                }}
                                                placeholder={`Instance ${instanceNumber}`}
                                                sx={{
                                                    minWidth: "100px",
                                                    maxWidth: "230px",
                                                    "& .MuiInputBase-input": {
                                                        fontSize: "0.875rem",
                                                        fontWeight: "medium",
                                                        color: "text.primary",
                                                    },
                                                    "& .MuiOutlinedInput-root":
                                                        {
                                                            "& fieldset": {
                                                                borderColor:
                                                                    "transparent",
                                                            },
                                                            "&:hover fieldset":
                                                                {
                                                                    borderColor:
                                                                        "divider",
                                                                },
                                                            "&.Mui-focused fieldset":
                                                                {
                                                                    borderColor:
                                                                        "primary.main",
                                                                },
                                                        },
                                                }}
                                            />
                                        </Box>

                                        {/* Instance Path */}
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                fontFamily: "monospace",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                flex: 1,
                                                minWidth: 0,
                                                maxWidth: "100%",
                                                fontSize: "0.75rem",
                                            }}>
                                            {instance.Name ||
                                                "(unnamed instance)"}
                                        </Typography>

                                        <Box
                                            sx={{
                                                display: "flex",
                                                gap: 1,
                                                flexShrink: 0,
                                            }}>
                                            {hasStats && (
                                                <Tooltip
                                                    title={
                                                        isStatsExpanded
                                                            ? "Hide VMF stats"
                                                            : "Show VMF stats"
                                                    }>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            toggleStatsExpansion(
                                                                instance.index,
                                                            )
                                                        }
                                                        color="info">
                                                        {isStatsExpanded ? (
                                                            <ExpandLessIcon fontSize="small" />
                                                        ) : (
                                                            <ExpandMoreIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                            )}

                                            <Tooltip
                                                title={
                                                    isDisabled
                                                        ? "Cannot edit - file is missing"
                                                        : "Edit this instance file in Hammer"
                                                }>
                                                <span>
                                                    {" "}
                                                    {/* Wrapper needed for disabled IconButton */}
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            handleEditInstance(
                                                                item.packagePath,
                                                                instance.Name,
                                                            )
                                                        }
                                                        disabled={isDisabled}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>

                                            {!isVBSP && (
                                                <Tooltip
                                                    title={
                                                        isDisabled
                                                            ? "Replace missing file with a VMF file"
                                                            : "Replace this instance file with a different VMF file"
                                                    }>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            handleReplaceInstance(
                                                                instance.index,
                                                            )
                                                        }
                                                        color={
                                                            isDisabled
                                                                ? "primary"
                                                                : "warning"
                                                        }>
                                                        <SwapHorizIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}

                                            {!isVBSP && (
                                                <Tooltip title="Delete this instance permanently">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => {
                                                            setInstanceToDelete(
                                                                instance.index,
                                                            )
                                                            setDeleteDialogOpen(
                                                                true,
                                                            )
                                                        }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Expandable Stats Section */}
                                {hasStats && (
                                    <Collapse in={isStatsExpanded}>
                                        <Divider />
                                        <Box sx={{ p: 2, pt: 1.5 }}>
                                            <Typography
                                                variant="subtitle2"
                                                sx={{
                                                    mb: 1,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}>
                                                <InfoIcon fontSize="small" />
                                                VMF Statistics
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    gap: 1,
                                                    flexWrap: "wrap",
                                                }}>
                                                <Chip
                                                    label={`${instance.EntityCount || 0} Entities`}
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                />
                                                <Chip
                                                    label={`${instance.BrushCount || 0} Brushes`}
                                                    size="small"
                                                    variant="outlined"
                                                    color="secondary"
                                                />
                                                <Chip
                                                    label={`${instance.BrushSideCount || 0} Brush Sides`}
                                                    size="small"
                                                    variant="outlined"
                                                    color="success"
                                                />
                                            </Box>
                                        </Box>
                                    </Collapse>
                                )}
                            </Paper>
                        )
                    })}
                </Stack>
            ) : (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        p: 4,
                        textAlign: "center",
                    }}>
                    <ViewInAr
                        sx={{
                            fontSize: 48,
                            color: "text.secondary",
                            opacity: 0.5,
                        }}
                    />
                    <Typography variant="h6" color="text.secondary">
                        No Instances Yet
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}>
                        Add your first instance to this item using the button
                        above
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddInstanceWithFileDialog}>
                        Add First VMF Instance
                    </Button>
                </Box>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: "#1e1e1e",
                        color: "white",
                        minWidth: "300px",
                    },
                }}>
                <DialogTitle>Delete Instance?</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: "rgba(255,255,255,0.8)" }}>
                        Are you sure you want to delete this instance? This
                        action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{ color: "rgba(255,255,255,0.6)" }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRemoveInstance}
                        color="error"
                        variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Instances
