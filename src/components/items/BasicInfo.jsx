import {
    Stack,
    TextField,
    Box,
    Typography,
    IconButton,
    Button,
    InputAdornment,
} from "@mui/material"
import { Visibility, Edit, FolderOpen, Image } from "@mui/icons-material"
import ReactMarkdown from "react-markdown"
import { useState, useEffect } from "react"

function BasicInfo({ item, deferredChanges, onUpdate }) {
    const [iconSrc, setIconSrc] = useState(null)
    const [isPreview, setIsPreview] = useState(false)

    // Helper functions to get current values (deferred changes take precedence)
    const getCurrentName = () => {
        return deferredChanges.basicInfo.name !== undefined 
            ? deferredChanges.basicInfo.name 
            : item?.name || ""
    }

    const getCurrentAuthor = () => {
        return deferredChanges.basicInfo.author !== undefined 
            ? deferredChanges.basicInfo.author 
            : item?.details?.Authors || ""
    }

    const getCurrentDescription = () => {
        if (deferredChanges.basicInfo.description !== undefined) {
            return deferredChanges.basicInfo.description
        }
        
        const desc = item?.details?.Description
        if (desc && typeof desc === "object") {
            const descValues = Object.keys(desc)
                .filter((key) => key.startsWith("desc_"))
                .sort()
                .map((key) => desc[key])
                .filter((value) => value && value.trim() !== "")
                .join("\n")
                .trim()
            return descValues
        }
        return desc || ""
    }

    useEffect(() => {
        // Load the icon when item changes
        if (item?.icon) {
            window.package.loadFile(item.icon).then(setIconSrc)
        }
    }, [item])

    // Get relative path from package root
    const getRelativeIconPath = () => {
        if (!item?.icon || !item?.packagePath) return ""

        // Remove the package path from the full icon path to get relative path
        const fullIconPath = item.icon
        const packagePath = item.packagePath

        if (fullIconPath.startsWith(packagePath)) {
            return fullIconPath
                .substring(packagePath.length)
                .replace(/^[\\\/]/, "")
        }

        return item.icon // fallback to full path if something goes wrong
    }

    // Process markdown to handle single line breaks properly
    const processMarkdown = (text) => {
        return text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line !== "") // Remove empty lines first
            .join("  \n") // Add two spaces + newline for proper markdown line breaks
    }

    const markdownComponents = {
        // Custom paragraph renderer to handle spacing better
        p: ({ children }) => (
            <Typography component="p" sx={{ mb: 1, "&:last-child": { mb: 0 } }}>
                {children}
            </Typography>
        ),
        // Better list styling
        ul: ({ children }) => (
            <Box
                component="ul"
                sx={{ pl: 2, mb: 1, "&:last-child": { mb: 0 } }}>
                {children}
            </Box>
        ),
        li: ({ children }) => (
            <Typography component="li" sx={{ mb: 0.5 }}>
                {children}
            </Typography>
        ),
        // Better strong/bold styling
        strong: ({ children }) => (
            <Box component="span" sx={{ fontWeight: "bold" }}>
                {children}
            </Box>
        ),
    }

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}>
                <Typography variant="h6">Basic Information</Typography>
            </Box>



            <Stack spacing={2} sx={{ height: "100%" }}>
                <TextField
                    label="Name"
                    value={getCurrentName()}
                    onChange={(e) => onUpdate("name", e.target.value)}
                    fullWidth
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: deferredChanges?.basicInfo?.name !== undefined 
                                ? 'rgba(25, 118, 210, 0.05)' 
                                : 'transparent',
                        }
                    }}
                />

                <TextField
                    label="Author"
                    value={getCurrentAuthor()}
                    onChange={(e) => onUpdate("author", e.target.value)}
                    fullWidth
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: deferredChanges?.basicInfo?.author !== undefined 
                                ? 'rgba(25, 118, 210, 0.05)' 
                                : 'transparent',
                        }
                    }}
                />

                <TextField
                    label="Icon"
                    value={getRelativeIconPath()}
                    fullWidth
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: deferredChanges?.basicInfo?.icon 
                                ? 'rgba(25, 118, 210, 0.05)' 
                                : 'transparent',
                        }
                    }}
                    InputProps={{
                        readOnly: true,
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={async () => {
                                        if (item?.id) {
                                            try {
                                                // Store the icon change request for deferred processing
                                                // This should update the icon field in the context
                                                onUpdate("icon", { action: "browse", itemId: item.id })
                                                console.log("Icon change queued for apply")
                                            } catch (error) {
                                                console.error("Failed to queue icon change:", error)
                                            }
                                        }
                                    }}
                                    title="Browse for Icon"
                                    sx={{ mr: 0.5 }}>
                                    <FolderOpen />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={async () => {
                                        if (item?.icon) {
                                            try {
                                                await window.package.showIconPreview(
                                                    item.icon,
                                                    item.name,
                                                )
                                            } catch (error) {
                                                console.error(
                                                    "Failed to show icon preview:",
                                                    error,
                                                )
                                            }
                                        }
                                    }}
                                    title="View Icon"
                                    disabled={!item?.icon}>
                                    <Image />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                {/* Description with preview toggle */}
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 1,
                        }}>
                        <Typography variant="body2" color="text.secondary">
                            Description
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => setIsPreview(!isPreview)}
                            sx={{ ml: "auto" }}
                            title={isPreview ? "Edit" : "Preview"}>
                            {isPreview ? <Edit /> : <Visibility />}
                        </IconButton>
                    </Box>

                    {isPreview ? (
                        <Box
                            sx={{
                                flex: 1,
                                border: "1px solid #ccc",
                                borderRadius: 1,
                                p: 2,
                                backgroundColor: deferredChanges?.basicInfo?.description !== undefined 
                                    ? 'rgba(25, 118, 210, 0.05)' 
                                    : "background.paper",
                                color: "text.primary",
                                overflow: "auto",
                                "& > *:first-of-type": { mt: 0 },
                                "& > *:last-child": { mb: 0 },
                            }}>
                            <ReactMarkdown components={markdownComponents}>
                                {processMarkdown(getCurrentDescription())}
                            </ReactMarkdown>
                        </Box>
                    ) : (
                        <TextField
                            value={getCurrentDescription()}
                            onChange={(e) =>
                                onUpdate("description", e.target.value)
                            }
                            fullWidth
                            multiline
                            placeholder="Enter description...   Markdown formatting is supported"
                            sx={{
                                flex: 1,
                                "& .MuiInputBase-root": {
                                    height: "100%",
                                    alignItems: "flex-start",
                                    backgroundColor: deferredChanges?.basicInfo?.description !== undefined 
                                        ? 'rgba(25, 118, 210, 0.05)' 
                                        : 'transparent',
                                },
                            }}
                        />
                    )}
                </Box>
            </Stack>
        </Box>
    )
}

export default BasicInfo
