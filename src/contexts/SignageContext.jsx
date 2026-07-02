import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react"

const SignageContext = createContext()

export const useSignageContext = () => {
    const context = useContext(SignageContext)
    if (!context) {
        throw new Error("useSignageContext must be used within a SignageProvider")
    }
    return context
}

export const SignageProvider = ({ children }) => {
    const [signage, setSignage] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Function to update signage data
    const updateSignage = useCallback((newSignageData) => {
        console.log("SignageContext: updateSignage called with:", newSignageData)
        setSignage(newSignageData)
    }, [])

    // Listen for signage updates from backend
    useEffect(() => {
        console.log("SignageContext: Setting up event listeners")

        const handleSignageUpdate = (event, updatedSignage) => {
            console.log(
                "SignageContext: Received signage-updated event from backend:",
                {
                    id: updatedSignage.id,
                    name: updatedSignage.name,
                    styles: Object.keys(updatedSignage.styles || {}),
                },
            )
            setSignage(updatedSignage)
        }

        const handleSignageLoaded = (event, loadedSignage) => {
            console.log(
                "SignageContext: Received signage-loaded event from backend:",
                {
                    id: loadedSignage.id,
                    name: loadedSignage.name,
                    styles: Object.keys(loadedSignage.styles || {}),
                },
            )
            setSignage(loadedSignage)
        }

        // Set up event listeners with error handling
        try {
            if (window.package?.onSignageUpdated) {
                window.package.onSignageUpdated(handleSignageUpdate)
            }
            if (window.package?.onSignageLoaded) {
                window.package.onSignageLoaded(handleSignageLoaded)
            }
        } catch (err) {
            console.error("SignageContext: Error setting up event listeners:", err)
        }

        // Cleanup
        return () => {
            console.log("SignageContext: Cleaning up event listeners")
            try {
                if (window.package?.onSignageUpdated) {
                    window.package.onSignageUpdated(null)
                }
                if (window.package?.onSignageLoaded) {
                    window.package.onSignageLoaded(null)
                }
            } catch (err) {
                console.error(
                    "SignageContext: Error cleaning up event listeners:",
                    err,
                )
            }
        }
    }, [])

    // Debug effect to log signage changes
    useEffect(() => {
        console.log("SignageContext: Signage state changed:", {
            id: signage?.id,
            name: signage?.name,
            hidden: signage?.hidden,
            stylesCount: signage?.styles
                ? Object.keys(signage.styles).length
                : 0,
        })
    }, [signage])

    const value = {
        signage,
        loading,
        error,
        updateSignage,
        setSignage,
    }

    return (
        <SignageContext.Provider value={value}>{children}</SignageContext.Provider>
    )
}
