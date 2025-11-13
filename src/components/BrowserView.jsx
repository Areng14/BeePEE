import { useState } from "react"
import { Box } from "@mui/material"
import BrowserSidebar from "./BrowserSidebar"
import ItemBrowser from "./ItemBrowser"
import SignageBrowser from "./SignageBrowser"

function BrowserView() {
    const [activeView, setActiveView] = useState("items")

    return (
        <Box sx={{ display: "flex", width: "100%", height: "100vh" }}>
            <BrowserSidebar
                activeView={activeView}
                onViewChange={setActiveView}
            />
            <Box sx={{ flex: 1, overflow: "auto" }}>
                {activeView === "items" ? <ItemBrowser /> : <SignageBrowser />}
            </Box>
        </Box>
    )
}

export default BrowserView

