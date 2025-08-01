import { useEffect, useState } from "react"
import { Box, Tabs, Tab, Button, Stack, Alert, Tooltip } from "@mui/material"
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
} from "@mui/icons-material"
import BasicInfo from "./items/BasicInfo"
import Inputs from "./items/Inputs"
import Instances from "./items/Instances"
import Vbsp from "./items/Vbsp"
import Other from "./items/Other"
import Metadata from "./items/Metadata"
import { useItemContext } from "../contexts/ItemContext"

function ItemEditor() {
    const { item, reloadItem } = useItemContext()
    const [tabValue, setTabValue] = useState(0)
    const [saveError, setSaveError] = useState(null)
    const [showSaveSuccess, setShowSaveSuccess] = useState(false)

    // Form state for all tabs
    const [formData, setFormData] = useState({
        name: "",
        author: "",
        description: "",
        // Add other fields as needed for other tabs
    })

    useEffect(() => {
        // Initialize form data when item changes
        if (item) {
            document.title = `Edit ${item.name}`

            // Initialize form data with loaded item
            const desc = item.details?.Description
            let description = ""

            if (desc && typeof desc === "object") {
                const descValues = Object.keys(desc)
                    .filter((key) => key.startsWith("desc_"))
                    .sort()
                    .map((key) => desc[key])
                    .filter((value) => value && value.trim() !== "")
                    .join("\n")
                    .trim()
                description = descValues
            } else {
                description = desc || ""
            }

            setFormData({
                name: item.name || "",
                author: item.details?.Authors || "",
                description: description,
                // Add other fields here
            })

            // Clear unsaved changes indicator when loading a new item
            window.package?.setUnsavedChanges?.(false)
        }
    }, [item])

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

    const updateFormData = (field, value) => {
        setFormData((prev) => {
            const newData = {
                ...prev,
                [field]: value,
            }

            // Check if data has changed from original item
            const hasChanges =
                newData.name !== (item?.name || "") ||
                newData.author !== (item?.details?.Authors || "") ||
                newData.description !==
                    (() => {
                        const desc = item?.details?.Description
                        if (desc && typeof desc === "object") {
                            const descValues = Object.keys(desc)
                                .filter((key) => key.startsWith("desc_"))
                                .sort()
                                .map((key) => desc[key])
                                .filter((value) => value && value.trim() !== "")
                                .join("\n")
                                .trim()
                            return descValues
                        }
                        return desc || ""
                    })()

            // Update window title with unsaved changes indicator
            window.package?.setUnsavedChanges?.(hasChanges)

            return newData
        })
    }

    const handleSave = async () => {
        try {
            // Validate required fields
            if (!formData.name?.trim()) {
                throw new Error("Item name cannot be empty")
            }

            // Prepare the save data
            const saveData = {
                id: item.id,
                name: formData.name,
                fullItemPath: item.fullItemPath,
                details: {
                    ...item.details,
                    Authors: formData.author,
                    Description: formData.description,
                },
                // Add other fields from formData as needed
            }

            // Send save data via IPC
            const result = await window.package?.saveItem?.(saveData)

            if (result?.success) {
                // Show checkmark icon temporarily
                setShowSaveSuccess(true)
                setSaveError(null)
                setTimeout(() => setShowSaveSuccess(false), 2000)

                // Clear unsaved changes indicator
                window.package?.setUnsavedChanges?.(false)
            } else {
                throw new Error("Failed to save item")
            }
        } catch (error) {
            console.error("Failed to save:", error)
            setSaveError(error.message)
        }
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
                </Tabs>

                {/* Tab Content */}
                <Box sx={{ flex: 1, p: 2, overflow: "auto" }}>
                    <Box sx={{ display: tabValue === 0 ? "block" : "none" }}>
                        <BasicInfo
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 1 ? "block" : "none" }}>
                        <Inputs
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 2 ? "block" : "none" }}>
                        <Instances
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onInstancesChanged={() => reloadItem(item.id)}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 3 ? "block" : "none" }}>
                        <Vbsp
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 4 ? "block" : "none" }}>
                        <Other
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 5 ? "block" : "none" }}>
                        <Metadata item={item} />
                    </Box>
                </Box>
            </Box>

            {/* Save/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Save changes to this item">
                        <Button
                            variant="contained"
                            startIcon={
                                showSaveSuccess ? <CheckCircle /> : <Save />
                            }
                            onClick={handleSave}
                            color={showSaveSuccess ? "success" : "primary"}
                            sx={{ flex: 1 }}>
                            Save
                        </Button>
                    </Tooltip>
                    <Tooltip title="Close editor without saving">
                        <Button
                            variant="outlined"
                            startIcon={<Close />}
                            onClick={() => window.close()}
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
        </Box>
    )
}

export default ItemEditor
