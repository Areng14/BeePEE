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
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import CodeIcon from '@mui/icons-material/Code'
import SubjectIcon from '@mui/icons-material/Subject'
import { useState, useEffect } from 'react'
import ViewInAr from '@mui/icons-material/ViewInAr'

function Instances({ item, onInstancesChanged }) {
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [newInstanceName, setNewInstanceName] = useState('')
    const [instanceToDelete, setInstanceToDelete] = useState(null)
    const [error, setError] = useState('')
    const [instances, setInstances] = useState([])
    const [itemId, setItemId] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    // Force refresh function
    const forceRefresh = () => {
        console.log('Force refreshing instances component')
        setRefreshKey(prev => prev + 1)
    }

    useEffect(() => {
        console.log('=== Instances useEffect triggered ===')
        console.log('Current item prop:', item)
        console.log('Current item instances:', item?.instances)
        console.log('Current local instances state:', instances)
        console.log('Current local itemId state:', itemId)
        console.log('Refresh key:', refreshKey)
        
        // Update local state when item changes
        if (item?.instances) {
            const instancesArray = Object.entries(item.instances).map(([index, instance]) => ({
                ...instance,
                index
            }))
            console.log('New instances array to set:', instancesArray)
            console.log('Updating instances state to:', instancesArray)
            setInstances(instancesArray)
            setItemId(item.id)
        } else {
            console.log('Clearing instances state (no instances found)')
            setInstances([])
            setItemId('')
        }
        console.log('=== End useEffect ===')
    }, [item, item?.instances, item?.id, refreshKey])

    // Additional useEffect with stringified dependency to catch any changes
    useEffect(() => {
        console.log('=== JSON stringify useEffect triggered ===')
        if (item?.instances) {
            const instancesArray = Object.entries(item.instances).map(([index, instance]) => ({
                ...instance,
                index
            }))
            console.log('Setting instances from JSON stringify effect:', instancesArray)
            setInstances(instancesArray)
        }
    }, [JSON.stringify(item?.instances)])

    useEffect(() => {
        console.log('Instances state changed:', instances)
    }, [instances])

    const handleEditInstance = async (packagePath, instancePath) => {
        try {
            await window.package.editInstance({ packagePath, instanceName: instancePath, itemId: itemId })
        } catch (error) {
            console.error("Failed to edit instance:", error)
        }
    }

    const handleAddInstanceWithFileDialog = async () => {
        try {
            const result = await window.package.addInstanceFileDialog(itemId)
            if (result.success) {
                console.log(`Added instance: ${result.instanceName}`)
                // Force refresh to ensure UI updates
                setTimeout(() => forceRefresh(), 100)
                if (onInstancesChanged) onInstancesChanged();
            } else if (!result.canceled) {
                console.error("Failed to add instance:", result.error)
            }
        } catch (error) {
            console.error("Failed to add instance:", error)
        }
    }

    const handleAddInstance = async () => {
        if (!newInstanceName) {
            setError('Instance name is required')
            return
        }
        try {
            await window.package.addInstance(itemId, newInstanceName)
            setAddDialogOpen(false)
            setNewInstanceName('')
            setError('')
            // Force refresh to ensure UI updates
            setTimeout(() => forceRefresh(), 100)
            if (onInstancesChanged) onInstancesChanged();
        } catch (error) {
            console.error("Failed to add instance:", error)
        }
    }

    const handleReplaceInstance = async (instanceIndex) => {
        try {
            const result = await window.package.replaceInstanceFileDialog(itemId, instanceIndex)
            if (result.success) {
                console.log(`Replaced instance: ${result.instanceName}`)
                // Force refresh to ensure UI updates
                setTimeout(() => forceRefresh(), 100)
                if (onInstancesChanged) onInstancesChanged();
            } else if (!result.canceled) {
                console.error("Failed to replace instance:", result.error)
            }
        } catch (error) {
            console.error("Failed to replace instance:", error)
        }
    }

    const handleRemoveInstance = async () => {
        if (instanceToDelete === null) return
        try {
            await window.package.removeInstance(itemId, instanceToDelete)
            setDeleteDialogOpen(false)
            setInstanceToDelete(null)
            // Force refresh to ensure UI updates
            setTimeout(() => forceRefresh(), 100)
            if (onInstancesChanged) onInstancesChanged();
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
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Select a VMF file to add as a new instance">
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleAddInstanceWithFileDialog}
                        >
                            Add VMF Instance
                        </Button>
                    </Tooltip>
                    <Tooltip title="Add instance by typing path manually (advanced)">
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => setAddDialogOpen(true)}
                            size="small"
                        >
                            Manual
                        </Button>
                    </Tooltip>
                    <Tooltip title="Debug: Force refresh instances display">
                        <Button
                            variant="outlined"
                            onClick={forceRefresh}
                            size="small"
                            color="warning"
                        >
                            🔄 Debug Refresh
                        </Button>
                    </Tooltip>
                </Box>
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
                                    
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Tooltip title="Edit this instance file in Hammer">
                                            <IconButton 
                                                size="small" 
                                                onClick={() => handleEditInstance(item.packagePath, instance.Name)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        
                                        {!isVBSP && (
                                            <Tooltip title="Replace this instance file with a different VMF file">
                                                <IconButton 
                                                    size="small" 
                                                    onClick={() => handleReplaceInstance(instance.index)}
                                                    color="warning"
                                                >
                                                    <SwapHorizIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        
                                        {!isVBSP && (
                                            <Tooltip title="Delete this instance permanently">
                                                <IconButton 
                                                    size="small" 
                                                    color="error"
                                                    onClick={() => {
                                                        setInstanceToDelete(instance.index)
                                                        setDeleteDialogOpen(true)
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
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
                        onClick={handleAddInstanceWithFileDialog}
                    >
                        Add First VMF Instance
                    </Button>
                </Box>
            )}

            {/* Manual Add Instance Dialog */}
            <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
                <DialogTitle>Add Instance Manually</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Enter the path to the instance file (relative to resources folder).
                        <br />
                        <strong>Tip:</strong> Use "Add VMF Instance" button for easier file selection.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Instance Path"
                        placeholder="instances/my_instance.vmf"
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
                    <DialogContentText sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Are you sure you want to delete this instance? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleRemoveInstance} 
                        color="error" 
                        variant="contained"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Instances
