import React, { useState, useEffect } from 'react'
import {
    Box,
    Paper,
    Typography,
    Stack,
    Alert
} from '@mui/material'
import { Info as InfoIcon } from '@mui/icons-material'

const Metadata = ({ item }) => {
    const [metadata, setMetadata] = useState({
        created: '',
        lastModified: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (item?.id) {
            loadMetadata()
        }
    }, [item?.id])

    const loadMetadata = async () => {
        try {
            setLoading(true)
            const result = await window.package.getItemMetadata(item.id)
            if (result.success) {
                setMetadata(result.metadata)
            } else {
                setError('Failed to load metadata')
            }
        } catch (error) {
            setError('Failed to load metadata: ' + error.message)
        } finally {
            setLoading(false)
        }
    }





    if (!item) {
        return (
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" color="text.secondary">
                    No item selected
                </Typography>
            </Paper>
        )
    }

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <InfoIcon color="primary" />
                <Typography variant="h6">Item Metadata</Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}



            <Stack spacing={2}>
                {/* Timestamps */}
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Created
                    </Typography>
                    <Typography variant="body2">
                        {metadata.created ? new Date(metadata.created).toLocaleString() : 'Unknown'}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Last Modified
                    </Typography>
                    <Typography variant="body2">
                        {metadata.lastModified ? new Date(metadata.lastModified).toLocaleString() : 'Unknown'}
                    </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    These timestamps are automatically managed by the system.
                </Typography>
            </Stack>
        </Paper>
    )
}

export default Metadata 