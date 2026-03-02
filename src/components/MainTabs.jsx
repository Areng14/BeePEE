import { useState } from "react"
import { Box, IconButton, Tooltip } from "@mui/material"
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
            <Box sx={{ flex: 1, overflow: "auto" }}>
                {ActiveComponent && <ActiveComponent />}
            </Box>
        </Box>
    )
}

export default MainTabs
