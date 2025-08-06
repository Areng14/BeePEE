import { Box, Typography, Paper, Alert } from "@mui/material"
import { useEffect, useState } from "react"

function Conditions({ item, formData, onUpdateConditions }) {
    const [vbspConfig, setVbspConfig] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadVbspConfig = async () => {
            if (!item) {
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                setError(null)
                
                // Call the backend to get conditions (which now returns vbsp_config.json content)
                const response = await window.package.getConditions({ itemId: item.id })
                
                if (response.success) {
                    setVbspConfig(response.conditions)
                    console.log("VBSP Config loaded:", response.conditions)
                } else {
                    setError(response.error || "Failed to load VBSP config")
                }
            } catch (err) {
                setError(err.message || "Failed to load VBSP config")
                console.error("Error loading VBSP config:", err)
            } finally {
                setLoading(false)
            }
        }

        loadVbspConfig()
    }, [item])

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Conditions
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                VBSP Configuration (vbsp_config.json content is logged to console)
            </Typography>
            
            {loading && (
                <Typography variant="body2" color="text.secondary">
                    Loading VBSP configuration...
                </Typography>
            )}
            
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            
            {vbspConfig && (
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>
                        VBSP Configuration JSON:
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ 
                        fontSize: '0.75rem', 
                        overflow: 'auto',
                        maxHeight: '400px',
                        bgcolor: 'white',
                        p: 1,
                        border: '1px solid #ddd',
                        borderRadius: 1
                    }}>
                        {JSON.stringify(vbspConfig, null, 2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        This content is also logged to the console for debugging purposes.
                    </Typography>
                </Paper>
            )}
            
            {!loading && !error && !vbspConfig && (
                <Alert severity="info">
                    No VBSP configuration found for this item.
                </Alert>
            )}
        </Box>
    )
}

export default Conditions 