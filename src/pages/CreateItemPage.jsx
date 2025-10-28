import { useState } from "react"
import {
    Box,
    Typography,
    TextField,
    Button,
    Alert,
    Stack,
} from "@mui/material"
import { CheckCircle, Close } from "@mui/icons-material"

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
                    Create New Item
                </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
                <Stack spacing={3}>
                    {error && (
                        <Alert severity="error" onClose={() => setError("")}>
                            {error}
                        </Alert>
                    )}

                    <TextField
                        label="Item ID"
                        value={itemId}
                        onChange={(e) => setItemId(e.target.value)}
                        placeholder="my_custom_item"
                        fullWidth
                        required
                        autoFocus
                        disabled={loading}
                        helperText="Enter a unique identifier for your item (letters, numbers, and underscores only)"
                    />

                    <Alert severity="info">
                        The item will be created with default settings. You can
                        configure all other properties in the editor after
                        creation.
                    </Alert>
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
                <Stack direction="row" spacing={1} justifyContent="flex-end">
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
                        disabled={loading || !itemId.trim()}
                        startIcon={<CheckCircle />}
                        sx={{ minWidth: 120 }}>
                        {loading ? "Creating..." : "Create"}
                    </Button>
                </Stack>
            </Box>
        </Box>
    )
}

export default CreateItemPage
