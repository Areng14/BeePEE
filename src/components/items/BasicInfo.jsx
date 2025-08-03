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

function BasicInfo({ item, formData, onUpdate }) {
    const [iconSrc, setIconSrc] = useState(null)
    const [isPreview, setIsPreview] = useState(false)

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
                    value={formData.name}
                    onChange={(e) => onUpdate("name", e.target.value)}
                    fullWidth
                    variant="outlined"
                />

                <TextField
                    label="Author"
                    value={formData.author}
                    onChange={(e) => onUpdate("author", e.target.value)}
                    fullWidth
                    variant="outlined"
                />

                <TextField
                    label="Icon"
                    value={getRelativeIconPath()}
                    fullWidth
                    variant="outlined"
                    InputProps={{
                        readOnly: true,
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={async () => {
                                        if (item?.id) {
                                            try {
                                                const result = await window.package.browseForIcon(item.id)
                                                if (result.success) {
                                                    console.log("Icon updated successfully")
                                                    // Mark icon as modified to trigger save button
                                                    onUpdate('iconPath', result.iconPath || item.icon, 'basicInfo')
                                                } else if (!result.canceled) {
                                                    console.error("Failed to update icon:", result.error)
                                                }
                                            } catch (error) {
                                                console.error("Failed to browse for icon:", error)
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
                                backgroundColor: "background.paper",
                                color: "text.primary",
                                overflow: "auto",
                                "& > *:first-of-type": { mt: 0 },
                                "& > *:last-child": { mb: 0 },
                            }}>
                            <ReactMarkdown components={markdownComponents}>
                                {processMarkdown(formData.description)}
                            </ReactMarkdown>
                        </Box>
                    ) : (
                        <TextField
                            value={formData.description}
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
