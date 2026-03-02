import { useState, useEffect } from "react"
import { Box, Grid, Tooltip } from "@mui/material"
import { Image as SignageIcon } from "@mui/icons-material"
import AddButton from "./AddItem"

// Placeholder signage icon component
function SignageIconCell({ signage, onEdit }) {
    return (
        <Tooltip title={signage.name || "Signage"} placement="top">
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
                    "&:hover": {
                        borderColor: "primary.main",
                        backgroundColor: "action.hover",
                    },
                }}>
                <SignageIcon sx={{ fontSize: 48, color: "text.secondary" }} />
            </Box>
        </Tooltip>
    )
}

function SignageBrowser() {
    const [signages, setSignages] = useState([])
    const [gridSize, setGridSize] = useState({ cols: 12, rows: 8 })

    // TODO: Load signages from package when backend is ready
    useEffect(() => {
        console.log("SignageBrowser mounted")
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
