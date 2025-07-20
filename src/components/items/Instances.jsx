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
    DialogContentText,
    Tooltip
} from "@mui/material"
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import CodeIcon from '@mui/icons-material/Code'
import SubjectIcon from '@mui/icons-material/Subject'
import { useState } from 'react'
import ViewInAr from '@mui/icons-material/ViewInAr'

function Instances({ item }) {
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [newInstanceName, setNewInstanceName] = useState('')
    const [instanceToDelete, setInstanceToDelete] = useState(null)
    const [error, setError] = useState('')

    // Get all instances from the item
    const instances = Object.entries(item?.instances || {}).map(([index, instance]) => ({
        ...instance,
        index
    }))

    const handleEditInstance = async (packagePath, instancePath) => {
        try {
            await window.package.editInstance({ packagePath, instanceName: instancePath, itemId: item.id })
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

            {instances.length > 0 ? (
                <Stack spacing={2}>
                    {instances.map((instance) => {
                        const isVBSP = instance.source === 'vbsp'
                        const instanceNumber = instance?.Name?.match?.(/(\d+)\.vmf$/)?.[1] || '?'

                        return (
                            <Paper key={instance.Name || 'unknown'} variant="outlined" sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle1" sx={{ mr: 1, minWidth: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Tooltip title={isVBSP ? "VBSP Instance" : "Editor Instance"}>
                                            {isVBSP ? <CodeIcon fontSize="small" /> : <SubjectIcon fontSize="small" />}
                                        </Tooltip>
                                        Instance {instanceNumber}:
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ 
                                            fontFamily: 'monospace',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                            direction: 'rtl',  // Make text overflow from the left
                                            textAlign: 'left'  // Keep text aligned normally
                                        }}
                                    >
                                        {instance.Name || '(unnamed instance)'}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleEditInstance(item.packagePath, instance.Name)}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <Tooltip title={isVBSP ? "VBSP instances cannot be deleted - To remove them, remove them in the VBSP tab." : "Delete instance"}>
                                        <span>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                disabled={isVBSP}
                                                onClick={() => {
                                                    setInstanceToDelete(instance.index)
                                                    setDeleteDialogOpen(true)
                                                }}
                                                sx={isVBSP ? {
                                                    opacity: 0.5,
                                                    '&.Mui-disabled': {
                                                        color: 'error.main'
                                                    }
                                                } : undefined}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Box>
                            </Paper>
                        )
                    })}
                </Stack>
            ) : (
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: 2,
                    p: 4,
                    textAlign: 'center'
                }}>
                    <ViewInAr sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
                    <Typography variant="h6" color="text.secondary">
                        No Instances Yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Add your first instance to this item using the button above
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setAddDialogOpen(true)}
                    >
                        Add First Instance
                    </Button>
                </Box>
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
                <DialogTitle>Delete Instance?</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: 'text.secondary' }}>
                        Are you sure you want to delete this instance? This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleRemoveInstance} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Instances
