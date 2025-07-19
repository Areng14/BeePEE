import { Box, Typography } from '@mui/material'

function Inputs({ item }) {
    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Inputs & Outputs
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Configure item inputs and outputs here.
            </Typography>
            {/* TODO: Add input/output management UI */}
        </Box>
    )
}

export default Inputs