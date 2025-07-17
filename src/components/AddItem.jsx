import { Box } from "@mui/material"
import { Add } from "@mui/icons-material"

function AddButton() {
    return (
        <Box
            onClick={() => {
                // Handle add package click
                console.log("Add package clicked")
                // You could open a file dialog here
            }}
            sx={{
                width: 96,
                height: 96,
                border: "1px dashed #444",
                borderRadius: 1,
                boxSizing: "border-box",
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                "&:hover": {
                    borderColor: "#666",
                    backgroundColor: "rgba(255,255,255,0.05)",
                },
            }}>
            <Add sx={{ fontSize: 48, color: "#888" }} />
        </Box>
    )
}

export default AddButton
