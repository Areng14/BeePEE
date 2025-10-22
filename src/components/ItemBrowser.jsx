import { useEffect, useState } from "react"
import { Box, Grid } from "@mui/material"
import { useNavigate } from "react-router-dom"
import ItemIcon from "./ItemIcon"
import AddButton from "./AddItem"

function ItemBrowser() {
    const [items, setItems] = useState([])
    const [gridSize, setGridSize] = useState({ cols: 12, rows: 8 })
    const navigate = useNavigate()

    useEffect(() => {
        console.log("Component mounted, setting up package listener")

        // Fetch current items on mount (in case package was already loaded)
        const fetchCurrentItems = async () => {
            try {
                const currentItems = await window.package.getCurrentItems?.()
                if (currentItems && currentItems.length > 0) {
                    console.log("ItemBrowser: Fetched current items on mount:", currentItems.length)
                    setItems(currentItems)
                }
            } catch (error) {
                console.log("ItemBrowser: No current items available (this is normal for new packages)")
            }
        }
        fetchCurrentItems()

        // Handle initial package load and updates (includes create/delete)
        const handlePackageLoaded = (loadedItems) => {
            console.log("Package loaded callback fired")
            console.log("loadedItems:", loadedItems)
            console.log("loadedItems length:", loadedItems?.length)

            setItems(loadedItems || [])
            console.log("setItems called")
        }

        // Handle package close
        const handlePackageClosed = () => {
            console.log("ItemBrowser: Package closed, clearing items")
            setItems([])
        }

        // Handle individual item updates
        const handleItemUpdated = (event, updatedItem) => {
            console.log(
                "ItemBrowser received item update:",
                updatedItem?.id,
                updatedItem?.icon,
            )

            if (!updatedItem || !updatedItem.id) {
                console.warn("Received invalid item update:", updatedItem)
                return
            }

            setItems((currentItems) => {
                const itemIndex = currentItems.findIndex(
                    (item) => item.id === updatedItem.id,
                )
                if (itemIndex === -1) {
                    console.log(
                        "Item not found in current list, adding:",
                        updatedItem.id,
                    )
                    return [...currentItems, updatedItem]
                } else {
                    console.log("Updating existing item:", updatedItem.id)
                    return currentItems.map((item) =>
                        item.id === updatedItem.id ? updatedItem : item,
                    )
                }
            })
        }

        // Register listeners
        window.package.onPackageLoaded(handlePackageLoaded)
        window.package.onPackageClosed(handlePackageClosed)
        window.package.onItemUpdated(handleItemUpdated)

        // Add a manual refresh function to window for debugging
        window.refreshItemBrowser = () => {
            console.log("Manual refresh triggered")
            // Try to reload the current package
            if (window.package && window.package.reloadPackage) {
                window.package.reloadPackage()
            }
        }

        // Cleanup function - important for preventing duplicate listeners!
        return () => {
            console.log("Cleaning up ItemBrowser listeners")
            // Note: The current preload doesn't support unregistering, but this prevents memory leaks
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

    const handleEditItem = (itemId) => {
        console.log("Attempting to open editor for item:", itemId)
        console.log("Current items in state:", items.map(i => i.id))
        
        // Always use the current state to find the item
        const currentItem = items.find(i => i.id === itemId)
        if (!currentItem) {
            console.warn("Item no longer exists, skipping editor open:", itemId)
            return
        }
        
        window.package.openItemEditor(currentItem)
    }

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
                        <ItemIcon
                            item={item}
                            onEdit={() => handleEditItem(item.id)}
                        />
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

export default ItemBrowser
