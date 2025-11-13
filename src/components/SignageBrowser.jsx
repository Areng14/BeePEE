import { useEffect, useState } from "react"
import { Box, Grid } from "@mui/material"
import SignageIcon from "./SignageIcon"

function SignageBrowser() {
    const [signages, setSignages] = useState([])
    const [gridSize, setGridSize] = useState({ cols: 12, rows: 8 })

    useEffect(() => {
        console.log("SignageBrowser: Component mounted, setting up package listener")

        // Fetch current signages on mount (in case package was already loaded)
        const fetchCurrentSignages = async () => {
            try {
                const currentSignages = await window.package.getCurrentSignages?.()
                if (currentSignages && currentSignages.length > 0) {
                    console.log(
                        "SignageBrowser: Fetched current signages on mount:",
                        currentSignages.length,
                    )
                    // Filter out hidden signages
                    const visibleSignages = currentSignages.filter(s => !s.hidden)
                    setSignages(visibleSignages)
                }
            } catch (error) {
                console.log(
                    "SignageBrowser: No current signages available (this is normal for packages without signages)",
                )
            }
        }
        fetchCurrentSignages()

        // Handle initial package load and updates
        const handlePackageLoaded = (data) => {
            console.log("SignageBrowser: Package loaded callback fired")
            console.log("loadedData:", data)
            
            // Handle both old format (array of items) and new format (object with items and signages)
            let loadedSignages = []
            if (data && typeof data === 'object') {
                if (data.signages) {
                    loadedSignages = data.signages
                }
            }
            
            console.log("loadedSignages length:", loadedSignages?.length)

            // Filter out hidden signages
            const visibleSignages = (loadedSignages || []).filter(s => !s.hidden)
            setSignages(visibleSignages)
            console.log("setSignages called with visible signages:", visibleSignages.length)
        }

        // Handle package close
        const handlePackageClosed = () => {
            console.log("SignageBrowser: Package closed, clearing signages")
            setSignages([])
        }

        // Register listeners
        window.package.onPackageLoaded(handlePackageLoaded)
        window.package.onPackageClosed(handlePackageClosed)

        // Cleanup function
        return () => {
            console.log("Cleaning up SignageBrowser listeners")
        }
    }, [])

    useEffect(() => {
        const updateGridSize = () => {
            const itemSize = 96
            const spacing = 8
            const totalItemSize = itemSize + spacing
            const sidebarWidth = 60

            const cols = Math.floor((window.innerWidth - sidebarWidth - 40) / totalItemSize)
            const rows = Math.floor((window.innerHeight - 40) / totalItemSize)
            setGridSize({ cols, rows })
        }

        updateGridSize()
        window.addEventListener("resize", updateGridSize)
        return () => window.removeEventListener("resize", updateGridSize)
    }, [])

    const itemsInLastRow = signages.length % gridSize.cols
    const placeholdersToCompleteRow =
        itemsInLastRow === 0 ? 0 : gridSize.cols - itemsInLastRow
    const totalPlaceholders = placeholdersToCompleteRow + gridSize.cols

    return (
        <Box sx={{ width: "100%", height: "100vh" }}>
            <Grid container spacing={1} sx={{ py: 2, px: 2 }}>
                {/* Actual signages */}
                {signages.map((signage) => (
                    <Grid key={signage.id} size="auto">
                        <SignageIcon signage={signage} />
                    </Grid>
                ))}

                {/* Placeholder cells */}
                {Array.from({ length: totalPlaceholders }).map((_, index) => (
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
                ))}
            </Grid>
        </Box>
    )
}

export default SignageBrowser

