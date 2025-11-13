import { Box, IconButton, Tooltip } from "@mui/material"
import { ViewInAr, SignpostOutlined } from "@mui/icons-material"

function BrowserSidebar({ activeView, onViewChange }) {
    return (
        <Box
            sx={{
                width: 60,
                height: "100vh",
                backgroundColor: "#1a1a1a",
                borderRight: "1px solid #444",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 2,
                gap: 1,
            }}>
            <Tooltip title="Items" placement="right">
                <IconButton
                    onClick={() => onViewChange("items")}
                    sx={{
                        color: activeView === "items" ? "#d2b019ff" : "#888",
                        backgroundColor:
                            activeView === "items"
                                ? "rgba(210, 176, 25, 0.08)"
                                : "transparent",
                        "&:hover": {
                            backgroundColor:
                                activeView === "items"
                                    ? "rgba(210, 176, 25, 0.16)"
                                    : "rgba(255, 255, 255, 0.08)",
                        },
                        borderRadius: 1,
                        width: 48,
                        height: 48,
                    }}>
                    <ViewInAr />
                </IconButton>
            </Tooltip>

            <Tooltip title="Signages" placement="right">
                <IconButton
                    onClick={() => onViewChange("signages")}
                    sx={{
                        color: activeView === "signages" ? "#d2b019ff" : "#888",
                        backgroundColor:
                            activeView === "signages"
                                ? "rgba(210, 176, 25, 0.08)"
                                : "transparent",
                        "&:hover": {
                            backgroundColor:
                                activeView === "signages"
                                    ? "rgba(210, 176, 25, 0.16)"
                                    : "rgba(255, 255, 255, 0.08)",
                        },
                        borderRadius: 1,
                        width: 48,
                        height: 48,
                    }}>
                    <SignpostOutlined />
                </IconButton>
            </Tooltip>
        </Box>
    )
}

export default BrowserSidebar

