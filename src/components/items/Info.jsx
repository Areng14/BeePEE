import {
    Stack,
    TextField,
    Box,
    Typography,
    IconButton,
    Button,
    InputAdornment,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@mui/material"
import { Visibility, Edit, FolderOpen, Image } from "@mui/icons-material"
import ReactMarkdown from "react-markdown"
import { useState, useEffect } from "react"

function Info({ item, formData, onUpdate }) {
    const [iconSrc, setIconSrc] = useState(null)
    const [isPreview, setIsPreview] = useState(false)
    const [selectedInstanceKey, setSelectedInstanceKey] = useState("")

    useEffect(() => {
        // Load the icon when item changes or when staged icon changes
        const iconToLoad = formData.stagedIconPath || item?.icon
        if (iconToLoad) {
            window.package.loadFile(iconToLoad).then(setIconSrc)
        } else {
            setIconSrc(null)
        }
    }, [item, formData.stagedIconPath])

    // Keep selected instance in sync when instances list changes
    useEffect(() => {
        const entries = Object.entries(formData?.instances || {}).filter(
            ([, inst]) => !inst?._toRemove,
        )
        if (entries.length === 0) {
            setSelectedInstanceKey("")
            return
        }
        setSelectedInstanceKey((prev) => {
            const stillExists = entries.some(([key]) => key === prev)
            return stillExists ? prev : entries[0][0]
        })
    }, [formData?.instances])

    // Get relative path from package root (show staged path if available)
    const getRelativeIconPath = () => {
        const iconPath = formData.stagedIconPath || item?.icon
        if (!iconPath || !item?.packagePath) return ""

        // If it's a staged icon, show just the filename
        if (formData.stagedIconPath) {
            const filename = formData.stagedIconPath.split(/[\\\/]/).pop()
            return `${filename} (staged)`
        }

        // Remove the package path from the full icon path to get relative path
        const fullIconPath = iconPath
        const packagePath = item.packagePath

        if (fullIconPath.startsWith(packagePath)) {
            return fullIconPath.substring(packagePath.length).replace(/^[\\\/]/, "")
        }

        return iconPath // fallback to full path if something goes wrong
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
            <Box component="ul" sx={{ pl: 2, mb: 1, "&:last-child": { mb: 0 } }}>
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

    const instanceEntries = Object.entries(formData?.instances || {}).filter(
        ([, inst]) => !inst?._toRemove,
    )

    const handleMakeModel = async () => {
        if (!selectedInstanceKey) return
        try {
            if (typeof window.package?.makeModelFromInstance === "function") {
                await window.package.makeModelFromInstance(
                    item.id,
                    selectedInstanceKey,
                )
            } else {
                console.warn("makeModelFromInstance is not available on backend")
            }
        } catch (error) {
            console.error("Failed to make model:", error)
        }
    }

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}
            >
                <Typography variant="h6">Info</Typography>
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
                                        try {
                                            const result =
                                                await window.package.browseForIconFile()
                                            if (result.success) {
                                                console.log("Icon staged successfully")
                                                // Stage the icon change
                                                onUpdate("stagedIconPath", result.filePath)
                                                onUpdate("stagedIconName", result.fileName)
                                                onUpdate(
                                                    "iconChanged",
                                                    true,
                                                    "basicInfo",
                                                )
                                            } else if (!result.canceled) {
                                                console.error(
                                                    "Failed to browse for icon:",
                                                    result.error,
                                                )
                                            }
                                        } catch (error) {
                                            console.error(
                                                "Failed to browse for icon:",
                                                error,
                                            )
                                        }
                                    }}
                                    title="Browse for Icon"
                                    sx={{ mr: 0.5 }}
                                >
                                    <FolderOpen />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={async () => {
                                        const iconToShow =
                                            formData.stagedIconPath || item?.icon
                                        if (iconToShow) {
                                            try {
                                                await window.package.showIconPreview(
                                                    iconToShow,
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
                                    disabled={!formData.stagedIconPath && !item?.icon}
                                >
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
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            Description
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => setIsPreview(!isPreview)}
                            sx={{ ml: "auto" }}
                            title={isPreview ? "Edit" : "Preview"}
                        >
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
                            }}
                        >
                            <ReactMarkdown components={markdownComponents}>
                                {processMarkdown(formData.description)}
                            </ReactMarkdown>
                        </Box>
                    ) : (
                        <TextField
                            value={formData.description}
                            onChange={(e) => onUpdate("description", e.target.value)}
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

                {/* Section divider */}
                <Divider sx={{ my: 1 }} />

                {/* Instance -> Model section */}
                <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Instance Model
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel id="instance-select-label">Instance</InputLabel>
                            <Select
                                labelId="instance-select-label"
                                label="Instance"
                                value={selectedInstanceKey}
                                onChange={(e) => setSelectedInstanceKey(e.target.value)}
                            >
                                {instanceEntries.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        No instances
                                    </MenuItem>
                                ) : (
                                    instanceEntries.map(([key, inst], idx) => {
                                        const displayName =
                                            inst.displayName || inst.Name || `Instance ${idx}`
                                        return (
                                            <MenuItem key={key} value={key}>
                                                {displayName}
                                            </MenuItem>
                                        )
                                    })
                                )}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={handleMakeModel}
                            disabled={
                                !selectedInstanceKey ||
                                typeof window.package?.makeModelFromInstance !==
                                    "function"
                            }
                        >
                            Make Model
                        </Button>
                    </Stack>
                </Box>
            </Stack>
        </Box>
    )
}

export default Info


