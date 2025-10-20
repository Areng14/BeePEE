import { useState } from "react"
import {
    Box,
    Typography,
    TextField,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Alert,
    Stack,
    Divider,
} from "@mui/material"
import { Delete, Add, Folder, Close, CheckCircle } from "@mui/icons-material"

function CreateItemPage() {
    const [name, setName] = useState("")
    const [author, setAuthor] = useState("")
    const [description, setDescription] = useState("")
    const [iconPath, setIconPath] = useState("")
    const [instancePaths, setInstancePaths] = useState([])
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

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

            // Call backend to create item
            const result = await window.electron.invoke("create-item", {
                name: name.trim(),
                description: description.trim(),
                iconPath: iconPath || null,
                instancePaths,
                author: author.trim(),
            })

            if (result.success) {
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
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleCreate}
                        disabled={loading || !name.trim() || !author.trim() || instancePaths.length === 0}
                        startIcon={loading ? null : <CheckCircle />}>
                        {loading ? "Creating..." : "Create"}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => window.close()}
                        disabled={loading}
                        startIcon={<Close />}>
                        Cancel
                    </Button>
                </Stack>
            </Box>

            {/* Main Content */}
            <Box
                sx={{
                    flex: 1,
                    overflow: "auto",
                    p: 3,
                }}>
                {error && (
                    <Alert severity="error" onClose={() => setError("")} sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ maxWidth: 700, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                    {/* Basic Info Section */}
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Basic Information
                        </Typography>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Item Name *"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                fullWidth
                                autoFocus
                                helperText="The display name of your item"
                                variant="outlined"
                            />

                            <TextField
                                label="Author *"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                fullWidth
                                helperText="Your name or username"
                                variant="outlined"
                            />

                            <TextField
                                label="Description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                fullWidth
                                multiline
                                rows={3}
                                helperText="Optional description of your item"
                                variant="outlined"
                            />
                        </Stack>
                    </Box>

                    <Divider />

                    {/* Icon Section */}
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Icon
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                            <TextField
                                value={iconPath ? iconPath.split(/[/\\]/).pop() : "No icon selected"}
                                fullWidth
                                disabled
                                size="small"
                                variant="outlined"
                                sx={{
                                    "& .MuiInputBase-input.Mui-disabled": {
                                        WebkitTextFillColor: "text.secondary",
                                    }
                                }}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleIconBrowse}
                                startIcon={<Folder />}
                                sx={{ minWidth: 120, flexShrink: 0 }}>
                                Browse
                            </Button>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                            Optional - Select a PNG, TGA, or VTF image file
                        </Typography>
                    </Box>

                    <Divider />

                    {/* Instances Section */}
                    <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                            <Typography variant="h6">
                                Instances *
                            </Typography>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={handleAddInstance}
                                startIcon={<Add />}>
                                Add Instance
                            </Button>
                        </Box>
                        
                        {instancePaths.length === 0 ? (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Add at least one VMF instance file to continue
                            </Alert>
                        ) : (
                            <>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {instancePaths.length} instance{instancePaths.length !== 1 ? 's' : ''} added
                                </Typography>
                                <Box
                                    sx={{
                                        border: "1px solid",
                                        borderColor: "divider",
                                        borderRadius: 1,
                                        maxHeight: 250,
                                        overflow: "auto",
                                        bgcolor: "background.paper",
                                    }}>
                                    <List dense disablePadding>
                                        {instancePaths.map((path, index) => (
                                            <ListItem
                                                key={index}
                                                sx={{
                                                    borderBottom: index < instancePaths.length - 1 ? "1px solid" : "none",
                                                    borderColor: "divider",
                                                }}>
                                                <ListItemText
                                                    primary={path.split(/[/\\]/).pop()}
                                                    secondary={path}
                                                    secondaryTypographyProps={{
                                                        noWrap: true,
                                                        sx: { fontSize: "0.75rem" }
                                                    }}
                                                />
                                                <ListItemSecondaryAction>
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        onClick={() => handleRemoveInstance(index)}
                                                        sx={{ color: "error.main" }}>
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            </>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default CreateItemPage

