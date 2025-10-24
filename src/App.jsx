import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useState, useEffect } from "react"
import ItemBrowser from "./components/ItemBrowser"
import ItemEditor from "./components/ItemEditor"
import CreateItemPage from "./pages/CreateItemPage"
import CreatePackagePage from "./pages/CreatePackagePage"
import PackageInformationPage from "./pages/PackageInformationPage"
import WelcomePage from "./pages/WelcomePage"
import LoadingPopup from "./components/LoadingPopup"
import { ItemProvider } from "./contexts/ItemContext"
import "./global.css"

function App() {
    // Check if this window should show the editor or create page (for production builds)
    const urlParams = new URLSearchParams(window.location.search)
    const routeParam = urlParams.get('route')
    const showEditor = routeParam === 'editor'
    const showCreateItem = routeParam === 'create-item'
    const showCreatePackage = routeParam === 'create-package'
    const showPackageInformation = routeParam === 'package-information'
    const [packageLoaded, setPackageLoaded] = useState(false)
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

        // Listen for package loaded event
        const handlePackageLoaded = (items) => {
            console.log("Package loaded in App.jsx, items:", items?.length)
            console.log("Setting packageLoaded to true")
            setPackageLoaded(true)
        }

        // Listen for package closed event
        const handlePackageClosed = () => {
            console.log("Package closed in App.jsx")
            console.log("Setting packageLoaded to false")
            setPackageLoaded(false)
            console.log("packageLoaded is now:", false)
        }

        if (window.package?.onPackageLoadingProgress) {
            window.package.onPackageLoadingProgress(handleProgress)
        }

        if (window.package?.onPackageLoaded) {
            window.package.onPackageLoaded(handlePackageLoaded)
        }

        if (window.package?.onPackageClosed) {
            window.package.onPackageClosed(handlePackageClosed)
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
            ) : showCreatePackage ? (
                // Show CreatePackagePage directly for production create windows
                <CreatePackagePage />
            ) : showPackageInformation ? (
                // Show PackageInformationPage directly for production windows
                <PackageInformationPage />
            ) : (
                // Use normal routing for main window and development
                <>
                    <BrowserRouter>
                        <Routes>
                            <Route 
                                path="/" 
                                element={
                                    packageLoaded ? (
                                        (() => {
                                            console.log("Rendering ItemBrowser (packageLoaded=true)")
                                            return <ItemBrowser />
                                        })()
                                    ) : (
                                        (() => {
                                            console.log("Rendering WelcomePage (packageLoaded=false)")
                                            return <WelcomePage />
                                        })()
                                    )
                                } 
                            />
                            <Route path="/editor" element={<ItemEditor />} />
                            <Route path="/create-item" element={<CreateItemPage />} />
                            <Route path="/create-package" element={<CreatePackagePage />} />
                            <Route path="/package-information" element={<PackageInformationPage />} />
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
