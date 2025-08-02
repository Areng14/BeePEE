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
    
    // Deferred changes state
    const [deferredChanges, setDeferredChanges] = useState({
        basicInfo: {},
        instances: { added: [], removed: [], replaced: [] },
        inputs: {},
        vbsp: {},
        other: {},
        hasChanges: false
    })

    // Function to update deferred changes
    const updateDeferredChanges = useCallback((section, changes) => {
        setDeferredChanges(prev => {
            const newChanges = {
                ...prev,
                [section]: { ...prev[section], ...changes },
                hasChanges: true
            }
            return newChanges
        })
    }, [])

    // Function to add instance change
    const addDeferredInstanceChange = useCallback((type, data) => {
        setDeferredChanges(prev => {
            const newInstances = { ...prev.instances }
            newInstances[type] = [...newInstances[type], data]
            return {
                ...prev,
                instances: newInstances,
                hasChanges: true
            }
        })
    }, [])

    // Function to undo/remove a specific deferred change
    const undoDeferredChange = useCallback((section, changeType, index) => {
        setDeferredChanges(prev => {
            if (section === 'instances') {
                const newInstances = { ...prev.instances }
                newInstances[changeType] = newInstances[changeType].filter((_, i) => i !== index)
                
                // Check if we still have changes
                const stillHasChanges = 
                    Object.keys(prev.basicInfo).length > 0 ||
                    newInstances.added.length > 0 ||
                    newInstances.removed.length > 0 ||
                    newInstances.replaced.length > 0 ||
                    Object.keys(prev.inputs).length > 0 ||
                    Object.keys(prev.vbsp).length > 0 ||
                    Object.keys(prev.other).length > 0

                return {
                    ...prev,
                    instances: newInstances,
                    hasChanges: stillHasChanges
                }
            } else if (section === 'basicInfo') {
                const newBasicInfo = { ...prev.basicInfo }
                delete newBasicInfo[changeType]
                
                // Check if we still have changes
                const stillHasChanges = 
                    Object.keys(newBasicInfo).length > 0 ||
                    prev.instances.added.length > 0 ||
                    prev.instances.removed.length > 0 ||
                    prev.instances.replaced.length > 0 ||
                    Object.keys(prev.inputs).length > 0 ||
                    Object.keys(prev.vbsp).length > 0 ||
                    Object.keys(prev.other).length > 0

                return {
                    ...prev,
                    basicInfo: newBasicInfo,
                    hasChanges: stillHasChanges
                }
            }
            return prev
        })
    }, [])

    // Function to clear all deferred changes
    const clearDeferredChanges = useCallback(() => {
        setDeferredChanges({
            basicInfo: {},
            instances: { added: [], removed: [], replaced: [] },
            inputs: {},
            vbsp: {},
            other: {},
            hasChanges: false
        })
    }, [])

    // Function to check if there are unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        return deferredChanges.hasChanges
    }, [deferredChanges.hasChanges])

    // Function to apply all deferred changes
    const applyDeferredChanges = useCallback(async () => {
        if (!item || !deferredChanges.hasChanges) return { success: false, error: "No changes to apply" }

        setLoading(true)
        setError(null)

        try {
            // Prepare the save data with all deferred changes
            const saveData = {
                id: item.id,
                name: deferredChanges.basicInfo.name || item.name,
                fullItemPath: item.fullItemPath,
                details: {
                    ...item.details,
                    Authors: deferredChanges.basicInfo.author !== undefined 
                        ? deferredChanges.basicInfo.author 
                        : item.details?.Authors,
                    Description: deferredChanges.basicInfo.description !== undefined 
                        ? deferredChanges.basicInfo.description 
                        : item.details?.Description,
                },
                // Add other deferred changes as needed
                deferredInstanceChanges: deferredChanges.instances,
                inputChanges: deferredChanges.inputs,
                vbspChanges: deferredChanges.vbsp,
                otherChanges: deferredChanges.other,
            }

            // Apply instance changes first
            // Remove instances (do this first to avoid index shifting issues)
            for (const instanceChange of deferredChanges.instances.removed) {
                try {
                    await window.package.removeInstance(item.id, instanceChange.index)
                } catch (error) {
                    console.error(`Failed to remove instance at index ${instanceChange.index}:`, error)
                }
            }

            // Replace instances
            for (const instanceChange of deferredChanges.instances.replaced) {
                try {
                    await window.package.replaceInstanceFileDialog(item.id, instanceChange.index)
                } catch (error) {
                    console.error(`Failed to replace instance at index ${instanceChange.index}:`, error)
                }
            }

            // Add new instances (do this last)
            for (const instanceChange of deferredChanges.instances.added) {
                try {
                    await window.package.addInstanceFileDialog(item.id)
                } catch (error) {
                    console.error("Failed to add instance:", error)
                }
            }

            // Apply icon change if any
            if (deferredChanges.basicInfo.icon && deferredChanges.basicInfo.icon.action === "browse") {
                try {
                    await window.package.browseForIcon(deferredChanges.basicInfo.icon.itemId)
                } catch (error) {
                    console.error("Failed to apply icon change:", error)
                }
            }

            // Send save data via IPC for basic info changes
            const result = await window.package?.saveItem?.(saveData)

            if (result?.success) {
                // Clear deferred changes after successful save
                clearDeferredChanges()
                
                // Clear unsaved changes indicator
                window.package?.setUnsavedChanges?.(false)
                
                setLoading(false)
                return { success: true }
            } else {
                throw new Error("Failed to save item")
            }
        } catch (error) {
            console.error("ItemContext: Failed to apply changes:", error)
            setError(error.message)
            setLoading(false)
            return { success: false, error: error.message }
        }
    }, [item, deferredChanges, clearDeferredChanges])

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
        // Deferred changes management
        deferredChanges,
        updateDeferredChanges,
        addDeferredInstanceChange,
        undoDeferredChange,
        clearDeferredChanges,
        hasUnsavedChanges,
        applyDeferredChanges,
    }

    return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>
}
