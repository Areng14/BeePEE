import { useEffect, useState } from "react"
import { Box, Tabs, Tab, Button, Stack, Alert, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Paper, Chip, Typography } from "@mui/material"
import {
    Info,
    Input,
    ViewInAr,
    Code,
    Save,
    Close,
    Construction,
    CheckCircle,
    Description,
    Assignment,
} from "@mui/icons-material"
import BasicInfo from "./items/BasicInfo"
import Inputs from "./items/Inputs"
import Instances from "./items/Instances"
import Vbsp from "./items/Vbsp"
import Other from "./items/Other"
import Metadata from "./items/Metadata"
import PendingChanges from "./items/PendingChanges"
import { useItemContext } from "../contexts/ItemContext"

function ItemEditor() {
    const { 
        item, 
        reloadItem, 
        deferredChanges, 
        updateDeferredChanges, 
        addDeferredInstanceChange, 
        undoDeferredChange,
        hasUnsavedChanges, 
        applyDeferredChanges, 
        clearDeferredChanges 
    } = useItemContext()
    const [tabValue, setTabValue] = useState(0)
    const [saveError, setSaveError] = useState(null)
    const [showSaveSuccess, setShowSaveSuccess] = useState(false)
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false)

    useEffect(() => {
        // Initialize when item changes
        if (item) {
            document.title = `Edit ${item.name}`

            // Clear deferred changes when loading a new item
            clearDeferredChanges()

            // Clear unsaved changes indicator when loading a new item
            window.package?.setUnsavedChanges?.(false)
        }
    }, [item, clearDeferredChanges])

    useEffect(() => {
        // Notify backend that editor is ready
        window.package?.editorReady?.()

        // Add class to body to hide scrollbars for ItemEditor
        document.body.classList.add("item-editor-active")

        // Cleanup: remove class when component unmounts
        return () => {
            document.body.classList.remove("item-editor-active")
        }
    }, [])

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    // Update unsaved changes indicator whenever deferred changes change
    useEffect(() => {
        window.package?.setUnsavedChanges?.(hasUnsavedChanges())
    }, [hasUnsavedChanges])

    const handleApply = async () => {
        try {
            const currentName = deferredChanges.basicInfo.name !== undefined 
                ? deferredChanges.basicInfo.name 
                : item?.name
            
            // Validate required fields
            if (!currentName?.trim()) {
                throw new Error("Item name cannot be empty")
            }

            // Apply all deferred changes
            const result = await applyDeferredChanges()

            if (result?.success) {
                // Show checkmark icon temporarily
                setShowSaveSuccess(true)
                setSaveError(null)
                setTimeout(() => setShowSaveSuccess(false), 2000)
            } else {
                throw new Error(result?.error || "Failed to apply changes")
            }
        } catch (error) {
            console.error("Failed to apply changes:", error)
            setSaveError(error.message)
        }
    }

    const handleClose = () => {
        if (hasUnsavedChanges()) {
            setShowCloseConfirmation(true)
        } else {
            window.close()
        }
    }

    const handleConfirmClose = () => {
        setShowCloseConfirmation(false)
        clearDeferredChanges()
        window.close()
    }

    const handleCancelClose = () => {
        setShowCloseConfirmation(false)
    }

    const handleCloseError = () => {
        setSaveError(null)
    }

    if (!item) return null

    console.log(item)

    return (
        <Box
            sx={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}>
            {/* Main Content Area with Vertical Sidebar */}
            <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Vertical Sidebar */}
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    orientation="vertical"
                    variant="scrollable"
                    sx={{
                        borderRight: 1,
                        borderColor: "divider",
                        minWidth: 80,
                        maxWidth: 80,
                        bgcolor: "background.paper",
                        "& .MuiTabs-indicator": {
                            left: 0,
                            width: 3,
                        },
                        "& .MuiTab-root": {
                            minWidth: 80,
                            width: 80,
                            alignItems: "center",
                            justifyContent: "center",
                        },
                    }}>
                    <Tooltip
                        title="Basic Info - Edit name, author, description"
                        placement="right">
                        <Tab icon={<Info />} />
                    </Tooltip>
                    <Tooltip
                        title="Inputs - Configure item inputs and outputs"
                        placement="right">
                        <Tab icon={<Input />} />
                    </Tooltip>
                    <Tooltip
                        title="Instances - Manage item's VMF instances"
                        placement="right">
                        <Tab icon={<ViewInAr />} />
                    </Tooltip>
                    <Tooltip
                        title="VBSP - Configure instance swapping and conditions"
                        placement="right">
                        <Tab icon={<Code />} />
                    </Tooltip>
                    <Tooltip
                        title="Other - Additional item settings"
                        placement="right">
                        <Tab icon={<Construction />} />
                    </Tooltip>
                    <Tooltip
                        title="Metadata - Item metadata and tags"
                        placement="right">
                        <Tab icon={<Description />} />
                    </Tooltip>
                    <Tooltip
                        title="Pending Changes - Review changes before applying"
                        placement="right">
                        <Tab 
                            icon={<Assignment />} 
                            sx={{
                                '& .MuiSvgIcon-root': {
                                    color: hasUnsavedChanges() ? 'warning.main' : 'inherit'
                                }
                            }}
                        />
                    </Tooltip>
                </Tabs>

                {/* Tab Content */}
                <Box sx={{ flex: 1, p: 2, overflow: "auto" }}>
                    <Box sx={{ display: tabValue === 0 ? "block" : "none" }}>
                        <BasicInfo
                            item={item}
                            deferredChanges={deferredChanges}
                            onUpdate={(field, value) => updateDeferredChanges('basicInfo', { [field]: value })}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 1 ? "block" : "none" }}>
                        <Inputs
                            item={item}
                            deferredChanges={deferredChanges}
                            onUpdate={(field, value) => updateDeferredChanges('inputs', { [field]: value })}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 2 ? "block" : "none" }}>
                        <Instances
                            item={item}
                            deferredChanges={deferredChanges}
                            onInstanceChange={addDeferredInstanceChange}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 3 ? "block" : "none" }}>
                        <Vbsp
                            item={item}
                            deferredChanges={deferredChanges}
                            onUpdate={(field, value) => updateDeferredChanges('vbsp', { [field]: value })}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 4 ? "block" : "none" }}>
                        <Other
                            item={item}
                            deferredChanges={deferredChanges}
                            onUpdate={(field, value) => updateDeferredChanges('other', { [field]: value })}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 5 ? "block" : "none" }}>
                        <Metadata item={item} />
                    </Box>
                    <Box sx={{ display: tabValue === 6 ? "block" : "none" }}>
                        <PendingChanges 
                            item={item}
                            deferredChanges={deferredChanges}
                            onUndo={undoDeferredChange}
                        />
                    </Box>
                </Box>
            </Box>



            {/* Apply/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Apply all changes to this item">
                        <Button
                            variant="contained"
                            startIcon={
                                showSaveSuccess ? <CheckCircle /> : <Save />
                            }
                            onClick={handleApply}
                            color={showSaveSuccess ? "success" : "primary"}
                            disabled={!hasUnsavedChanges()}
                            sx={{ flex: 1 }}>
                            Apply
                        </Button>
                    </Tooltip>
                    <Tooltip title="Close editor">
                        <Button
                            variant="outlined"
                            startIcon={<Close />}
                            onClick={handleClose}
                            sx={{ flex: 1 }}>
                            Close
                        </Button>
                    </Tooltip>
                </Stack>
                {saveError && (
                    <Alert
                        severity="error"
                        onClose={handleCloseError}
                        sx={{ mt: 2 }}>
                        {saveError}
                    </Alert>
                )}
            </Box>

            {/* Unsaved Changes Confirmation Dialog */}
            <Dialog
                open={showCloseConfirmation}
                onClose={handleCancelClose}
                PaperProps={{
                    sx: {
                        bgcolor: "#1e1e1e",
                        color: "white",
                        minWidth: "400px",
                    },
                }}>
                <DialogTitle>Unsaved Changes</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: "rgba(255,255,255,0.8)" }}>
                        You have unsaved changes that will be lost if you close now.
                        Do you want to close without applying your changes?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleCancelClose}
                        sx={{ color: "rgba(255,255,255,0.6)" }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmClose}
                        color="error"
                        variant="contained">
                        Close Without Applying
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default ItemEditor
