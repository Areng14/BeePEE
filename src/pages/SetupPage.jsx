import {
    Box,
    Typography,
    Button,
    Paper,
    TextField,
    Alert,
    CircularProgress,
    Stack,
    Chip,
    InputAdornment,
} from "@mui/material"
import {
    FolderOpen,
    CheckCircle,
    Error as ErrorIcon,
    AutoAwesome,
    SportsEsports,
    Extension,
} from "@mui/icons-material"
import { useState, useEffect } from "react"

function SetupPage({ onSetupComplete }) {
    const [portal2Path, setPortal2Path] = useState("")
    const [beemodPath, setBeemodPath] = useState("")
    const [portal2AutoDetected, setPortal2AutoDetected] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [portal2Error, setPortal2Error] = useState(null)
    const [beemodError, setBeemodError] = useState(null)

    useEffect(() => {
        // Check if Portal 2 can be auto-detected
        const checkPortal2 = async () => {
            try {
                const result = await window.package.getPortal2Path()
                if (result.success && result.path) {
                    setPortal2Path(result.path)
                    setPortal2AutoDetected(result.canAutoDetect)
                }
            } catch (err) {
                console.error("Failed to check Portal 2 path:", err)
            } finally {
                setLoading(false)
            }
        }
        checkPortal2()
    }, [])

    const handleBrowsePortal2 = async () => {
        try {
            setPortal2Error(null)
            const result = await window.package.browsePortal2Path()
            if (result.success && result.path) {
                setPortal2Path(result.path)
                setPortal2AutoDetected(false)
            } else if (!result.success && result.error) {
                setPortal2Error(result.error)
            }
        } catch (err) {
            setPortal2Error(err.message)
        }
    }

    const handleBrowseBeemod = async () => {
        try {
            setBeemodError(null)
            const result = await window.package.browseBeemodPath()
            if (result.success && result.path) {
                setBeemodPath(result.path)
            } else if (!result.success && result.error) {
                setBeemodError(result.error)
            }
        } catch (err) {
            setBeemodError(err.message)
        }
    }

    const handleComplete = async () => {
        // Validate
        if (!beemodPath) {
            setBeemodError("BEEMod path is required")
            return
        }

        setSaving(true)
        setError(null)

        try {
            // Only pass Portal 2 path if it was manually set (not auto-detected)
            const p2Path = portal2AutoDetected ? null : portal2Path
            const result = await window.package.completeSetup(p2Path, beemodPath)

            if (result.success) {
                onSetupComplete?.()
            } else {
                setError(result.error || "Failed to complete setup")
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Box
                sx={{
                    width: "100vw",
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.default",
                }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box
            sx={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.default",
                p: 3,
            }}>
            <Typography
                variant="h4"
                sx={{
                    fontWeight: 700,
                    color: "primary.main",
                    mb: 0.5,
                }}>
                BeePEE Setup
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    color: "text.secondary",
                    mb: 3,
                }}>
                Configure your game paths to get started
            </Typography>

            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    width: "100%",
                    maxWidth: 480,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                }}>
                <Stack spacing={2.5}>
                    {/* Portal 2 Path */}
                    <Box>
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ mb: 0.5 }}>
                            <SportsEsports
                                sx={{ fontSize: 18, color: "text.secondary" }}
                            />
                            <Typography variant="subtitle2" fontWeight={600}>
                                Portal 2
                            </Typography>
                            {portal2AutoDetected && (
                                <Chip
                                    size="small"
                                    icon={<AutoAwesome sx={{ fontSize: 12 }} />}
                                    label="Auto-detected"
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: 11 }}
                                />
                            )}
                        </Stack>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 1 }}>
                            {portal2AutoDetected
                                ? "Found via Steam. Change if needed."
                                : "Select your Portal 2 installation folder."}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                fullWidth
                                size="small"
                                value={portal2Path}
                                onChange={(e) => {
                                    setPortal2Path(e.target.value)
                                    setPortal2AutoDetected(false)
                                }}
                                placeholder="C:\...\Portal 2"
                                error={!!portal2Error}
                                InputProps={{
                                    endAdornment: portal2Path && !portal2Error && (
                                        <InputAdornment position="end">
                                            <CheckCircle
                                                sx={{
                                                    color: "success.main",
                                                    fontSize: 18,
                                                }}
                                            />
                                        </InputAdornment>
                                    ),
                                    sx: { fontSize: 13 },
                                }}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleBrowsePortal2}
                                size="small"
                                sx={{ minWidth: 80 }}>
                                <FolderOpen sx={{ fontSize: 18 }} />
                            </Button>
                        </Stack>
                        {portal2Error && (
                            <Alert
                                severity="error"
                                sx={{ mt: 1, py: 0 }}
                                icon={<ErrorIcon sx={{ fontSize: 16 }} />}>
                                <Typography variant="caption">
                                    {portal2Error}
                                </Typography>
                            </Alert>
                        )}
                    </Box>

                    {/* BEEMod Path */}
                    <Box>
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ mb: 0.5 }}>
                            <Extension
                                sx={{ fontSize: 18, color: "text.secondary" }}
                            />
                            <Typography variant="subtitle2" fontWeight={600}>
                                BEEMod
                            </Typography>
                            <Typography
                                variant="caption"
                                color="error.main"
                                sx={{ ml: 0.5 }}>
                                *
                            </Typography>
                        </Stack>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 1 }}>
                            Folder containing BEE2.exe
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                fullWidth
                                size="small"
                                value={beemodPath}
                                onChange={(e) => setBeemodPath(e.target.value)}
                                placeholder="C:\BEEMod"
                                error={!!beemodError}
                                InputProps={{
                                    endAdornment: beemodPath && !beemodError && (
                                        <InputAdornment position="end">
                                            <CheckCircle
                                                sx={{
                                                    color: "success.main",
                                                    fontSize: 18,
                                                }}
                                            />
                                        </InputAdornment>
                                    ),
                                    sx: { fontSize: 13 },
                                }}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleBrowseBeemod}
                                size="small"
                                sx={{ minWidth: 80 }}>
                                <FolderOpen sx={{ fontSize: 18 }} />
                            </Button>
                        </Stack>
                        {beemodError && (
                            <Alert
                                severity="error"
                                sx={{ mt: 1, py: 0 }}
                                icon={<ErrorIcon sx={{ fontSize: 16 }} />}>
                                <Typography variant="caption">
                                    {beemodError}
                                </Typography>
                            </Alert>
                        )}
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ py: 0.5 }}>
                            <Typography variant="caption">{error}</Typography>
                        </Alert>
                    )}

                    <Button
                        variant="contained"
                        fullWidth
                        onClick={handleComplete}
                        disabled={saving || !beemodPath}
                        sx={{ mt: 1 }}>
                        {saving ? (
                            <CircularProgress size={20} color="inherit" />
                        ) : (
                            "Get Started"
                        )}
                    </Button>
                </Stack>
            </Paper>

            <Typography
                variant="caption"
                color="text.disabled"
                sx={{ mt: 2 }}>
                You can change these later in Settings
            </Typography>
        </Box>
    )
}

export default SetupPage
