import { useState, useEffect } from "react"
import { Box, IconButton, Tooltip, Snackbar, Alert } from "@mui/material"
import {
    Inventory2 as ItemsIcon,
    Image as SignagesIcon,
} from "@mui/icons-material"
import ItemBrowser from "./ItemBrowser"
import SignageBrowser from "./SignageBrowser"

// Tab configuration - add new tabs here
const TAB_CONFIG = [
    {
        id: "items",
        label: "Items",
        icon: <ItemsIcon />,
        component: ItemBrowser,
    },
    {
        id: "signages",
        label: "Signages",
        icon: <SignagesIcon />,
        component: SignageBrowser,
    },
]

function MainTabs() {
    const [activeTab, setActiveTab] = useState(0)
    const [packageEmpty, setPackageEmpty] = useState(false)

    useEffect(() => {
        const handlePackageLoaded = (data) => {
            // Handle both old format (items array) and new format ({ items, signages })
            const hasItems = Array.isArray(data)
                ? data.length > 0
                : (data?.items?.length || 0) > 0
            const hasSignages = Array.isArray(data)
                ? false
                : (data?.signages?.length || 0) > 0

            setPackageEmpty(!hasItems && !hasSignages)
        }

        window.package.onPackageLoaded(handlePackageLoaded)

        // Also check on mount
        const checkCurrentPackage = async () => {
            try {
                const items = (await window.package.getCurrentItems?.()) || []
                const signages =
                    (await window.package.getCurrentSignages?.()) || []
                setPackageEmpty(items.length === 0 && signages.length === 0)
            } catch {
                // Ignore - package might not be loaded
            }
        }
        checkCurrentPackage()
    }, [])

    const ActiveComponent = TAB_CONFIG[activeTab]?.component

    return (
        <Box sx={{ display: "flex", height: "100vh" }}>
            {/* Sidebar */}
            <Box
                sx={{
                    width: 56,
                    minWidth: 56,
                    maxWidth: 56,
                    backgroundColor: "background.paper",
                    borderRight: 1,
                    borderColor: "divider",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    py: 1,
                    gap: 0.5,
                }}>
                {TAB_CONFIG.map((tab, index) => (
                    <Tooltip key={tab.id} title={tab.label} placement="right">
                        <IconButton
                            onClick={() => setActiveTab(index)}
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 1.5,
                                color:
                                    activeTab === index
                                        ? "primary.main"
                                        : "text.secondary",
                                "&:hover": {
                                    backgroundColor: "action.hover",
                                },
                            }}>
                            {tab.icon}
                        </IconButton>
                    </Tooltip>
                ))}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: "auto", position: "relative" }}>
                {ActiveComponent && <ActiveComponent />}
            </Box>

            {/* Empty-package notice — floating toast, not a banner */}
            <Snackbar
                open={packageEmpty}
                autoHideDuration={6000}
                onClose={(e, reason) => {
                    if (reason !== "clickaway") setPackageEmpty(false)
                }}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}>
                <Alert
                    severity="warning"
                    variant="filled"
                    onClose={() => setPackageEmpty(false)}
                    sx={{ boxShadow: 4 }}>
                    This package has no items or signages!
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default MainTabs
