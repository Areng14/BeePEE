import { useState, useEffect } from "react"
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Stack,
    Box,
    Typography,
    Alert,
    CircularProgress,
    IconButton,
} from "@mui/material"
import { useTheme } from "@mui/material/styles"
import { ArrowBack } from "@mui/icons-material"
import SignageDesigner from "./SignageDesigner"
import { ShapeSvg, LayersThumb, rasterizeLayers } from "./glyphs"

const stripExt = (n) =>
    n
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim()

function ChoiceCard({ title, desc, icon, onClick }) {
    return (
        <Box
            onClick={onClick}
            sx={{
                flex: 1,
                p: "22px 18px",
                borderRadius: 2,
                cursor: "pointer",
                bgcolor: "#232628",
                border: 1,
                borderColor: "divider",
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                transition: "border-color .12s, transform .12s",
                "&:hover": {
                    borderColor: "primary.main",
                    transform: "translateY(-2px)",
                },
            }}>
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "9px",
                    bgcolor: "background.default",
                    border: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                {icon}
            </Box>
            <Typography fontWeight={700} sx={{ fontSize: 15.5 }}>
                {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                {desc}
            </Typography>
        </Box>
    )
}

function AddSignageDialog({ open, onClose, onCreated }) {
    const theme = useTheme()
    const gold = theme.palette.primary.main

    // ready = { source: "file", name, iconPath, preview } |
    //         { source: "design", name, layers }
    const [ready, setReady] = useState(null)
    const [designerOpen, setDesignerOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState(null)

    // Reset whenever the dialog opens
    useEffect(() => {
        if (open) {
            setReady(null)
            setDesignerOpen(false)
            setError(null)
            setIsCreating(false)
        }
    }, [open])

    const handlePickFile = async () => {
        try {
            const result = await window.electron.showOpenDialog({
                title: "Select Signage Picture",
                filters: [{ name: "Images", extensions: ["png"] }],
                properties: ["openFile"],
            })
            if (result && result.length > 0) {
                const filePath = result[0]
                const fileName = filePath.split(/[\\/]/).pop()
                const preview = await window.package
                    ?.loadFile(filePath)
                    .catch(() => null)
                setReady({
                    source: "file",
                    name: stripExt(fileName) || "New Signage",
                    fileName,
                    iconPath: filePath,
                    preview,
                })
            }
        } catch (err) {
            console.error("Failed to select signage picture:", err)
        }
    }

    const handleCreate = async () => {
        setIsCreating(true)
        setError(null)
        try {
            const payload = { name: ready.name.trim() }
            if (ready.source === "file") {
                payload.iconPath = ready.iconPath
            } else {
                payload.iconData = await rasterizeLayers(ready.layers)
            }
            const result = await window.package.createSignage(payload)
            if (result.success) {
                onCreated?.(result.signageId)
                onClose()
            } else {
                setError(result.error || "Failed to create signage")
            }
        } catch (err) {
            console.error("Failed to create signage:", err)
            setError(err.message || "Failed to create signage")
        } finally {
            setIsCreating(false)
        }
    }

    const sanitizedId = ready
        ? ready.name.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "NAME"
        : ""

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {ready && (
                        <IconButton
                            size="small"
                            onClick={() => setReady(null)}
                            title="Back"
                            sx={{ ml: -1 }}>
                            <ArrowBack fontSize="small" />
                        </IconButton>
                    )}
                    {ready ? "Confirm Signage" : "Add Signage"}
                </DialogTitle>
                <DialogContent>
                    {ready ? (
                        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", pt: 0.5 }}>
                            <Box
                                sx={{
                                    width: 96,
                                    height: 96,
                                    borderRadius: 1,
                                    background: "#0f1011",
                                    border: 1,
                                    borderColor: "divider",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                    flexShrink: 0,
                                }}>
                                {ready.source === "file" ? (
                                    ready.preview ? (
                                        <img
                                            src={ready.preview}
                                            alt=""
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "contain",
                                            }}
                                        />
                                    ) : null
                                ) : (
                                    <LayersThumb layers={ready.layers} size={88} bg="#ffffff" />
                                )}
                            </Box>
                            <Stack spacing={1.25} sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    {ready.source === "file"
                                        ? `Selected file · ${ready.fileName}`
                                        : `Designed · ${ready.layers.length} layer${ready.layers.length === 1 ? "" : "s"}`}
                                </Typography>
                                <TextField
                                    label="Name"
                                    value={ready.name}
                                    autoFocus
                                    size="small"
                                    fullWidth
                                    onChange={(e) =>
                                        setReady({ ...ready, name: e.target.value })
                                    }
                                />
                                <Typography
                                    variant="caption"
                                    color="text.disabled"
                                    sx={{ fontFamily: "ui-monospace, Consolas, monospace" }}>
                                    ID: SIGN_BPEE_{sanitizedId}_####
                                </Typography>
                            </Stack>
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", gap: 1.75, pt: 0.5 }}>
                            <ChoiceCard
                                title="Select existing"
                                desc="Choose a PNG from your computer."
                                icon={<ShapeSvg id="ring" color={gold} w={24} />}
                                onClick={handlePickFile}
                            />
                            <ChoiceCard
                                title="Create your own"
                                desc="Open the drag-and-drop designer to compose a new icon."
                                icon={<ShapeSvg id="plus" color={gold} w={24} />}
                                onClick={() => setDesignerOpen(true)}
                            />
                        </Box>
                    )}
                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="outlined"
                        onClick={onClose}
                        disabled={isCreating}
                        sx={{ minWidth: 80 }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!ready || !ready.name.trim() || isCreating}
                        onClick={handleCreate}
                        startIcon={
                            isCreating ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : null
                        }
                        sx={{ minWidth: 80 }}>
                        {isCreating ? "Adding..." : "Add"}
                    </Button>
                </DialogActions>
            </Dialog>

            {designerOpen && (
                <SignageDesigner
                    onCancel={() => setDesignerOpen(false)}
                    onSave={(sig) => {
                        setDesignerOpen(false)
                        setReady({
                            source: "design",
                            name: sig.name,
                            layers: sig.layers,
                        })
                    }}
                />
            )}
        </>
    )
}

export default AddSignageDialog
