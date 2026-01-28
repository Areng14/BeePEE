import { useState } from "react"
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Alert,
} from "@mui/material"

function CreateItemDialog({ open, onClose, onItemCreated }) {
    const [itemName, setItemName] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    // Reset form when dialog opens
    const handleOpen = () => {
        setItemName("")
        setError("")
        setLoading(false)
    }

    const handleCreate = async () => {
        setError("")
        setLoading(true)

        try {
            // Validate required fields
            if (!itemName.trim()) {
                throw new Error("Item name is required")
            }

            // Validate item name format
            if (!/^[a-zA-Z0-9_ ]+$/.test(itemName.trim())) {
                throw new Error(
                    "Item name can only contain letters, numbers, spaces, and underscores",
                )
            }

            // Call backend to create item
            const result = await window.electron.invoke("create-item-simple", {
                name: itemName.trim(),
            })

            if (result.success) {
                // Automatically open the item editor
                await window.electron.invoke("open-item-editor", result.item)
                onItemCreated?.(result.item)
                onClose()
                handleOpen() // Reset form
            }
        } catch (err) {
            setError(err.message || "Failed to create item")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            TransitionProps={{
                onEntered: handleOpen,
            }}>
            <DialogTitle>Create New Item</DialogTitle>
            <DialogContent>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        pt: 1,
                    }}>
                    {error && (
                        <Alert severity="error" onClose={() => setError("")}>
                            {error}
                        </Alert>
                    )}

                    <TextField
                        label="Item Name *"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        fullWidth
                        autoFocus
                        helperText="Enter a name for your item (a unique ID will be generated automatically)"
                        placeholder="e.g., My Custom Item"
                    />

                    <Alert severity="info">
                        The item will be created with default settings. You can
                        configure all other properties in the editor after
                        creation.
                    </Alert>
                </Box>
            </DialogContent>
            <DialogActions sx={{ flexDirection: "column", gap: 1, p: 2 }}>
                <Button
                    onClick={handleCreate}
                    variant="contained"
                    fullWidth
                    disabled={loading || !itemName.trim()}>
                    {loading ? "Creating..." : "Create Item"}
                </Button>
                <Button onClick={onClose} disabled={loading} fullWidth>
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default CreateItemDialog
