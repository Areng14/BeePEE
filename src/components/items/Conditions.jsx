import { Box, Typography } from "@mui/material"

function Conditions({ item, formData, onUpdateConditions }) {
    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Conditions
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Configure VBSP conditions and logic
            </Typography>
            {/* TODO: Add Conditions editing */}
        </Box>
    )
}

export default Conditions 