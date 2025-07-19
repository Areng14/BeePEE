import { Box, Typography } from '@mui/material'

function Instances({ item }) {
    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Instance Files
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Manage VMF instance files here.
            </Typography>
            {/* TODO: Add instance file management UI */}
        </Box>
    )
}

export default Instances