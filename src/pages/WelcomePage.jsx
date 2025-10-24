import { Box, Typography, Button, Stack, Paper } from "@mui/material"
import { Add, FolderOpen, Unarchive } from "@mui/icons-material"

function WelcomePage() {
    const handleCreatePackage = async () => {
        try {
            // Check if there's a package already open
            const hasPackage = await window.electron.invoke("check-package-loaded")
            
            if (hasPackage) {
                // Show confirmation via backend (so we can use native dialog)
                const confirmed = await window.electron.invoke("confirm-close-for-new-package")
                if (!confirmed) {
                    return
                }
            }
            
            await window.electron.invoke("open-create-package-window")
        } catch (error) {
            console.error("Failed to open create package window:", error)
        }
    }

    const handleOpenPackage = async () => {
        try {
            await window.package.loadPackage()
        } catch (error) {
            console.error("Failed to open package:", error)
        }
    }

    const handleImportPackage = async () => {
        try {
            await window.electron.invoke("import-package-dialog")
        } catch (error) {
            console.error("Failed to import package:", error)
        }
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
                gap: 3,
            }}>
            <Typography
                variant="h3"
                sx={{
                    fontWeight: 700,
                    color: "primary.main",
                }}>
                BeePEE
            </Typography>

            <Typography
                variant="subtitle1"
                sx={{
                    color: "text.secondary",
                    mb: 2,
                    fontSize: "1.25 rem",
                }}>
                BeeMOD Package Editor Enhanced
            </Typography>

            <Stack direction="row" spacing={2}>
                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        width: 160,
                        height: 160,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: "1px solid",
                        borderColor: "divider",
                        "&:hover": {
                            borderColor: "primary.main",
                            bgcolor: "action.hover",
                            transform: "translateY(-2px)",
                        },
                    }}
                    onClick={handleCreatePackage}>
                    <Add sx={{ fontSize: 48, color: "primary.main" }} />
                    <Typography variant="body1" fontWeight={600}>
                        Create Package
                    </Typography>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        width: 160,
                        height: 160,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: "1px solid",
                        borderColor: "divider",
                        "&:hover": {
                            borderColor: "primary.main",
                            bgcolor: "action.hover",
                            transform: "translateY(-2px)",
                        },
                    }}
                    onClick={handleOpenPackage}>
                    <FolderOpen sx={{ fontSize: 48, color: "primary.main" }} />
                    <Typography variant="body1" fontWeight={600}>
                        Open Package
                    </Typography>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        width: 160,
                        height: 160,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: "1px solid",
                        borderColor: "divider",
                        "&:hover": {
                            borderColor: "primary.main",
                            bgcolor: "action.hover",
                            transform: "translateY(-2px)",
                        },
                    }}
                    onClick={handleImportPackage}>
                    <Unarchive sx={{ fontSize: 48, color: "primary.main" }} />
                    <Typography variant="body1" fontWeight={600}>
                        Import Package
                    </Typography>
                </Paper>
            </Stack>
        </Box>
    )
}

export default WelcomePage

