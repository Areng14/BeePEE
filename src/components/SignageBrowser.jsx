import { useState, useEffect } from "react"
import { Box, Grid, Tooltip } from "@mui/material"
import { Image as SignageIcon } from "@mui/icons-material"
import AddButton from "./AddItem"

// Signage icon component with hidden signage handling
function SignageIconCell({ signage, onEdit }) {
    const [imageSrc, setImageSrc] = useState(null)
    const isHidden = signage.hidden

    useEffect(() => {
        // Get icon from first available style
        const styles = signage.styles || {}
        const firstStyleKey = Object.keys(styles)[0]
        const iconPath = firstStyleKey ? styles[firstStyleKey]?.icon : null

        if (iconPath) {
            window.package
                .loadFile(iconPath)
                .then(setImageSrc)
                .catch((error) => {
                    console.warn(
                        `Failed to load icon for signage ${signage.name}:`,
                        error,
                    )
                    setImageSrc(null)
                })
        }
    }, [signage])

    return (
        <Tooltip
            title={`${signage.name || "Signage"}${isHidden ? " (Hidden/Secondary)" : ""}`}
            placement="top">
            <Box
                onClick={onEdit}
                sx={{
                    width: 96,
                    height: 96,
                    border: "1px solid #555",
                    borderRadius: 1,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "background.paper",
                    opacity: isHidden ? 0.5 : 1,
                    position: "relative",
                    "&:hover": {
                        borderColor: "primary.main",
                        backgroundColor: "action.hover",
                    },
                }}>
                {isHidden && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            fontSize: 10,
                            color: "text.disabled",
                            backgroundColor: "rgba(0,0,0,0.5)",
                            px: 0.5,
                            borderRadius: 0.5,
                            zIndex: 1,
                        }}>
                        2nd
                    </Box>
                )}
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt={signage.name}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : (
                    <SignageIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                )}
            </Box>
        </Tooltip>
    )
}

function SignageBrowser() {
    const [signages, setSignages] = useState([])
    const [gridSize, setGridSize] = useState({ cols: 12, rows: 8 })

    useEffect(() => {
        console.log("SignageBrowser mounted, setting up package listener")

        // Fetch current signages on mount (in case package was already loaded)
        const fetchCurrentSignages = async () => {
            try {
                const currentSignages =
                    await window.package.getCurrentSignages?.()
                if (currentSignages && currentSignages.length > 0) {
                    console.log(
                        "SignageBrowser: Fetched current signages on mount:",
                        currentSignages.length,
                    )
                    setSignages(currentSignages)
                }
            } catch (error) {
                console.log(
                    "SignageBrowser: No current signages available (this is normal for packages without signages)",
                )
            }
        }
        fetchCurrentSignages()

        // Handle package load and updates
        const handlePackageLoaded = (data) => {
            console.log("SignageBrowser: Package loaded callback fired")
            // Handle both old format (items array) and new format ({ items, signages })
            const loadedSignages = Array.isArray(data)
                ? []
                : data?.signages || []
            console.log("SignageBrowser: Loaded signages:", loadedSignages.length)
            setSignages(loadedSignages)
        }

        // Handle package close
        const handlePackageClosed = () => {
            console.log("SignageBrowser: Package closed, clearing signages")
            setSignages([])
        }

        // Register listeners
        window.package.onPackageLoaded(handlePackageLoaded)
        window.package.onPackageClosed(handlePackageClosed)

        return () => {
            console.log("Cleaning up SignageBrowser listeners")
        }
    }, [])

    useEffect(() => {
        const updateGridSize = () => {
            const itemSize = 96
            const spacing = 8
            const totalItemSize = itemSize + spacing

            const cols = Math.floor((window.innerWidth - 40) / totalItemSize)
            const rows = Math.floor((window.innerHeight - 40) / totalItemSize)
            setGridSize({ cols, rows })
        }

        updateGridSize()
        window.addEventListener("resize", updateGridSize)
        return () => window.removeEventListener("resize", updateGridSize)
    }, [])

    const handleEditSignage = (signageId) => {
        console.log("Edit signage:", signageId)
        // TODO: Open signage editor
    }

    const handleAddSignage = () => {
        console.log("Add signage clicked")
        // TODO: Open add signage dialog
    }

    const signagesInLastRow = signages.length % gridSize.cols
    const placeholdersToCompleteRow =
        signagesInLastRow === 0 ? 0 : gridSize.cols - signagesInLastRow
    const totalPlaceholders = placeholdersToCompleteRow + gridSize.cols

    return (
        <Box sx={{ width: "100%", height: "100vh" }}>
            <Grid container spacing={1} sx={{ py: 2, px: 2 }}>
                {/* Actual signages */}
                {signages.map((signage) => (
                    <Grid key={signage.id} size="auto">
                        <SignageIconCell
                            signage={signage}
                            onEdit={() => handleEditSignage(signage.id)}
                        />
                    </Grid>
                ))}

                {/* Add button - first placeholder */}
                <Grid size="auto">
                    <AddButton onClick={handleAddSignage} />
                </Grid>

                {/* Regular placeholder cells */}
                {Array.from({ length: totalPlaceholders - 1 }).map(
                    (_, index) => (
                        <Grid key={`empty-${index}`} size="auto">
                            <Box
                                sx={{
                                    width: 96,
                                    height: 96,
                                    border: "1px dashed #444",
                                    borderRadius: 1,
                                    boxSizing: "border-box",
                                    overflow: "hidden",
                                    cursor: "default",
                                }}
                            />
                        </Grid>
                    ),
                )}
            </Grid>
        </Box>
    )
}

export default SignageBrowser
