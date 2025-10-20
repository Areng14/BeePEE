import { useState } from "react"
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Alert,
} from "@mui/material"
import { Delete, Add, Folder } from "@mui/icons-material"

function CreateItemDialog({ open, onClose, onItemCreated }) {
    const [name, setName] = useState("")
    const [author, setAuthor] = useState("")
    const [description, setDescription] = useState("")
    const [iconPath, setIconPath] = useState("")
    const [instancePaths, setInstancePaths] = useState([])
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    // Reset form when dialog opens
    const handleOpen = () => {
        setName("")
        setAuthor("")
        setDescription("")
        setIconPath("")
        setInstancePaths([])
        setError("")
        setLoading(false)
    }

    const handleIconBrowse = async () => {
        try {
            const result = await window.electron.showOpenDialog({
                title: "Select Item Icon",
                filters: [
                    { name: "Images", extensions: ["png", "jpg", "jpeg", "tga", "vtf"] },
                ],
                properties: ["openFile"],
            })

            if (!result.canceled && result.filePaths.length > 0) {
                setIconPath(result.filePaths[0])
            }
        } catch (err) {
            setError(`Failed to select icon: ${err.message}`)
        }
    }

    const handleAddInstance = async () => {
        try {
            const result = await window.electron.showOpenDialog({
                title: "Select Instance File(s)",
                filters: [
                    { name: "VMF Files", extensions: ["vmf"] },
                ],
                properties: ["openFile", "multiSelections"],
            })

            if (!result.canceled && result.filePaths.length > 0) {
                setInstancePaths([...instancePaths, ...result.filePaths])
            }
        } catch (err) {
            setError(`Failed to select instance: ${err.message}`)
        }
    }

    const handleRemoveInstance = (index) => {
        setInstancePaths(instancePaths.filter((_, i) => i !== index))
    }

    const handleCreate = async () => {
        setError("")
        setLoading(true)

        try {
            // Validate required fields
            if (!name.trim()) {
                throw new Error("Item name is required")
            }
            if (!author.trim()) {
                throw new Error("Author name is required")
            }
            if (instancePaths.length === 0) {
                throw new Error("At least one instance is required")
            }

            // Generate preview ID
            const cleanName = name.replace(/[^a-zA-Z0-9]/g, "_")
            const cleanAuthor = author.replace(/[^a-zA-Z0-9]/g, "_")
            const itemId = `bpee_${cleanName}_${cleanAuthor}`

            // Call backend to create item
            const result = await window.electron.invoke("create-item", {
                name: name.trim(),
                description: description.trim(),
                iconPath: iconPath || null,
                instancePaths,
                author: author.trim(),
            })

            if (result.success) {
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

    // Generate preview ID for display
    const previewId = () => {
        if (!name || !author) return "bpee_Name_Author"
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, "_")
        const cleanAuthor = author.replace(/[^a-zA-Z0-9]/g, "_")
        return `bpee_${cleanName}_${cleanAuthor}`
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
                    {error && (
                        <Alert severity="error" onClose={() => setError("")}>
                            {error}
                        </Alert>
                    )}

                    <TextField
                        label="Item Name *"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        autoFocus
                        helperText="The display name of your item"
                    />

                    <TextField
                        label="Author *"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        fullWidth
                        helperText="Your name or username"
                    />

                    <TextField
                        label="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        helperText="Optional description of your item"
                    />

                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            Generated ID: <strong>{previewId()}</strong>
                        </Typography>
                    </Box>

                    <Box>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            Icon
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                            <TextField
                                value={iconPath ? iconPath.split(/[/\\]/).pop() : "No icon selected"}
                                fullWidth
                                disabled
                                size="small"
                            />
                            <Button
                                variant="outlined"
                                onClick={handleIconBrowse}
                                startIcon={<Folder />}
                                sx={{ minWidth: 100 }}>
                                Browse
                            </Button>
                        </Box>
                    </Box>

                    <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                            <Typography variant="body2">
                                Instances * ({instancePaths.length})
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleAddInstance}
                                startIcon={<Add />}>
                                Add Instance
                            </Button>
                        </Box>
                        {instancePaths.length === 0 ? (
                            <Alert severity="info" sx={{ mt: 1 }}>
                                Add at least one VMF instance file
                            </Alert>
                        ) : (
                            <List dense sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, maxHeight: 200, overflow: "auto" }}>
                                {instancePaths.map((path, index) => (
                                    <ListItem key={index}>
                                        <ListItemText
                                            primary={path.split(/[/\\]/).pop()}
                                            secondary={path}
                                            secondaryTypographyProps={{
                                                noWrap: true,
                                                sx: { fontSize: "0.7rem" }
                                            }}
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() => handleRemoveInstance(index)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>

                    <Alert severity="info" sx={{ mt: 1 }}>
                        * Required fields
                    </Alert>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleCreate}
                    variant="contained"
                    disabled={loading || !name.trim() || !author.trim() || instancePaths.length === 0}>
                    {loading ? "Creating..." : "Create Item"}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default CreateItemDialog

