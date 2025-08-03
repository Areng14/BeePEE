import { Box, Typography } from "@mui/material"

function Other({ item, formData, onUpdateOther }) {
    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Other stuff
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Configure other stuff here
            </Typography>
            {/* TODO: Add input/output management UI */}
        </Box>
    )
}

export default Other
