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
    Tooltip,
    Chip,
    Tabs,
    Tab,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Divider
} from "@mui/material"
import { 
    Edit, 
    Delete, 
    Add, 
    Input as InputIcon, 
    Output as OutputIcon,
    ExpandMore 
} from "@mui/icons-material"
import { useState, useEffect } from 'react'

const INPUT_TYPES = [
    { value: 'AND', label: 'Simple Input' },
    { value: 'DUAL', label: 'Dual Input (A/B)' },
    { value: 'AND', label: 'AND Logic' },
    { value: 'OR', label: 'OR Logic' }
]

function InputOutputConfigDialog({ open, onClose, onSave, config, title, isEdit = false }) {
    const [formData, setFormData] = useState({
        Type: 'AND',
        Enable_cmd: '',
        Disable_cmd: '',
        // Dual input fields
        Sec_Enable_cmd: '',
        Sec_Disable_cmd: '',
        // Output fields
        Out_Activate: '',
        Out_Deactivate: '',
        ...config
    })
    const [error, setError] = useState('')

    useEffect(() => {
        if (open) {
            setFormData({
                Type: 'AND',
                Enable_cmd: '',
                Disable_cmd: '',
                // Dual input fields
                Sec_Enable_cmd: '',
                Sec_Disable_cmd: '',
                // Output fields
                Out_Activate: '',
                Out_Deactivate: '',
                ...config
            })
            setError('')
        }
    }, [open, config])

    const handleSave = () => {
        // Filter out empty fields
        const cleanedData = Object.fromEntries(
            Object.entries(formData).filter(([key, value]) => value.trim() !== '')
        )

        if (Object.keys(cleanedData).length === 0) {
            setError('At least one field must be filled')
            return
        }

        onSave(cleanedData)
        onClose()
    }

    const updateFormData = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const isInput = title.includes('Input')
    const isDualInput = formData.Type === 'DUAL'

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {isInput && (
                        <>
                            <TextField
                                select
                                label="Input Type"
                                value={formData.Type}
                                onChange={(e) => updateFormData('Type', e.target.value)}
                                fullWidth
                                helperText="Choose the type of input behavior"
                                sx={{ mb: 2 }}
                            >
                                {INPUT_TYPES.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <Box>
                                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                                    Primary Input Commands
                                </Typography>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Enable Command"
                                        value={formData.Enable_cmd}
                                        onChange={(e) => updateFormData('Enable_cmd', e.target.value)}
                                        fullWidth
                                        placeholder="Activator,FireUser1,,0,-1"
                                        helperText="Command to activate this input"
                                    />
                                    
                                    <TextField
                                        label="Disable Command"
                                        value={formData.Disable_cmd}
                                        onChange={(e) => updateFormData('Disable_cmd', e.target.value)}
                                        fullWidth
                                        placeholder="Activator,FireUser2,,0,-1"
                                        helperText="Command to deactivate this input"
                                    />
                                </Stack>
                            </Box>

                            {isDualInput && (
                                <Box>
                                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                                        Secondary Input Commands (Channel B)
                                    </Typography>
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Enable Command (B)"
                                            value={formData.Sec_Enable_cmd}
                                            onChange={(e) => updateFormData('Sec_Enable_cmd', e.target.value)}
                                            fullWidth
                                            placeholder="Activator,FireUser3,,0,-1"
                                            helperText="Command to activate secondary input"
                                        />
                                        
                                        <TextField
                                            label="Disable Command (B)"
                                            value={formData.Sec_Disable_cmd}
                                            onChange={(e) => updateFormData('Sec_Disable_cmd', e.target.value)}
                                            fullWidth
                                            placeholder="Activator,FireUser4,,0,-1"
                                            helperText="Command to deactivate secondary input"
                                        />
                                    </Stack>
                                </Box>
                            )}
                        </>
                    )}
                    
                    {!isInput && (
                        <Box>
                            <Typography variant="subtitle2" gutterBottom color="text.secondary">
                                Output Commands
                            </Typography>
                            <Stack spacing={2}>
                                <TextField
                                    label="Activate Output"
                                    value={formData.Out_Activate}
                                    onChange={(e) => updateFormData('Out_Activate', e.target.value)}
                                    fullWidth
                                    placeholder="instance:btn;OnPressed"
                                    helperText="Command when this output activates"
                                />
                                
                                <TextField
                                    label="Deactivate Output"
                                    value={formData.Out_Deactivate}
                                    onChange={(e) => updateFormData('Out_Deactivate', e.target.value)}
                                    fullWidth
                                    placeholder="instance:btn;OnUnPressed"
                                    helperText="Command when this output deactivates"
                                />
                            </Stack>
                        </Box>
                    )}
                </Stack>
                
                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">
                    {isEdit ? 'Update' : 'Add'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

function Inputs({ item }) {
    const [inputs, setInputs] = useState({})
    const [outputs, setOutputs] = useState({})
    const [tabValue, setTabValue] = useState(0)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [editingConfig, setEditingConfig] = useState({ name: '', config: {}, type: '' })
    const [deleteItem, setDeleteItem] = useState({ name: '', type: '' })
    const [error, setError] = useState('')

    // Load inputs and outputs when component mounts or item changes
    useEffect(() => {
        if (item) {
            loadInputsAndOutputs()
        }
    }, [item])

    const loadInputsAndOutputs = async () => {
        try {
            const [inputResult, outputResult] = await Promise.all([
                window.package.getInputs(item.id),
                window.package.getOutputs(item.id)
            ])
            
            if (inputResult.success) {
                setInputs(inputResult.inputs)
            }
            if (outputResult.success) {
                setOutputs(outputResult.outputs)
            }
        } catch (error) {
            console.error('Failed to load inputs/outputs:', error)
        }
    }

    const handleAddConfig = async (configData) => {
        try {
            const isInput = tabValue === 0
            const defaultName = isInput ? "Input" : "Output" // Use descriptive names
            const result = isInput 
                ? await window.package.addInput(item.id, defaultName, configData)
                : await window.package.addOutput(item.id, defaultName, configData)
            
            if (result.success) {
                await loadInputsAndOutputs()
                setEditDialogOpen(false)
                setError('')
            }
        } catch (error) {
            setError(error.message)
        }
    }

    const handleEditConfig = async (configData) => {
        try {
            const result = editingConfig.type === 'input'
                ? await window.package.updateInput(item.id, editingConfig.name, configData)
                : await window.package.updateOutput(item.id, editingConfig.name, configData)
            
            if (result.success) {
                await loadInputsAndOutputs()
                setEditDialogOpen(false)
                setEditingConfig({ name: '', config: {}, type: '' })
            }
        } catch (error) {
            console.error('Failed to edit config:', error)
        }
    }

    const handleDeleteConfig = async () => {
        try {
            const result = deleteItem.type === 'input'
                ? await window.package.removeInput(item.id, deleteItem.name)
                : await window.package.removeOutput(item.id, deleteItem.name)
            
            if (result.success) {
                await loadInputsAndOutputs()
                setDeleteDialogOpen(false)
                setDeleteItem({ name: '', type: '' })
            }
        } catch (error) {
            console.error('Failed to delete config:', error)
        }
    }

    const openEditDialog = (name, config, type) => {
        setEditingConfig({ name, config, type })
        setEditDialogOpen(true)
    }

    const openDeleteDialog = (name, type) => {
        setDeleteItem({ name, type })
        setDeleteDialogOpen(true)
    }

    // Check if we already have input/output
    const hasInput = Object.keys(inputs).length > 0
    const hasOutput = Object.keys(outputs).length > 0

    const renderConfigCard = (name, config, type) => (
        <Paper key={`${type}-${name}`} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {type === 'input' ? <InputIcon fontSize="small" /> : <OutputIcon fontSize="small" />}
                    {type === 'input' ? 'INPUT' : 'OUTPUT'}
                </Typography>
                <Box>
                    <Tooltip title={`Edit ${type}`}>
                        <IconButton size="small" onClick={() => openEditDialog(name, config, type)}>
                            <Edit fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={`Delete ${type}`}>
                        <IconButton size="small" color="error" onClick={() => openDeleteDialog(name, type)}>
                            <Delete fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            
            <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="body2" color="text.secondary">
                        View Configuration ({Object.keys(config).length} properties)
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Stack spacing={1}>
                        {Object.entries(config).map(([key, value]) => (
                            <Box key={key} sx={{ display: 'flex', gap: 1 }}>
                                <Chip label={key} size="small" variant="outlined" />
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    {value}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </AccordionDetails>
            </Accordion>
        </Paper>
    )

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                    Inputs & Outputs
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    disabled={tabValue === 0 ? hasInput : hasOutput}
                    onClick={() => {
                        // Skip naming, go straight to config since items can only have one input/output
                        const configName = tabValue === 0 ? "Input" : "Output"
                        setEditingConfig({ name: configName, config: {}, type: tabValue === 0 ? 'input' : 'output' })
                        setEditDialogOpen(true)
                    }}
                >
                    {tabValue === 0 
                        ? (hasInput ? 'Input Already Exists' : 'Add Input')
                        : (hasOutput ? 'Output Already Exists' : 'Add Output')
                    }
                </Button>
            </Box>

            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
                <Tab label="Input" />
                <Tab label="Output" />
            </Tabs>

            <Box sx={{ display: tabValue === 0 ? 'block' : 'none' }}>
                <Stack spacing={2}>
                    {Object.keys(inputs).length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            No input configured. Click "Add Input" to configure the item's input.
                        </Typography>
                    ) : (
                        Object.entries(inputs).map(([name, config]) => 
                            renderConfigCard(name, config, 'input')
                        )
                    )}
                </Stack>
            </Box>

            <Box sx={{ display: tabValue === 1 ? 'block' : 'none' }}>
                <Stack spacing={2}>
                    {Object.keys(outputs).length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            No output configured. Click "Add Output" to configure the item's output.
                        </Typography>
                    ) : (
                        Object.entries(outputs).map(([name, config]) => 
                            renderConfigCard(name, config, 'output')
                        )
                    )}
                </Stack>
            </Box>

            {/* Edit/Add Config Dialog */}
            <InputOutputConfigDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                onSave={editingConfig.config && Object.keys(editingConfig.config).length > 0 ? handleEditConfig : handleAddConfig}
                config={editingConfig.config}
                title={editingConfig.config && Object.keys(editingConfig.config).length > 0
                    ? `Edit ${editingConfig.type === 'input' ? 'Input' : 'Output'}: ${editingConfig.name}`
                    : `Add ${editingConfig.type === 'input' ? 'Input' : 'Output'}`
                }
                isEdit={editingConfig.config && Object.keys(editingConfig.config).length > 0}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete {deleteItem.type === 'input' ? 'Input' : 'Output'}?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete the item's {deleteItem.type}? This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteConfig} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default Inputs
