import { useState, useEffect } from "react"
import {
    Box,
    Typography,
    Stack,
    Chip,
    Divider,
    CircularProgress,
} from "@mui/material"
import {
    NewReleases,
    BugReport,
    BuildCircle,
    AutoAwesome,
} from "@mui/icons-material"

function ChangelogPage() {
    const [changelog, setChangelog] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        loadChangelog()
    }, [])

    const loadChangelog = async () => {
        try {
            const data = await window.electron.invoke("load-changelog")
            setChangelog(data)
        } catch (err) {
            setError(err.message || "Failed to load changelog")
        } finally {
            setLoading(false)
        }
    }

    const getCategoryIcon = (category) => {
        switch (category) {
            case "added":
                return <AutoAwesome sx={{ fontSize: 16 }} />
            case "fixed":
                return <BugReport sx={{ fontSize: 16 }} />
            case "changed":
                return <BuildCircle sx={{ fontSize: 16 }} />
            default:
                return <NewReleases sx={{ fontSize: 16 }} />
        }
    }

    const getCategoryTitle = (category) => {
        return category.charAt(0).toUpperCase() + category.slice(1)
    }

    if (loading) {
        return (
            <Box
                sx={{
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.default",
                }}>
                <CircularProgress />
            </Box>
        )
    }

    if (error) {
        return (
            <Box
                sx={{
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.default",
                    p: 3,
                }}>
                <Typography color="error">{error}</Typography>
            </Box>
        )
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
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <NewReleases sx={{ fontSize: 24 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        What's New in BeePEE
                    </Typography>
                </Stack>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
                <Stack spacing={0} divider={<Divider />}>
                    {changelog?.versions?.map((version, versionIndex) => (
                        <Box key={versionIndex} sx={{ py: 3 }}>
                            {/* Version Header */}
                            <Stack
                                direction="row"
                                spacing={1.5}
                                alignItems="center"
                                sx={{ mb: 2 }}>
                                <Chip
                                    label={`v${version.version}`}
                                    sx={{ fontWeight: 600 }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary">
                                    {version.date}
                                </Typography>
                                {versionIndex === 0 && (
                                    <Chip
                                        label="Latest"
                                        size="small"
                                    />
                                )}
                            </Stack>

                            {/* Changes by Category */}
                            <Stack spacing={2}>
                                {Object.entries(version.changes).map(
                                    ([category, items]) => (
                                        <Box key={category}>
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                alignItems="center"
                                                sx={{ mb: 1 }}>
                                                {getCategoryIcon(category)}
                                                <Typography
                                                    variant="subtitle2"
                                                    sx={{
                                                        fontWeight: 600,
                                                    }}>
                                                    {getCategoryTitle(category)}
                                                </Typography>
                                            </Stack>
                                            <Stack spacing={0.5} sx={{ pl: 3 }}>
                                                {items.map((item, itemIndex) => (
                                                    <Box
                                                        key={itemIndex}
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "flex-start",
                                                            gap: 1,
                                                        }}>
                                                        <Box
                                                            sx={{
                                                                width: 4,
                                                                height: 4,
                                                                borderRadius:
                                                                    "50%",
                                                                bgcolor: "text.secondary",
                                                                mt: 1,
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                lineHeight: 1.6,
                                                            }}>
                                                            {item}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        </Box>
                                    ),
                                )}
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            </Box>
        </Box>
    )
}

export default ChangelogPage
