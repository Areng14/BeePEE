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

function InputOutputConfigDialog({ open, onClose, onSave, config, title, isEdit = false, itemId }) {
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
    const [entities, setEntities] = useState({})
    const [fgdData, setFgdData] = useState({})
    const [loading, setLoading] = useState(false)

    // Command builder state
    const [enableEntity, setEnableEntity] = useState('')
    const [enableInput, setEnableInput] = useState('')
    const [disableEntity, setDisableEntity] = useState('')
    const [disableInput, setDisableInput] = useState('')
    
    // Secondary command builder state (for dual inputs)
    const [secEnableEntity, setSecEnableEntity] = useState('')
    const [secEnableInput, setSecEnableInput] = useState('')
    const [secDisableEntity, setSecDisableEntity] = useState('')
    const [secDisableInput, setSecDisableInput] = useState('')

    // Output command builder state
    const [activateEntity, setActivateEntity] = useState('')
    const [activateOutput, setActivateOutput] = useState('')
    const [deactivateEntity, setDeactivateEntity] = useState('')
    const [deactivateOutput, setDeactivateOutput] = useState('')

    useEffect(() => {
        if (open && itemId) {
            loadEntityData()
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
            parseExistingCommands()
            setError('')
        }
    }, [open, config, itemId])

    const loadEntityData = async () => {
        setLoading(true)
        try {
            const [entitiesResult, fgdResult] = await Promise.all([
                window.package.getItemEntities(itemId),
                window.package.getFgdData()
            ])
            
            if (entitiesResult.success) {
                setEntities(entitiesResult.entities)
            }
            
            if (fgdResult.success) {
                setFgdData(fgdResult.entities)
            }
        } catch (error) {
            console.error('Failed to load entity data:', error)
        } finally {
            setLoading(false)
        }
    }

    const parseExistingCommands = () => {
        // Parse existing command strings back into dropdown selections
        if (config.Enable_cmd) {
            const parts = config.Enable_cmd.split(',')
            if (parts.length >= 2) {
                setEnableEntity(parts[0])
                setEnableInput(parts[1])
            }
        }
        if (config.Disable_cmd) {
            const parts = config.Disable_cmd.split(',')
            if (parts.length >= 2) {
                setDisableEntity(parts[0])
                setDisableInput(parts[1])
            }
        }
        // Similar parsing for other command types...
    }

    const buildCommand = (entity, inputOutput) => {
        if (!entity || !inputOutput) return ''
        return `${entity},${inputOutput},,0,-1`
    }

    const buildOutputCommand = (entity, outputName) => {
        if (!entity || !outputName) return ''
        return `instance:${entity};${outputName}`
    }

    // Update form data when selections change
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            Enable_cmd: buildCommand(enableEntity, enableInput),
            Disable_cmd: buildCommand(disableEntity, disableInput),
            Sec_Enable_cmd: buildCommand(secEnableEntity, secEnableInput),
            Sec_Disable_cmd: buildCommand(secDisableEntity, secDisableInput),
            Out_Activate: buildOutputCommand(activateEntity, activateOutput),
            Out_Deactivate: buildOutputCommand(deactivateEntity, deactivateOutput)
        }))
    }, [enableEntity, enableInput, disableEntity, disableInput, secEnableEntity, secEnableInput, secDisableEntity, secDisableInput, activateEntity, activateOutput, deactivateEntity, deactivateOutput])

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

    const entityOptions = Object.keys(entities).map(entityName => ({
        value: entityName,
        label: `${entityName} (${entities[entityName]})`
    }))
    
    const getAvailableInputsForEntity = (entityName) => {
        const entityClass = entities[entityName]
        const fgdEntity = fgdData[entityClass]
        return fgdEntity?.inputs || []
    }

    const getAvailableOutputsForEntity = (entityName) => {
        const entityClass = entities[entityName]
        const fgdEntity = fgdData[entityClass]
        return fgdEntity?.outputs || []
    }

    if (loading) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography>Loading entity data...</Typography>
                </DialogContent>
            </Dialog>
        )
    }

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
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                        <TextField
                                            select
                                            label="Enable Entity"
                                            value={enableEntity}
                                            onChange={(e) => setEnableEntity(e.target.value)}
                                            helperText="Entity to send enable signal to"
                                        >
                                            {entityOptions.length === 0 ? (
                                                <MenuItem disabled>
                                                    No entities found in instances
                                                </MenuItem>
                                            ) : (
                                                entityOptions.map((option) => (
                                                    <MenuItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </MenuItem>
                                                ))
                                            )}
                                        </TextField>

                                        <TextField
                                            select
                                            label="Enable Input"
                                            value={enableInput}
                                            onChange={(e) => setEnableInput(e.target.value)}
                                            disabled={!enableEntity}
                                            helperText="Input to trigger on entity"
                                        >
                                            {getAvailableInputsForEntity(enableEntity).map((input) => (
                                                <MenuItem key={input} value={input}>
                                                    {input}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Box>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                        <TextField
                                            select
                                            label="Disable Entity"
                                            value={disableEntity}
                                            onChange={(e) => setDisableEntity(e.target.value)}
                                            helperText="Entity to send disable signal to"
                                        >
                                            {entityOptions.length === 0 ? (
                                                <MenuItem disabled>
                                                    No entities found in instances
                                                </MenuItem>
                                            ) : (
                                                entityOptions.map((option) => (
                                                    <MenuItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </MenuItem>
                                                ))
                                            )}
                                        </TextField>

                                        <TextField
                                            select
                                            label="Disable Input"
                                            value={disableInput}
                                            onChange={(e) => setDisableInput(e.target.value)}
                                            disabled={!disableEntity}
                                            helperText="Input to trigger on entity"
                                        >
                                            {getAvailableInputsForEntity(disableEntity).map((input) => (
                                                <MenuItem key={input} value={input}>
                                                    {input}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Box>

                                    {/* Show the built commands as preview */}
                                    {(formData.Enable_cmd || formData.Disable_cmd) && (
                                        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Generated Commands:
                                            </Typography>
                                            {formData.Enable_cmd && (
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                    Enable: {formData.Enable_cmd}
                                                </Typography>
                                            )}
                                            {formData.Disable_cmd && (
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                    Disable: {formData.Disable_cmd}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Stack>
                            </Box>

                            {isDualInput && (
                                <Box>
                                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                                        Secondary Input Commands (Channel B)
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                            <TextField
                                                select
                                                label="Enable Entity (B)"
                                                value={secEnableEntity}
                                                onChange={(e) => setSecEnableEntity(e.target.value)}
                                                helperText="Entity for secondary enable"
                                            >
                                                {entityOptions.length === 0 ? (
                                                    <MenuItem disabled>
                                                        No entities found in instances
                                                    </MenuItem>
                                                ) : (
                                                    entityOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))
                                                )}
                                            </TextField>

                                            <TextField
                                                select
                                                label="Enable Input (B)"
                                                value={secEnableInput}
                                                onChange={(e) => setSecEnableInput(e.target.value)}
                                                disabled={!secEnableEntity}
                                                helperText="Secondary enable input"
                                            >
                                                {getAvailableInputsForEntity(secEnableEntity).map((input) => (
                                                    <MenuItem key={input} value={input}>
                                                        {input}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        </Box>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                            <TextField
                                                select
                                                label="Disable Entity (B)"
                                                value={secDisableEntity}
                                                onChange={(e) => setSecDisableEntity(e.target.value)}
                                                helperText="Entity for secondary disable"
                                            >
                                                {entityOptions.length === 0 ? (
                                                    <MenuItem disabled>
                                                        No entities found in instances
                                                    </MenuItem>
                                                ) : (
                                                    entityOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))
                                                )}
                                            </TextField>

                                            <TextField
                                                select
                                                label="Disable Input (B)"
                                                value={secDisableInput}
                                                onChange={(e) => setSecDisableInput(e.target.value)}
                                                disabled={!secDisableEntity}
                                                helperText="Secondary disable input"
                                            >
                                                {getAvailableInputsForEntity(secDisableEntity).map((input) => (
                                                    <MenuItem key={input} value={input}>
                                                        {input}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        </Box>

                                        {/* Show secondary commands preview */}
                                        {(formData.Sec_Enable_cmd || formData.Sec_Disable_cmd) && (
                                            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Generated Secondary Commands:
                                                </Typography>
                                                {formData.Sec_Enable_cmd && (
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                        Enable (B): {formData.Sec_Enable_cmd}
                                                    </Typography>
                                                )}
                                                {formData.Sec_Disable_cmd && (
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                        Disable (B): {formData.Sec_Disable_cmd}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
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
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                    <TextField
                                        select
                                        label="Activate Entity"
                                        value={activateEntity}
                                        onChange={(e) => setActivateEntity(e.target.value)}
                                        helperText="Entity that sends activate signal"
                                    >
                                        {entityOptions.length === 0 ? (
                                            <MenuItem disabled>
                                                No entities found in instances
                                            </MenuItem>
                                        ) : (
                                            entityOptions.map((option) => (
                                                <MenuItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </MenuItem>
                                            ))
                                        )}
                                    </TextField>

                                    <TextField
                                        select
                                        label="Activate Output"
                                        value={activateOutput}
                                        onChange={(e) => setActivateOutput(e.target.value)}
                                        disabled={!activateEntity}
                                        helperText="Output to fire from entity"
                                    >
                                        {getAvailableOutputsForEntity(activateEntity).map((output) => (
                                            <MenuItem key={output} value={output}>
                                                {output}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Box>

                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                    <TextField
                                        select
                                        label="Deactivate Entity"
                                        value={deactivateEntity}
                                        onChange={(e) => setDeactivateEntity(e.target.value)}
                                        helperText="Entity that sends deactivate signal"
                                    >
                                        {entityOptions.length === 0 ? (
                                            <MenuItem disabled>
                                                No entities found in instances
                                            </MenuItem>
                                        ) : (
                                            entityOptions.map((option) => (
                                                <MenuItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </MenuItem>
                                            ))
                                        )}
                                    </TextField>

                                    <TextField
                                        select
                                        label="Deactivate Output"
                                        value={deactivateOutput}
                                        onChange={(e) => setDeactivateOutput(e.target.value)}
                                        disabled={!deactivateEntity}
                                        helperText="Output to fire from entity"
                                    >
                                        {getAvailableOutputsForEntity(deactivateEntity).map((output) => (
                                            <MenuItem key={output} value={output}>
                                                {output}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Box>

                                {/* Show output commands preview */}
                                {(formData.Out_Activate || formData.Out_Deactivate) && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Generated Output Commands:
                                        </Typography>
                                        {formData.Out_Activate && (
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                Activate: {formData.Out_Activate}
                                            </Typography>
                                        )}
                                        {formData.Out_Deactivate && (
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                Deactivate: {formData.Out_Deactivate}
                                            </Typography>
                                        )}
                                    </Box>
                                )}
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
                    <Tooltip title={`Edit the ${type} configuration - modify commands and settings`}>
                        <IconButton size="small" onClick={() => openEditDialog(name, config, type)}>
                            <Edit fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={`Delete this ${type} configuration permanently`}>
                        <IconButton size="small" color="error" onClick={() => openDeleteDialog(name, type)}>
                            <Delete fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            
            <Accordion>
                <Tooltip title="Click to view all the detailed configuration properties and their values">
                    <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="body2" color="text.secondary">
                            View Configuration ({Object.keys(config).length} properties)
                        </Typography>
                    </AccordionSummary>
                </Tooltip>
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
                <Tooltip title={
                    tabValue === 0 
                        ? (hasInput ? 'This item already has an input configured. Items can only have one input.' : 'Add an input configuration to allow this item to receive signals from other items.')
                        : (hasOutput ? 'This item already has an output configured. Items can only have one output.' : 'Add an output configuration to allow this item to send signals to other items.')
                }>
                    <span>
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
                    </span>
                </Tooltip>
            </Box>

            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
                <Tooltip title="Configure how this item receives signals from other items in the puzzle">
                    <Tab label="Input" />
                </Tooltip>
                <Tooltip title="Configure how this item sends signals to other items in the puzzle">
                    <Tab label="Output" />
                </Tooltip>
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
                itemId={item.id}
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
