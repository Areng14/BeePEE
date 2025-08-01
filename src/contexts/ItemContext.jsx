import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react"

const ItemContext = createContext()

export const useItemContext = () => {
    const context = useContext(ItemContext)
    if (!context) {
        throw new Error("useItemContext must be used within an ItemProvider")
    }
    return context
}

export const ItemProvider = ({ children }) => {
    const [item, setItem] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Function to reload item data from backend
    const reloadItem = useCallback(async (itemId) => {
        if (!itemId) return

        console.log("ItemContext: reloadItem called with itemId:", itemId)
        setLoading(true)
        setError(null)

        try {
            // Since there's no getItem function, we'll rely on the backend events
            // The backend should send item-updated events when data changes
            console.log("ItemContext: reloadItem - waiting for backend event")
            setLoading(false)
        } catch (err) {
            console.error("ItemContext: Failed to reload item:", err)
            setError(err.message)
            setLoading(false)
        }
    }, [])

    // Function to update item data
    const updateItem = useCallback((newItemData) => {
        console.log("ItemContext: updateItem called with:", newItemData)
        setItem(newItemData)
    }, [])

    // Listen for item updates from backend
    useEffect(() => {
        console.log("ItemContext: Setting up event listeners")

        const handleItemUpdate = (event, updatedItem) => {
            console.log(
                "ItemContext: Received item-updated event from backend:",
                {
                    id: updatedItem.id,
                    instances: updatedItem.instances,
                    instanceCount: Object.keys(updatedItem.instances || {})
                        .length,
                },
            )
            setItem(updatedItem)
        }

        const handleItemLoaded = (event, loadedItem) => {
            console.log(
                "ItemContext: Received item-loaded event from backend:",
                {
                    id: loadedItem.id,
                    instances: loadedItem.instances,
                    instanceCount: Object.keys(loadedItem.instances || {})
                        .length,
                },
            )
            setItem(loadedItem)
        }

        // Set up event listeners with error handling
        try {
            if (window.package?.onItemUpdated) {
                window.package.onItemUpdated(handleItemUpdate)
            }
            if (window.package?.onItemLoaded) {
                window.package.onItemLoaded(handleItemLoaded)
            }
        } catch (err) {
            console.error("ItemContext: Error setting up event listeners:", err)
        }

        // Cleanup
        return () => {
            console.log("ItemContext: Cleaning up event listeners")
            try {
                if (window.package?.onItemUpdated) {
                    window.package.onItemUpdated(null)
                }
                if (window.package?.onItemLoaded) {
                    window.package.onItemLoaded(null)
                }
            } catch (err) {
                console.error(
                    "ItemContext: Error cleaning up event listeners:",
                    err,
                )
            }
        }
    }, [])

    // Debug effect to log item changes
    useEffect(() => {
        console.log("ItemContext: Item state changed:", {
            id: item?.id,
            instances: item?.instances,
            instanceCount: item?.instances
                ? Object.keys(item.instances).length
                : 0,
        })
    }, [item])

    const value = {
        item,
        loading,
        error,
        reloadItem,
        updateItem,
        setItem,
    }

    return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>
}
