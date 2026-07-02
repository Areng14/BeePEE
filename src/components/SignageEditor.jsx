import { useState, useEffect } from "react"
import {
    Box,
    Tabs,
    Tab,
    Button,
    Stack,
    Alert,
    CircularProgress,
    Tooltip,
    Badge,
} from "@mui/material"
import {
    Info as InfoIcon,
    Palette as PaletteIcon,
    Save,
    Close,
    CheckCircle,
} from "@mui/icons-material"
import { useSignageContext } from "../contexts/SignageContext"
import SignageInfo from "./signages/Info"
import SignageStyles from "./signages/Styles"

function SignageEditor() {
    const { signage } = useSignageContext()
    const [tabValue, setTabValue] = useState(0)
    const [formData, setFormData] = useState({
        id: "",
        name: "",
        hidden: false,
        secondary: "",
        styles: {},
    })
    const [availableSignages, setAvailableSignages] = useState([])
    const [showIds, setShowIds] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)
    const [showSaveSuccess, setShowSaveSuccess] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Fetch available signages for dropdown
    useEffect(() => {
        const fetchSignages = async () => {
            try {
                const signages = await window.package.getCurrentSignages?.()
                if (signages) {
                    setAvailableSignages(signages)
                }
            } catch (error) {
                console.warn("Failed to fetch signages:", error)
            }
        }
        fetchSignages()

        // Load showItemIds setting (also controls signage ID visibility)
        const loadShowIdsSetting = async () => {
            try {
                const result = await window.package.getSetting("showItemIds")
                if (result.success && result.value !== undefined) {
                    setShowIds(result.value)
                }
            } catch (error) {
                console.log("Failed to load showItemIds setting:", error)
            }
        }
        loadShowIdsSetting()
    }, [])

    // Initialize form from signage
    useEffect(() => {
        if (signage) {
            document.title = `Edit Signage: ${signage.name || signage.id}`
            setFormData({
                id: signage.id || "",
                name: signage.name || "",
                hidden: signage.hidden || false,
                secondary: signage.secondary || "",
                styles: signage.styles || {},
            })
            setHasChanges(false)
        }
    }, [signage])

    // Add class to body to hide scrollbars (matching ItemEditor)
    useEffect(() => {
        document.body.classList.add("item-editor-active")
        return () => {
            document.body.classList.remove("item-editor-active")
        }
    }, [])

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    const handleUpdate = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
        setHasChanges(true)
        setSaveError(null)
    }

    const handleSave = async () => {
        if (!signage) return

        setIsSaving(true)
        setSaveError(null)

        try {
            const result = await window.package.saveSignage({
                ...formData,
                originalId: signage.id,
            })

            if (result.success) {
                setShowSaveSuccess(true)
                setHasChanges(false)
                setTimeout(() => setShowSaveSuccess(false), 2000)
            } else {
                setSaveError(result.error || "Failed to save signage")
            }
        } catch (error) {
            console.error("Failed to save signage:", error)
            setSaveError(error.message || "Failed to save signage")
        } finally {
            setIsSaving(false)
        }
    }

    const handleClose = () => {
        window.close()
    }

    if (!signage) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                }}>
                <CircularProgress />
            </Box>
        )
    }

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
                    scrollButtons={false}
                    sx={{
                        borderRight: 1,
                        borderColor: "divider",
                        minWidth: 56,
                        maxWidth: 56,
                        bgcolor: "background.paper",
                        "& .MuiTabs-indicator": {
                            left: 0,
                            width: 3,
                        },
                        "& .MuiTab-root": {
                            minWidth: 56,
                            width: 56,
                            minHeight: 48,
                            alignItems: "center",
                            justifyContent: "center",
                        },
                    }}>
                    <Tooltip
                        title="Info - Edit signage ID, name, and dual sign configuration"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={!hasChanges}>
                                    <InfoIcon />
                                </Badge>
                            }
                        />
                    </Tooltip>
                    <Tooltip
                        title="Styles - Configure how signage appears in different BEE2 styles"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={!hasChanges}>
                                    <PaletteIcon />
                                </Badge>
                            }
                        />
                    </Tooltip>
                </Tabs>

                {/* Tab Content */}
                <Box sx={{ flex: 1, p: 2, overflow: "auto" }}>
                    <Box sx={{ display: tabValue === 0 ? "block" : "none" }}>
                        <SignageInfo
                            formData={formData}
                            onUpdate={handleUpdate}
                            availableSignages={availableSignages}
                            showId={showIds}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 1 ? "block" : "none" }}>
                        <SignageStyles formData={formData} onUpdate={handleUpdate} />
                    </Box>
                </Box>
            </Box>

            {/* Footer with Save/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1}>
                    <Tooltip
                        title={
                            hasChanges
                                ? "Save changes to signage"
                                : "No unsaved changes"
                        }>
                        <Button
                            variant="contained"
                            startIcon={
                                isSaving ? (
                                    <CircularProgress size={20} color="inherit" />
                                ) : showSaveSuccess ? (
                                    <CheckCircle />
                                ) : (
                                    <Save />
                                )
                            }
                            onClick={handleSave}
                            color={showSaveSuccess ? "success" : "primary"}
                            disabled={!hasChanges || isSaving}
                            sx={{ flex: 1 }}>
                            {isSaving
                                ? "Saving..."
                                : showSaveSuccess
                                  ? "Saved!"
                                  : "Save"}
                        </Button>
                    </Tooltip>
                    <Tooltip
                        title={
                            hasChanges
                                ? "Close editor (unsaved changes will be lost)"
                                : "Close editor"
                        }>
                        <Button
                            variant="outlined"
                            startIcon={<Close />}
                            onClick={handleClose}
                            color={hasChanges ? "error" : "primary"}
                            sx={{ flex: 1 }}>
                            {hasChanges ? "Discard" : "Close"}
                        </Button>
                    </Tooltip>
                </Stack>
                {saveError && (
                    <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSaveError(null)}>
                        {saveError}
                    </Alert>
                )}
            </Box>
        </Box>
    )
}

export default SignageEditor
