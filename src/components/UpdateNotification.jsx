import { useState, useEffect } from "react"
import {
    Snackbar,
    Alert,
    Button,
    LinearProgress,
    Box,
    Typography,
} from "@mui/material"
import DownloadIcon from "@mui/icons-material/Download"
import UpdateIcon from "@mui/icons-material/Update"

export default function UpdateNotification() {
    const [updateStatus, setUpdateStatus] = useState(null)
    const [open, setOpen] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)

    useEffect(() => {
        // Listen for update status events
        window.package.onUpdateStatus((data) => {
            console.log("Update status received:", data)
            setUpdateStatus(data)

            // Show notification for relevant events
            if (
                data.status === "update-available" ||
                data.status === "update-downloaded" ||
                data.status === "update-error" ||
                data.status === "download-progress"
            ) {
                setOpen(true)
            }

            // Update download progress
            if (data.status === "download-progress") {
                setDownloadProgress(Math.round(data.data.percent))
            }
        })
    }, [])

    const handleClose = (event, reason) => {
        if (reason === "clickaway") {
            return
        }
        setOpen(false)
    }

    const handleDownload = () => {
        window.package.downloadUpdate()
        setOpen(false)
    }

    const handleInstall = () => {
        window.package.quitAndInstall()
    }

    const formatBytes = (bytes) => {
        if (!bytes) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    }

    if (!updateStatus) return null

    // Render different alerts based on update status
    switch (updateStatus.status) {
        case "checking-for-update":
            return (
                <Snackbar
                    open={open}
                    autoHideDuration={3000}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={handleClose}
                        severity="info"
                        icon={<UpdateIcon />}
                    >
                        Checking for updates...
                    </Alert>
                </Snackbar>
            )

        case "update-available":
            return (
                <Snackbar
                    open={open}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={handleClose}
                        severity="info"
                        icon={<DownloadIcon />}
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={handleDownload}
                            >
                                Download
                            </Button>
                        }
                    >
                        <Typography variant="body2" fontWeight="bold">
                            Update Available: v{updateStatus.data.version}
                        </Typography>
                        <Typography variant="caption">
                            A new version is ready to download
                        </Typography>
                    </Alert>
                </Snackbar>
            )

        case "download-started":
            return (
                <Snackbar
                    open={open}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={handleClose}
                        severity="info"
                        icon={<DownloadIcon />}
                    >
                        Starting download...
                    </Alert>
                </Snackbar>
            )

        case "download-progress":
            return (
                <Snackbar
                    open={open}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={handleClose}
                        severity="info"
                        icon={<DownloadIcon />}
                        sx={{ minWidth: 300 }}
                    >
                        <Typography variant="body2" fontWeight="bold">
                            Downloading Update
                        </Typography>
                        <Box sx={{ width: "100%", mt: 1 }}>
                            <LinearProgress
                                variant="determinate"
                                value={downloadProgress}
                            />
                            <Typography
                                variant="caption"
                                sx={{ display: "block", mt: 0.5 }}
                            >
                                {downloadProgress}% -{" "}
                                {formatBytes(updateStatus.data.transferred)} of{" "}
                                {formatBytes(updateStatus.data.total)}
                            </Typography>
                        </Box>
                    </Alert>
                </Snackbar>
            )

        case "update-downloaded":
            return (
                <Snackbar
                    open={open}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={handleClose}
                        severity="success"
                        icon={<UpdateIcon />}
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={handleInstall}
                            >
                                Restart
                            </Button>
                        }
                    >
                        <Typography variant="body2" fontWeight="bold">
                            Update Ready: v{updateStatus.data.version}
                        </Typography>
                        <Typography variant="caption">
                            Restart to install the update
                        </Typography>
                    </Alert>
                </Snackbar>
            )

        case "update-not-available":
            return (
                <Snackbar
                    open={open}
                    autoHideDuration={3000}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={handleClose}
                        severity="success"
                        icon={<UpdateIcon />}
                    >
                        You're running the latest version
                    </Alert>
                </Snackbar>
            )

        case "update-error":
            return (
                <Snackbar
                    open={open}
                    autoHideDuration={6000}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert onClose={handleClose} severity="error">
                        <Typography variant="body2" fontWeight="bold">
                            Update Error
                        </Typography>
                        <Typography variant="caption">
                            {updateStatus.data.message}
                        </Typography>
                    </Alert>
                </Snackbar>
            )

        default:
            return null
    }
}
