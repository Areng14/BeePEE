import { HashRouter, Routes, Route } from "react-router-dom"
import { useState, useEffect } from "react"
import ItemBrowser from "./components/ItemBrowser"
import ItemEditor from "./components/ItemEditor"
import CreateItemPage from "./pages/CreateItemPage"
import CreatePackagePage from "./pages/CreatePackagePage"
import PackageInformationPage from "./pages/PackageInformationPage"
import ChangelogPage from "./pages/ChangelogPage"
import WelcomePage from "./pages/WelcomePage"
import ModelPreviewPage from "./pages/ModelPreviewPage"
import LoadingPopup from "./components/LoadingPopup"
import UpdateNotification from "./components/UpdateNotification"
import CrashReportPage from "./pages/CrashReportPage"
import BeePackagePage from "./pages/BeePackagePage"
import { ItemProvider } from "./contexts/ItemContext"
import "./global.css"

function App() {
    // Check if this window should show the editor or create page (for production builds)
    const urlParams = new URLSearchParams(window.location.search)
    const routeParam = urlParams.get("route")
    const showEditor = routeParam === "editor"
    const showCreateItem = routeParam === "create-item"
    const showCreatePackage = routeParam === "create-package"
    const showPackageInformation = routeParam === "package-information"
    const showChangelog = routeParam === "changelog"
    const showModelPreview = routeParam === "model-preview"
    const showCrashReport = routeParam === "crash-report"
    const showBeePackage = routeParam === "bee-package"
    const [packageLoaded, setPackageLoaded] = useState(false)
    const [loadingState, setLoadingState] = useState({
        open: false,
        progress: 0,
        message: "Loading...",
        error: null,
    })
    useEffect(() => {
        // window.package should be available immediately after preload script loads
        if (!window.package) {
            console.error("window.package is not available - preload script may have failed")
            return
        }

        // Listen for package loading progress updates
        const handleProgress = (data) => {
            setLoadingState({
                open: true,
                progress: data.progress,
                message: data.message,
                error: data.error || null,
            })

            if (data.progress >= 100 && !data.error) {
                setLoadingState((prev) => ({ ...prev, open: false }))
            }
        }

        // Listen for package loaded event
        const handlePackageLoaded = (items) => {
            setPackageLoaded(true)
        }

        // Listen for package closed event
        const handlePackageClosed = () => {
            setPackageLoaded(false)
        }

        // Register event listeners
        window.package.onPackageLoadingProgress(handleProgress)
        window.package.onPackageLoaded(handlePackageLoaded)
        window.package.onPackageClosed(handlePackageClosed)

        // Cleanup is handled by preload script's event listener management
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
            ) : showChangelog ? (
                // Show ChangelogPage directly for production windows
                <ChangelogPage />
            ) : showModelPreview ? (
                // Show ModelPreviewPage directly for production windows
                <ModelPreviewPage />
            ) : showCrashReport ? (
                // Show CrashReportPage directly for production windows
                <CrashReportPage />
            ) : showBeePackage ? (
                // Show BeePackagePage directly for production windows
                <BeePackagePage />
            ) : (
                // Use normal routing for main window and development
                <>
                    <HashRouter>
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    packageLoaded
                                        ? (() => {
                                              console.log(
                                                  "Rendering ItemBrowser (packageLoaded=true)",
                                              )
                                              return <ItemBrowser />
                                          })()
                                        : (() => {
                                              console.log(
                                                  "Rendering WelcomePage (packageLoaded=false)",
                                              )
                                              return <WelcomePage />
                                          })()
                                }
                            />
                            <Route path="/editor" element={<ItemEditor />} />
                            <Route
                                path="/create-item"
                                element={<CreateItemPage />}
                            />
                            <Route
                                path="/create-package"
                                element={<CreatePackagePage />}
                            />
                            <Route
                                path="/package-information"
                                element={<PackageInformationPage />}
                            />
                            <Route
                                path="/changelog"
                                element={<ChangelogPage />}
                            />
                            <Route
                                path="/model-preview"
                                element={<ModelPreviewPage />}
                            />
                            <Route
                                path="/crash-report"
                                element={<CrashReportPage />}
                            />
                            <Route
                                path="/bee-package"
                                element={<BeePackagePage />}
                            />
                        </Routes>
                    </HashRouter>
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
                    <UpdateNotification />
                </>
            )}
        </ItemProvider>
    )
}

export default App
