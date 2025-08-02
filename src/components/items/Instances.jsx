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
    Chip,
} from "@mui/material"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import AddIcon from "@mui/icons-material/Add"
import SwapHorizIcon from "@mui/icons-material/SwapHoriz"
import CodeIcon from "@mui/icons-material/Code"
import SubjectIcon from "@mui/icons-material/Subject"
import { useState, useEffect } from "react"
import ViewInAr from "@mui/icons-material/ViewInAr"

function Instances({ item, deferredChanges, onInstanceChange }) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [instanceToDelete, setInstanceToDelete] = useState(null)
    const [isRemovingMissing, setIsRemovingMissing] = useState(false)

    // Convert item instances to array format for rendering and apply pending changes for UI preview
    const getInstancesWithPendingChanges = () => {
        let instances = item?.instances
            ? Object.entries(item.instances).map(([index, instance]) => ({
                  ...instance,
                  index,
                  status: "existing" // default status
              }))
            : []

        // Mark instances that are pending removal
        if (deferredChanges?.instances?.removed) {
            deferredChanges.instances.removed.forEach(removal => {
                const instanceIndex = instances.findIndex(inst => inst.index === removal.index)
                if (instanceIndex !== -1) {
                    instances[instanceIndex] = {
                        ...instances[instanceIndex],
                        status: "pending-removal"
                    }
                }
            })
        }

        // Mark instances that are pending replacement
        if (deferredChanges?.instances?.replaced) {
            deferredChanges.instances.replaced.forEach(replacement => {
                const instanceIndex = instances.findIndex(inst => inst.index === replacement.index)
                if (instanceIndex !== -1) {
                    instances[instanceIndex] = {
                        ...instances[instanceIndex],
                        status: "pending-replacement"
                    }
                }
            })
        }

        // Add pending additions as preview items
        if (deferredChanges?.instances?.added) {
            deferredChanges.instances.added.forEach((addition, addIndex) => {
                instances.push({
                    Name: `New Instance ${addIndex + 1} (pending)`,
                    index: `pending-add-${addIndex}`,
                    exists: true,
                    status: "pending-addition",
                    source: "pending"
                })
            })
        }

        return instances
    }

    const instances = getInstancesWithPendingChanges()

    // Debug effect to log when instances change
    useEffect(() => {
        console.log("Instances component: Item or instances changed:", {
            itemId: item?.id,
            instanceCount: instances.length,
            instanceNames: instances.map((i) => i.Name),
            instanceExists: instances.map((i) => ({
                name: i.Name,
                exists: i.exists,
            })),
        })
    }, [item, instances])

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
        console.log(
            "Instances: Queueing add instance operation for item:",
            item.id,
        )
        // Queue the add operation for deferred execution
        onInstanceChange("added", { 
            itemId: item.id, 
            timestamp: Date.now() 
        })
        console.log("Instances: Add instance operation queued")
    }

    const handleReplaceInstance = async (instanceIndex) => {
        console.log(
            "Instances: Queueing replace instance operation at index:",
            instanceIndex,
            "for item:",
            item.id,
        )
        // Queue the replace operation for deferred execution
        onInstanceChange("replaced", { 
            itemId: item.id, 
            index: instanceIndex,
            timestamp: Date.now() 
        })
        console.log("Instances: Replace instance operation queued")
    }

    const handleRemoveInstance = async () => {
        if (instanceToDelete === null) return
        console.log(
            "Instances: Queueing remove instance operation at index:",
            instanceToDelete,
            "for item:",
            item.id,
        )
        // Queue the remove operation for deferred execution
        onInstanceChange("removed", { 
            itemId: item.id, 
            index: instanceToDelete,
            timestamp: Date.now() 
        })
        setDeleteDialogOpen(false)
        setInstanceToDelete(null)
        console.log("Instances: Remove instance operation queued")
    }

    const handleRemoveAllMissingInstances = async () => {
        const missingInstances = instances.filter(
            (instance) => !instance.exists && instance.source !== "vbsp",
        )
        if (missingInstances.length === 0) return

        setIsRemovingMissing(true)
        console.log(
            "Instances: Queueing removal of all missing instances (excluding VBSP):",
            missingInstances.length,
            "for item:",
            item.id,
        )
        
        // Queue removal of all missing instances
        for (const instance of missingInstances) {
            onInstanceChange("removed", { 
                itemId: item.id, 
                index: instance.index,
                timestamp: Date.now() 
            })
        }
        
        console.log("Instances: All missing instance removals queued")
        setIsRemovingMissing(false)
    }

    return (
        <Box>
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
                    <Tooltip title="Select a VMF file to add as a new instance">
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleAddInstanceWithFileDialog}>
                            Add VMF Instance
                        </Button>
                    </Tooltip>
                    {instances.some(
                        (instance) =>
                            !instance.exists && instance.source !== "vbsp",
                    ) &&
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
                        const isVBSP = instance.source === "vbsp"
                        const instanceExists = instance.exists !== false // Default to true if not specified
                        const isDisabled = !instanceExists
                        // Use the array index for sequential numbering instead of trying to parse from filename
                        const instanceNumber = arrayIndex

                        // Get visual styling based on instance status
                        const getInstanceStyling = (status, isDisabled) => {
                            switch (status) {
                                case "pending-removal":
                                    return {
                                        backgroundColor: "rgba(244, 67, 54, 0.1)",
                                        borderColor: "error.main",
                                        borderStyle: "dashed",
                                        opacity: 0.7
                                    }
                                case "pending-replacement":
                                    return {
                                        backgroundColor: "rgba(255, 152, 0, 0.1)",
                                        borderColor: "warning.main",
                                        borderStyle: "dashed",
                                        opacity: 0.9
                                    }
                                case "pending-addition":
                                    return {
                                        backgroundColor: "rgba(76, 175, 80, 0.1)",
                                        borderColor: "success.main",
                                        borderStyle: "dashed",
                                        opacity: 0.9
                                    }
                                default:
                                    return {
                                        backgroundColor: isDisabled
                                            ? "rgba(0, 0, 0, 0.3)"
                                            : "background.paper",
                                        borderColor: isDisabled
                                            ? "error.main"
                                            : "divider",
                                        opacity: isDisabled ? 0.8 : 1,
                                    }
                            }
                        }

                        return (
                            <Paper
                                key={instance.Name || `instance-${arrayIndex}`}
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    ...getInstanceStyling(instance.status, isDisabled),
                                    borderWidth: 1,
                                }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{
                                            mr: 1,
                                            minWidth: "auto",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            textDecoration: instance.status === "pending-removal" ? "line-through" : "none"
                                        }}>
                                        <Tooltip
                                            title={
                                                instance.status === "pending-removal" 
                                                    ? "Pending removal"
                                                    : instance.status === "pending-replacement"
                                                    ? "Pending replacement"
                                                    : instance.status === "pending-addition"
                                                    ? "Pending addition"
                                                    : isDisabled
                                                    ? "Missing File"
                                                    : isVBSP
                                                      ? "VBSP Instance"
                                                      : "Editor Instance"
                                            }>
                                            {instance.status === "pending-addition" ? (
                                                <AddIcon fontSize="small" color="success" />
                                            ) : isVBSP ? (
                                                <CodeIcon fontSize="small" />
                                            ) : (
                                                <SubjectIcon fontSize="small" />
                                            )}
                                        </Tooltip>
                                        Instance {instanceNumber}:
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            fontFamily: "monospace",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            flex: 1,
                                            direction: "rtl", // Make text overflow from the left
                                            textAlign: "left", // Keep text aligned normally
                                        }}>
                                        {instance.Name || "(unnamed instance)"}
                                    </Typography>

                                    <Box sx={{ display: "flex", gap: 1 }}>
                                        {instance.status === "pending-addition" ? (
                                            // For pending additions, show cancel button
                                            <Tooltip title="Cancel addition">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => {
                                                        // Remove this pending addition
                                                        const addIndex = parseInt(instance.index.split('-')[2])
                                                        // TODO: Implement cancel add functionality
                                                        console.log("Cancel add for index:", addIndex)
                                                    }}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        ) : (
                                            <>
                                                <Tooltip
                                                    title={
                                                        instance.status === "pending-removal" 
                                                            ? "Cannot edit - pending removal"
                                                            : instance.status === "pending-replacement"
                                                            ? "Cannot edit - pending replacement"
                                                            : isDisabled
                                                            ? "Cannot edit - file is missing"
                                                            : "Edit in Hammer"
                                                    }>
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                                handleEditInstance(
                                                                    item.packagePath,
                                                                    instance.Name,
                                                                )
                                                            }
                                                            disabled={isDisabled || instance.status?.startsWith("pending")}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>

                                                {!isVBSP && instance.status !== "pending-removal" && (
                                                    <Tooltip
                                                        title={
                                                            instance.status === "pending-replacement"
                                                                ? "Already pending replacement"
                                                                : isDisabled
                                                                ? "Replace missing file"
                                                                : "Replace with different VMF"
                                                        }>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                                handleReplaceInstance(
                                                                    instance.index,
                                                                )
                                                            }
                                                            disabled={instance.status === "pending-replacement"}
                                                            color={
                                                                instance.status === "pending-replacement" 
                                                                    ? "default"
                                                                    : isDisabled
                                                                    ? "primary"
                                                                    : "warning"
                                                            }>
                                                            <SwapHorizIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {!isVBSP && (
                                                    <Tooltip 
                                                        title={
                                                            instance.status === "pending-removal"
                                                                ? "Already pending removal"
                                                                : "Delete permanently"
                                                        }>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            disabled={instance.status === "pending-removal"}
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
                                            </>
                                        )}
                                    </Box>
                                </Box>
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
