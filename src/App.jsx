import { useEffect, useState } from "react"
import { Box, Grid } from "@mui/material"
import ItemIcon from "./components/ItemIcon"
import AddButton from "./components/AddItem"

function App() {
    const [items, setItems] = useState([])
    const [gridSize, setGridSize] = useState({ cols: 12, rows: 8 })

    useEffect(() => {
        console.log("Component mounted, setting up package listener")

        // Wait for signal
        window.package.onPackageLoaded((loadedItems) => {
            console.log("Package loaded callback fired")
            console.log("loadedItems:", loadedItems)
            console.log("loadedItems length:", loadedItems?.length)

            setItems(loadedItems || [])
            console.log("setItems called")
        })
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

    const itemsInLastRow = items.length % gridSize.cols
    const placeholdersToCompleteRow =
        itemsInLastRow === 0 ? 0 : gridSize.cols - itemsInLastRow
    const totalPlaceholders = placeholdersToCompleteRow + gridSize.cols

    return (
        <Box sx={{ width: "100%", height: "100vh" }}>
            <Grid container spacing={1} sx={{ py: 2, px: 2 }}>
                {/* Actual items */}
                {items.map((item) => (
                    <Grid key={item.id} size="auto">
                        <ItemIcon item={item} />
                    </Grid>
                ))}

                {/* Add button - first placeholder */}
                <Grid size="auto">
                    <AddButton />
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
                                    boxSizing: 'border-box',
                                    overflow: 'hidden',
                                    cursor: 'default'
                                }}
                            />
                        </Grid>
                    ),
                )}
            </Grid>
        </Box>
    )
}

export default App
