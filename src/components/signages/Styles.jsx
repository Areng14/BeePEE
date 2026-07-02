import { useState, useEffect } from "react"
import {
    Paper,
    Typography,
    IconButton,
    Box,
    Tooltip,
    Button,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@mui/material"
import {
    Delete,
    Image as ImageIcon,
    Add,
    AddPhotoAlternate,
} from "@mui/icons-material"

// Known BEE2 styles a signage icon can target (see docs_backup/Dev/infotxt.md)
const STYLE_CATALOG = [
    ["BEE2_CLEAN", "Clean"],
    ["BEE2_1950s", "1950s"],
    ["BEE2_1960s", "1960s"],
    ["BEE2_1970s", "1970s"],
    ["BEE2_1980s", "1980s"],
    ["BEE2_PORTAL_1", "Portal 1"],
    ["BEE2_OVERGROWN", "Overgrown"],
    ["BEE2_ART_THERAPY", "Art Therapy"],
]

function StyleCard({ styleId, styleConfig, onStyleChange, onRemove }) {
    const [iconPreview, setIconPreview] = useState(null)

    // Load icon preview
    useEffect(() => {
        if (styleConfig?.icon) {
            // Try to load as file path first
            if (styleConfig.icon.includes("/") || styleConfig.icon.includes("\\")) {
                window.package
                    ?.loadFile(styleConfig.icon)
                    .then(setIconPreview)
                    .catch(() => setIconPreview(null))
            } else {
                setIconPreview(null)
            }
        } else {
            setIconPreview(null)
        }
    }, [styleConfig])

    const handleSelectIcon = async () => {
        try {
            const result = await window.electron.showOpenDialog({
                title: "Select Signage Icon",
                filters: [{ name: "Images", extensions: ["png"] }],
                properties: ["openFile"],
            })
            if (result && result.length > 0) {
                const filePath = result[0]
                onStyleChange(styleId, "icon", filePath)
                onStyleChange(styleId, "_stagedIconPath", filePath)
                // Show preview immediately
                window.package?.loadFile(filePath).then(setIconPreview).catch(() => {})
            }
        } catch (error) {
            console.error("Failed to select icon:", error)
        }
    }

    return (
        <Paper
            sx={{
                p: 2,
                display: "flex",
                alignItems: "center",
                gap: 2,
            }}>
            <Tooltip title="Click to change icon">
                <Box
                    onClick={handleSelectIcon}
                    sx={{
                        width: 96,
                        height: 96,
                        border: "2px dashed",
                        borderColor: "divider",
                        borderRadius: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "background.default",
                        overflow: "hidden",
                        cursor: "pointer",
                        flexShrink: 0,
                        "&:hover": {
                            borderColor: "primary.main",
                            bgcolor: "action.hover",
                        },
                    }}>
                    {iconPreview ? (
                        <img
                            src={iconPreview}
                            alt="Icon"
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                            }}
                        />
                    ) : (
                        <ImageIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                    )}
                </Box>
            </Tooltip>
            <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">{styleId}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {styleConfig?.icon
                        ? "Click image to change"
                        : "No image — click to select"}
                </Typography>
            </Box>
            <Tooltip title="Remove style">
                <IconButton color="error" onClick={() => onRemove(styleId)}>
                    <Delete />
                </IconButton>
            </Tooltip>
        </Paper>
    )
}

function AddStyleDialog({ open, usedStyleIds, onAdd, onClose }) {
    const [styleId, setStyleId] = useState("")
    const [imagePath, setImagePath] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)

    // Reset selections whenever the dialog opens
    useEffect(() => {
        if (open) {
            setStyleId("")
            setImagePath(null)
            setImagePreview(null)
        }
    }, [open])

    const styleOptions = STYLE_CATALOG.filter(
        ([id]) => !usedStyleIds.includes(id),
    )

    const handlePickImage = async () => {
        try {
            const result = await window.electron.showOpenDialog({
                title: "Select Signage Picture",
                filters: [{ name: "Images", extensions: ["png"] }],
                properties: ["openFile"],
            })
            if (result && result.length > 0) {
                const filePath = result[0]
                setImagePath(filePath)
                window.package
                    ?.loadFile(filePath)
                    .then(setImagePreview)
                    .catch(() => setImagePreview(null))
            }
        } catch (error) {
            console.error("Failed to select signage picture:", error)
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Add Signage Style</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Style</InputLabel>
                        <Select
                            value={styleId}
                            label="Style"
                            onChange={(e) => setStyleId(e.target.value)}>
                            {styleOptions.map(([id, label]) => (
                                <MenuItem key={id} value={id}>
                                    {label} ({id})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {styleOptions.length === 0 && (
                        <Typography variant="caption" color="warning.main">
                            All available styles have been added.
                        </Typography>
                    )}

                    <Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 0.5 }}>
                            Signage picture
                        </Typography>
                        <Box
                            onClick={handlePickImage}
                            sx={{
                                border: "2px dashed",
                                borderColor: "divider",
                                borderRadius: 1,
                                height: 130,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 1,
                                bgcolor: "background.default",
                                cursor: "pointer",
                                overflow: "hidden",
                                "&:hover": {
                                    borderColor: "primary.main",
                                    bgcolor: "action.hover",
                                },
                            }}>
                            {imagePreview ? (
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                    }}
                                />
                            ) : (
                                <>
                                    <AddPhotoAlternate
                                        sx={{ fontSize: 34, color: "text.disabled" }}
                                    />
                                    <Typography
                                        variant="body2"
                                        color="text.secondary">
                                        Click to select a PNG
                                    </Typography>
                                </>
                            )}
                        </Box>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose} sx={{ minWidth: 80 }}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={!styleId}
                    onClick={() => onAdd(styleId, imagePath)}
                    sx={{ minWidth: 80 }}>
                    Add
                </Button>
            </DialogActions>
        </Dialog>
    )
}

function SignageStyles({ formData, onUpdate }) {
    const styles = formData.styles || {}
    const [addDialogOpen, setAddDialogOpen] = useState(false)

    const handleStyleChange = (styleId, field, value) => {
        const currentStyle = styles[styleId] || {}
        onUpdate("styles", {
            ...styles,
            [styleId]: {
                ...currentStyle,
                [field]: value,
            },
        })
    }

    const handleAddStyle = (styleId, imagePath) => {
        onUpdate("styles", {
            ...styles,
            [styleId]: imagePath
                ? { icon: imagePath, _stagedIconPath: imagePath }
                : { icon: "" },
        })
        setAddDialogOpen(false)
    }

    const handleRemoveStyle = (styleId) => {
        const { [styleId]: removed, ...rest } = styles
        onUpdate("styles", rest)
    }

    const styleEntries = Object.entries(styles)

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}>
                <Typography variant="h6">Signage Icons</Typography>
                <Button
                    startIcon={<Add />}
                    onClick={() => setAddDialogOpen(true)}
                    variant="outlined"
                    size="small">
                    Add Style
                </Button>
            </Box>

            {styleEntries.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>
                    <Typography color="text.secondary">
                        No icons configured. Add a style and select an image.
                    </Typography>
                </Paper>
            ) : (
                <Stack spacing={1}>
                    {styleEntries.map(([styleId, styleConfig]) => (
                        <StyleCard
                            key={styleId}
                            styleId={styleId}
                            styleConfig={styleConfig}
                            onStyleChange={handleStyleChange}
                            onRemove={handleRemoveStyle}
                        />
                    ))}
                </Stack>
            )}

            <AddStyleDialog
                open={addDialogOpen}
                usedStyleIds={Object.keys(styles)}
                onAdd={handleAddStyle}
                onClose={() => setAddDialogOpen(false)}
            />
        </Box>
    )
}

export default SignageStyles
