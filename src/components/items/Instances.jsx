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
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [instanceToDelete, setInstanceToDelete] = useState(null)
    const [isRemovingMissing, setIsRemovingMissing] = useState(false)

    // Convert item instances to array format for rendering
    const instances = item?.instances ? Object.entries(item.instances).map(([index, instance]) => ({
        ...instance,
        index
    })) : []

    // Debug effect to log when instances change
    useEffect(() => {
        console.log('Instances component: Item or instances changed:', {
            itemId: item?.id,
            instanceCount: instances.length,
            instanceNames: instances.map(i => i.Name),
            instanceExists: instances.map(i => ({ name: i.Name, exists: i.exists }))
        })
    }, [item, instances])

    const handleEditInstance = async (packagePath, instancePath) => {
        try {
            await window.package.editInstance({ packagePath, instanceName: instancePath, itemId: item.id })
        } catch (error) {
            console.error("Failed to edit instance:", error)
        }
    }

    const handleAddInstanceWithFileDialog = async () => {
        console.log('Instances: Adding instance with file dialog for item:', item.id)
        try {
            const result = await window.package.addInstanceFileDialog(item.id)
            console.log('Instances: File dialog result:', result)
            if (result.success) {
                console.log(`Instances: Added instance: ${result.instanceName}`)
                console.log('Instances: Current item instances before callback:', item?.instances)
                // Backend will automatically send item-updated event
                if (onInstancesChanged) {
                    console.log('Instances: Calling onInstancesChanged callback')
                    onInstancesChanged();
                }
            } else if (!result.canceled) {
                console.error("Instances: Failed to add instance:", result.error)
            }
        } catch (error) {
            console.error("Instances: Failed to add instance:", error)
        }
    }



    const handleReplaceInstance = async (instanceIndex) => {
        console.log('Instances: Replacing instance at index:', instanceIndex, 'for item:', item.id)
        try {
            const result = await window.package.replaceInstanceFileDialog(item.id, instanceIndex)
            if (result.success) {
                console.log(`Instances: Replaced instance: ${result.instanceName}`)
                // Backend will automatically send item-updated event
                if (onInstancesChanged) onInstancesChanged();
            } else if (!result.canceled) {
                console.error("Instances: Failed to replace instance:", result.error)
            }
        } catch (error) {
            console.error("Instances: Failed to replace instance:", error)
        }
    }

    const handleRemoveInstance = async () => {
        if (instanceToDelete === null) return
        console.log('Instances: Removing instance at index:', instanceToDelete, 'for item:', item.id)
        try {
            await window.package.removeInstance(item.id, instanceToDelete)
            setDeleteDialogOpen(false)
            setInstanceToDelete(null)
            // Backend will automatically send item-updated event
            if (onInstancesChanged) onInstancesChanged();
        } catch (error) {
            console.error("Instances: Failed to remove instance:", error)
        }
    }

    const handleRemoveAllMissingInstances = async () => {
        const missingInstances = instances.filter(instance => !instance.exists && instance.source !== 'vbsp')
        if (missingInstances.length === 0) return
        
        setIsRemovingMissing(true)
        console.log('Instances: Removing all missing instances (excluding VBSP):', missingInstances.length, 'for item:', item.id)
        try {
            // Remove instances in reverse order to avoid index shifting issues
            const sortedInstances = missingInstances.sort((a, b) => parseInt(b.index) - parseInt(a.index))
            
            for (const instance of sortedInstances) {
                await window.package.removeInstance(item.id, instance.index)
            }
            
            // Backend will automatically send item-updated event
            if (onInstancesChanged) onInstancesChanged();
        } catch (error) {
            console.error("Instances: Failed to remove all missing instances:", error)
            setIsRemovingMissing(false) // Reset on error so user can try again
        }
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Instance Files ({instances.length})
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
                    {instances.some(instance => !instance.exists && instance.source !== 'vbsp') && !isRemovingMissing && (
                        <Tooltip title="Remove all instances with missing files (excluding VBSP instances)">
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={handleRemoveAllMissingInstances}
                                size="small"
                            >
                                Remove Missing
                            </Button>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {instances.length > 0 ? (
                <Stack spacing={2}>
                                         {instances.map((instance, arrayIndex) => {
                         const isVBSP = instance.source === 'vbsp'
                         const instanceExists = instance.exists !== false // Default to true if not specified
                         const isDisabled = !instanceExists
                         // Use the array index for sequential numbering instead of trying to parse from filename
                         const instanceNumber = arrayIndex

                         return (
                             <Paper 
                                 key={instance.Name || 'unknown'} 
                                 variant="outlined" 
                                 sx={{ 
                                     p: 2,
                                     backgroundColor: isDisabled ? 'rgba(0, 0, 0, 0.3)' : 'background.paper',
                                     borderColor: isDisabled ? 'error.main' : 'divider',
                                     borderWidth: isDisabled ? 1 : 1,
                                     opacity: isDisabled ? 0.8 : 1
                                 }}
                             >
                                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                          <Typography variant="subtitle1" sx={{ mr: 1, minWidth: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                                         <Tooltip title={isDisabled ? "Missing File" : (isVBSP ? "VBSP Instance" : "Editor Instance")}>
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
                                                                                 <Tooltip title={isDisabled ? "Cannot edit - file is missing" : "Edit this instance file in Hammer"}>
                                             <span> {/* Wrapper needed for disabled IconButton */}
                                                 <IconButton 
                                                     size="small" 
                                                     onClick={() => handleEditInstance(item.packagePath, instance.Name)}
                                                     disabled={isDisabled}
                                                 >
                                                     <EditIcon fontSize="small" />
                                                 </IconButton>
                                             </span>
                                         </Tooltip>
                                        
                                                                                 {!isVBSP && (
                                             <Tooltip title={isDisabled ? "Replace missing file with a VMF file" : "Replace this instance file with a different VMF file"}>
                                                 <IconButton 
                                                     size="small" 
                                                     onClick={() => handleReplaceInstance(instance.index)}
                                                     color={isDisabled ? "primary" : "warning"}
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
