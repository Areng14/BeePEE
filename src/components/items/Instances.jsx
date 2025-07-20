import { 
    Box, 
    Typography, 
    Stack, 
    Paper, 
    Button, 
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    IconButton,
    DialogContentText
} from "@mui/material"
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useState } from 'react'

function Instances({ item }) {
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [newInstanceName, setNewInstanceName] = useState('')
    const [instanceToDelete, setInstanceToDelete] = useState(null)
    const [error, setError] = useState('')

    // Get all available instance keys
    const instanceKeys = item?.instances ? Object.keys(item.instances) : []

    const handleEditInstance = async (packagePath, instanceName) => {
        try {
            await window.package.editInstance({ packagePath, instanceName, itemId: item.id })
        } catch (error) {
            console.error("Failed to edit instance:", error)
        }
    }

    const handleAddInstance = async () => {
        if (!newInstanceName) {
            setError('Instance name is required')
            return
        }
        try {
            await window.package.addInstance(item.id, newInstanceName)
            setAddDialogOpen(false)
            setNewInstanceName('')
            setError('')
            // The parent component should handle reloading the item data
        } catch (error) {
            console.error("Failed to add instance:", error)
        }
    }

    const handleRemoveInstance = async () => {
        if (instanceToDelete === null) return
        try {
            await window.package.removeInstance(item.id, instanceToDelete)
            setDeleteDialogOpen(false)
            setInstanceToDelete(null)
            // The parent component should handle reloading the item data
        } catch (error) {
            console.error("Failed to remove instance:", error)
        }
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Instance Files
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddDialogOpen(true)}
                >
                    Add Instance
                </Button>
            </Box>

            {instanceKeys.length > 0 ? (
                <Stack spacing={2}>
                    {instanceKeys.map((key) => {
                        const instance = item.instances[key]
                        return (
                            <Paper key={key} variant="outlined" sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle1" sx={{ mr: 1, minWidth: 'auto' }}>
                                        Instance {key}:
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ 
                                            fontFamily: 'monospace',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1
                                        }}
                                    >
                                        {instance.Name}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleEditInstance(item.packagePath, instance.Name)}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                            setInstanceToDelete(key)
                                            setDeleteDialogOpen(true)
                                        }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Paper>
                        )
                    })}
                </Stack>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    No instances found for this item.
                </Typography>
            )}

            {/* Add Instance Dialog */}
            <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
                <DialogTitle>Add New Instance</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Enter the path to the new instance file (relative to resources folder).
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Instance Path"
                        fullWidth
                        variant="outlined"
                        value={newInstanceName}
                        onChange={(e) => {
                            setNewInstanceName(e.target.value)
                            setError('')
                        }}
                        error={!!error}
                        helperText={error}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setAddDialogOpen(false)
                        setNewInstanceName('')
                        setError('')
                    }}>
                        Cancel
                    </Button>
                    <Button onClick={handleAddInstance} variant="contained">
                        Add
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog 
                open={deleteDialogOpen} 
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#1e1e1e',
                        color: 'white',
                        minWidth: '300px'
                    }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    Remove Instance
                </DialogTitle>
                <DialogContent sx={{ pb: 2 }}>
                    <Typography>
                        Are you sure you want to remove Instance {instanceToDelete}?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 2, pb: 2 }}>
                    <Button 
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{ 
                            color: '#888',
                            '&:hover': {
                                color: 'white',
                                bgcolor: 'rgba(255,255,255,0.1)'
                            }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleRemoveInstance}
                        variant="contained"
                        color="error"
                        disableElevation
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Instances
