import { useState } from "react"
import {
    Box,
    Typography,
    TextField,
    Button,
    Alert,
    Stack,
    Paper,
} from "@mui/material"

function CreateItemPage() {
    const [itemId, setItemId] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleCreate = async () => {
        setError("")
        setLoading(true)

        try {
            // Validate required fields
            if (!itemId.trim()) {
                throw new Error("Item ID is required")
            }

            // Validate item ID format
            if (!/^[a-zA-Z0-9_]+$/.test(itemId.trim())) {
                throw new Error(
                    "Item ID can only contain letters, numbers, and underscores",
                )
            }

            // Call backend to create item
            const result = await window.electron.invoke("create-item-simple", {
                itemId: itemId.trim(),
            })

            if (result.success) {
                // Automatically open the item editor
                await window.electron.invoke("open-item-editor", result.item)
                // Window will be closed by the backend
                console.log("Item created successfully:", result.itemId)
            }
        } catch (err) {
            setError(err.message || "Failed to create item")
        } finally {
            setLoading(false)
        }
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
            {/* Header Bar */}
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
                    Create New Item
                </Typography>
            </Box>

            {/* Main Content */}
            <Box
                sx={{
                    flex: 1,
                    overflow: "auto",
                    p: 3,
                }}>
                {error && (
                    <Alert
                        severity="error"
                        onClose={() => setError("")}
                        sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                <Box
                    sx={{
                        maxWidth: 500,
                        mx: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                    }}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Item Information
                        </Typography>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Item ID *"
                                value={itemId}
                                onChange={(e) => setItemId(e.target.value)}
                                fullWidth
                                autoFocus
                                helperText="Enter a unique identifier for your item (letters, numbers, and underscores only)"
                                placeholder="e.g., my_custom_item"
                                variant="outlined"
                            />

                            <Alert severity="info">
                                The item will be created with default settings.
                                You can configure all other properties in the
                                editor after creation.
                            </Alert>
                        </Stack>
                    </Paper>

                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 2,
                        }}>
                        <Button
                            onClick={handleCreate}
                            variant="contained"
                            size="large"
                            disabled={loading || !itemId.trim()}>
                            {loading ? "Creating..." : "Create Item"}
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default CreateItemPage
