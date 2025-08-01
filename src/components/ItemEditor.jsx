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
    const [iconSrc, setIconSrc] = useState(null)
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

            // Load the icon
            if (item.icon) {
                window.package.loadFile(item.icon).then(setIconSrc)
            }
        }
    }, [item])

    useEffect(() => {
        // Notify backend that editor is ready
        window.package?.editorReady?.()
    }, [])

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    const updateFormData = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }))
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
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Icon Banner */}
            <Box
                sx={{
                    height: 120,
                    background:
                        "linear-gradient(135deg, #d2b019ff 0%, #b8951a 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                <img
                    src={iconSrc || "placeholder.png"}
                    alt={item.name}
                    style={{
                        width: 64,
                        height: 64,
                        border: "2px solid white",
                        borderRadius: 4,
                    }}
                />
            </Box>

            {/* Tabs */}
            <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    minHeight: 48,
                }}>
                <Tooltip title="Basic Info - Edit name, author, description">
                    <Tab icon={<Info />} />
                </Tooltip>
                <Tooltip title="Inputs - Configure item inputs and outputs">
                    <Tab icon={<Input />} />
                </Tooltip>
                <Tooltip title="Instances - Manage item's VMF instances">
                    <Tab icon={<ViewInAr />} />
                </Tooltip>
                <Tooltip title="VBSP - Configure instance swapping and conditions">
                    <Tab icon={<Code />} />
                </Tooltip>
                <Tooltip title="Other - Additional item settings">
                    <Tab icon={<Construction />} />
                </Tooltip>
                <Tooltip title="Metadata - Item metadata and tags">
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

            {/* Save/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Save changes to this item">
                        <Button
                            variant="contained"
                            startIcon={showSaveSuccess ? <CheckCircle /> : <Save />}
                            onClick={handleSave}
                            color={showSaveSuccess ? "success" : "primary"}
                            sx={{ flex: 1 }}
                        >
                            Save
                        </Button>
                    </Tooltip>
                    <Tooltip title="Close editor without saving">
                        <Button
                            variant="outlined"
                            startIcon={<Close />}
                            onClick={() => window.close()}
                            sx={{ flex: 1 }}
                        >
                            Close
                        </Button>
                    </Tooltip>
                </Stack>
                {saveError && (
                    <Alert
                        severity="error"
                        onClose={handleCloseError}
                        sx={{ mt: 2 }}
                    >
                        {saveError}
                    </Alert>
                )}
            </Box>
        </Box>
    )
}

export default ItemEditor
