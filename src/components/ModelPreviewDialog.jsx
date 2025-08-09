import { useState, useEffect } from "react"
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    IconButton,
    Chip,
    Divider,
    Alert,
} from "@mui/material"
import {
    Close as CloseIcon,
    Refresh as RefreshIcon,
    Fullscreen as FullscreenIcon,
    Info as InfoIcon,
} from "@mui/icons-material"
import { ModelViewerWithErrorBoundary } from "./ModelViewer"

export default function ModelPreviewDialog({
    open,
    onClose,
    instanceName,
    objPath,
    mtlPath,
    packageName,
}) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [modelInfo, setModelInfo] = useState(null)

    // Get model file info when dialog opens
    useEffect(() => {
        if (open && objPath) {
            // Try to get file stats from the backend
            window.package
                ?.getFileStats?.(objPath)
                .then((stats) => setModelInfo(stats))
                .catch(() => setModelInfo(null))
        }
    }, [open, objPath])

    const handleToggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    const handleRefresh = () => {
        // Force re-render by clearing and setting the path
        const currentPath = objPath
        setModelInfo(null)
        // Trigger re-load after a brief delay
        setTimeout(() => {
            if (currentPath && window.package?.getFileStats) {
                window.package
                    .getFileStats(currentPath)
                    .then((stats) => setModelInfo(stats))
                    .catch(() => setModelInfo(null))
            }
        }, 100)
    }

    const viewerWidth = isFullscreen ? "90vw" : 600
    const viewerHeight = isFullscreen ? "70vh" : 400

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={isFullscreen ? false : "md"}
            fullWidth
            fullScreen={isFullscreen}
            PaperProps={{
                sx: {
                    minHeight: isFullscreen ? "100vh" : 500,
                    backgroundColor: "#fafafa",
                },
            }}>
            <DialogTitle>
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between">
                    <Box>
                        <Typography variant="h6" component="div">
                            3D Model Preview
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={1}>
                            {instanceName && (
                                <Chip
                                    label={instanceName}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                            {packageName && (
                                <Chip
                                    label={packageName}
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                        </Box>
                    </Box>
                    <Box>
                        <IconButton
                            onClick={handleRefresh}
                            title="Refresh model">
                            <RefreshIcon />
                        </IconButton>
                        <IconButton
                            onClick={handleToggleFullscreen}
                            title="Toggle fullscreen">
                            <FullscreenIcon />
                        </IconButton>
                        <IconButton onClick={onClose} title="Close">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 2 }}>
                {!objPath ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            No model file available. Convert the instance to OBJ
                            first.
                        </Typography>
                    </Alert>
                ) : (
                    <Box>
                        {/* Model info */}
                        {modelInfo && (
                            <Box mb={2}>
                                <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    display="flex"
                                    alignItems="center"
                                    gap={1}>
                                    <InfoIcon fontSize="small" />
                                    Model: {objPath.split("/").pop()} • Size:{" "}
                                    {(modelInfo.size / 1024).toFixed(1)} KB
                                    {mtlPath && " • Materials included"}
                                </Typography>
                            </Box>
                        )}

                        {/* 3D Viewer */}
                        <Box display="flex" justifyContent="center" mb={2}>
                            <ModelViewerWithErrorBoundary
                                objPath={objPath}
                                mtlPath={mtlPath}
                                width={viewerWidth}
                                height={viewerHeight}
                            />
                        </Box>

                        {/* Instructions */}
                        <Box mt={2}>
                            <Typography
                                variant="caption"
                                color="textSecondary"
                                align="center"
                                display="block">
                                Use mouse to orbit, zoom, and pan around the
                                model
                            </Typography>
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <Divider />

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} variant="outlined">
                    Close
                </Button>
                {objPath && (
                    <Button
                        onClick={() => {
                            // Open the model directory in file explorer
                            if (window.package?.showItemInFolder) {
                                window.package.showItemInFolder(objPath)
                            }
                        }}
                        variant="contained"
                        disabled={!window.package?.showItemInFolder}>
                        Show in Folder
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
