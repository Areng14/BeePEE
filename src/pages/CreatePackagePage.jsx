import { useState } from "react"
import {
    Box,
    Typography,
    TextField,
    Button,
    Stack,
    Alert,
} from "@mui/material"
import { CheckCircle, Close } from "@mui/icons-material"

function CreatePackagePage() {
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleCreate = async () => {
        setError(null)
        setLoading(true)

        try {
            const result = await window.electron.invoke("create-package", {
                name,
                description,
            })

            if (result.success) {
                console.log("Package created successfully:", result.packageId)
                // Window will close automatically from backend
            } else {
                setError(result.error || "Failed to create package")
            }
        } catch (err) {
            console.error("Error creating package:", err)
            setError(err.message || "Failed to create package")
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        window.close()
    }

    return (
        <Box
            sx={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: "background.default",
            }}>
            {/* Header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Create New Package
                </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
                <Stack spacing={3}>
                    {error && (
                        <Alert severity="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <TextField
                        label="Package Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Awesome Package"
                        fullWidth
                        required
                        disabled={loading}
                        helperText="A descriptive name for your package"
                    />

                    <TextField
                        label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Adds custom items and styles to Portal 2"
                        fullWidth
                        multiline
                        rows={4}
                        disabled={loading}
                        helperText="What does this package add?"
                    />

                    <Box
                        sx={{
                            p: 2,
                            bgcolor: "action.hover",
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                        }}>
                        <Typography variant="caption" color="text.secondary">
                            Preview ID:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", mt: 0.5 }}>
                            {name
                                ? `${name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_XXXX`
                                : "PACKAGE_NAME_XXXX"}
                        </Typography>
                    </Box>
                </Stack>
            </Box>

            {/* Footer */}
            <Box
                sx={{
                    p: 2,
                    borderTop: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                }}>
                <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end">
                    <Button
                        variant="outlined"
                        onClick={handleCancel}
                        disabled={loading}
                        startIcon={<Close />}
                        sx={{ minWidth: 120 }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleCreate}
                        disabled={loading || !name.trim()}
                        startIcon={<CheckCircle />}
                        sx={{ minWidth: 120 }}>
                        {loading ? "Creating..." : "Create"}
                    </Button>
                </Stack>
            </Box>
        </Box>
    )
}

export default CreatePackagePage


