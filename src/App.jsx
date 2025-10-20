import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useState, useEffect } from "react"
import ItemBrowser from "./components/ItemBrowser"
import ItemEditor from "./components/ItemEditor"
import CreateItemPage from "./pages/CreateItemPage"
import LoadingPopup from "./components/LoadingPopup"
import { ItemProvider } from "./contexts/ItemContext"
import "./global.css"

function App() {
    // Check if this window should show the editor or create page (for production builds)
    const urlParams = new URLSearchParams(window.location.search)
    const routeParam = urlParams.get('route')
    const showEditor = routeParam === 'editor'
    const showCreateItem = routeParam === 'create-item'
    const [loadingState, setLoadingState] = useState({
        open: false,
        progress: 0,
        message: "Loading...",
        error: null,
    })

    useEffect(() => {
        // Listen for package loading progress updates
        const handleProgress = (data) => {
            setLoadingState({
                open: true,
                progress: data.progress,
                message: data.message,
                error: data.error || null,
            })

            // Auto-hide when complete (unless there's an error)
            if (data.progress >= 100 && !data.error) {
                setLoadingState((prev) => ({ ...prev, open: false }))
            }
        }

        if (window.package?.onPackageLoadingProgress) {
            window.package.onPackageLoadingProgress(handleProgress)
        }

        return () => {
            // Cleanup if needed
        }
    }, [])

    return (
        <ItemProvider>
            {showEditor ? (
                // Show ItemEditor directly for production editor windows
                <>
                    <ItemEditor />
                    <LoadingPopup
                        open={loadingState.open}
                        progress={loadingState.progress}
                        message={loadingState.message}
                        error={loadingState.error}
                        onClose={() =>
                            setLoadingState((prev) => ({
                                ...prev,
                                open: false,
                                error: null,
                            }))
                        }
                    />
                </>
            ) : showCreateItem ? (
                // Show CreateItemPage directly for production create windows
                <CreateItemPage />
            ) : (
                // Use normal routing for main window and development
                <>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<ItemBrowser />} />
                            <Route path="/editor" element={<ItemEditor />} />
                            <Route path="/create-item" element={<CreateItemPage />} />
                        </Routes>
                    </BrowserRouter>
                    <LoadingPopup
                        open={loadingState.open}
                        progress={loadingState.progress}
                        message={loadingState.message}
                        error={loadingState.error}
                        onClose={() =>
                            setLoadingState((prev) => ({
                                ...prev,
                                open: false,
                                error: null,
                            }))
                        }
                    />
                </>
            )}
        </ItemProvider>
    )
}

export default App
