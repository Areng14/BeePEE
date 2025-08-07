import { useEffect, useState } from "react"
import {
    Box,
    Tabs,
    Tab,
    Button,
    Stack,
    Alert,
    Tooltip,
    Badge,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    CircularProgress,
    IconButton,
} from "@mui/material"
import {
    Info,
    Input,
    ViewInAr,
    Code,
    Save,
    Close,
    Construction,
    CheckCircle,
    Description,
    Undo,
    Redo,
    Functions,
    DataObject,
    Rule,
} from "@mui/icons-material"
import BasicInfo from "./items/BasicInfo"
import Inputs from "./items/Inputs"
import Instances from "./items/Instances"
import Variables from "./items/Variables"
import Conditions from "./items/Conditions"
import Other from "./items/Other"
import Metadata from "./items/Metadata"
import { useItemContext } from "../contexts/ItemContext"

function ItemEditor() {
    const { item, reloadItem } = useItemContext()
    const [tabValue, setTabValue] = useState(0)
    const [saveError, setSaveError] = useState(null)
    const [showSaveSuccess, setShowSaveSuccess] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
    
    // Undo/Redo system
    const [undoStack, setUndoStack] = useState([])
    const [redoStack, setRedoStack] = useState([])
    const [isUndoRedoAction, setIsUndoRedoAction] = useState(false)
    const [editingNames, setEditingNames] = useState({})
    
    // Create a snapshot of current form data for undo/redo
    const createSnapshot = (action, description) => {
        return {
            action,
            description,
            timestamp: Date.now(),
            formData: JSON.parse(JSON.stringify(formData)) // Deep clone
        }
    }
    
    // Add action to undo stack
    const addToUndoStack = (action, description) => {
        if (isUndoRedoAction) return // Don't track undo/redo actions themselves
        
        const snapshot = createSnapshot(action, description)
        setUndoStack(prev => [...prev, snapshot].slice(-50)) // Keep last 50 actions
        setRedoStack([]) // Clear redo stack when new action is performed
    }
    
    // Undo function
    const performUndo = () => {
        if (undoStack.length === 0) return
        
        const currentSnapshot = createSnapshot('current', 'Current state')
        const previousSnapshot = undoStack[undoStack.length - 1]
        
        setIsUndoRedoAction(true)
        setFormData(previousSnapshot.formData)
        setUndoStack(prev => prev.slice(0, -1))
        setRedoStack(prev => [...prev, currentSnapshot])
        
        console.log(`Undid: ${previousSnapshot.description}`)
        setTimeout(() => setIsUndoRedoAction(false), 100)
    }
    
    // Redo function
    const performRedo = () => {
        if (redoStack.length === 0) return
        
        const currentSnapshot = createSnapshot('current', 'Current state')
        const nextSnapshot = redoStack[redoStack.length - 1]
        
        setIsUndoRedoAction(true)
        setFormData(nextSnapshot.formData)
        setRedoStack(prev => prev.slice(0, -1))
        setUndoStack(prev => [...prev, currentSnapshot])
        
        console.log(`Redid: ${nextSnapshot.description}`)
        setTimeout(() => setIsUndoRedoAction(false), 100)
    }
    
    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.ctrlKey || event.metaKey) {
                if (event.key === 'z' && !event.shiftKey) {
                    event.preventDefault()
                    performUndo()
                } else if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
                    event.preventDefault()
                    performRedo()
                }
            }
        }
        
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [undoStack, redoStack])

    // Form state for all tabs
    const [formData, setFormData] = useState({
        name: "",
        author: "",
        description: "",
        // Icon staging
        stagedIconPath: null,
        stagedIconName: null,
        iconChanged: false,
        // Inputs and Outputs data
        inputs: {},
        outputs: {},
        // Instances data
        instances: {},
        // Variables and Conditions data
        variables: {},
        conditions: {},
        // Other tab data
        other: {},
        // Track what has been modified
        _modified: {
            basicInfo: false,
            inputs: false,
            outputs: false,
            instances: false,
            variables: false,
            conditions: false,
            other: false,
        },
    })

    useEffect(() => {
        // Initialize form data when item changes
        if (item) {
            document.title = `Edit ${item.name}`

            // Initialize form data with loaded item
            const desc = item.details?.Description
            let description = ""

            if (desc && typeof desc === "object") {
                const descValues = Object.keys(desc)
                    .filter((key) => key.startsWith("desc_"))
                    .sort()
                    .map((key) => desc[key])
                    .filter((value) => value && value.trim() !== "")
                    .join("\n")
                    .trim()
                description = descValues
            } else {
                description = desc || ""
            }

            // Load inputs, outputs, variables, and conditions
            const loadData = async () => {
                try {
                    const [inputResult, outputResult, variablesResult, conditionsResult] = await Promise.all([
                        window.package.getInputs(item.id),
                        window.package.getOutputs(item.id),
                        window.package.getVariables(item.id),
                        window.package.getConditions(item.id),
                    ])

                    setFormData((prev) => ({
                        ...prev,
                        name: item.name || "",
                        author: item.details?.Authors || "",
                        description: description,
                        inputs: inputResult.success ? inputResult.inputs : {},
                        outputs: outputResult.success
                            ? outputResult.outputs
                            : {},
                        // Update instances from item data, but preserve local modifications
                        instances: prev._modified.instances
                            ? prev.instances
                            : item.instances || {},
                        variables: variablesResult.success ? variablesResult.variables : {},
                        conditions: conditionsResult.success ? conditionsResult.conditions : {},
                        other: item.other || {},
                        _modified: {
                            basicInfo: false,
                            inputs: false,
                            outputs: false,
                            // Keep instances modified flag if it was already set
                            instances: prev._modified.instances,
                            variables: false,
                            conditions: false,
                            other: false,
                        },
                    }))
                } catch (error) {
                    console.error("Failed to load data:", error)
                    setFormData((prev) => ({
                        ...prev,
                        name: item.name || "",
                        author: item.details?.Authors || "",
                        description: description,
                        inputs: {},
                        outputs: {},
                        // Update instances from item data, but preserve local modifications
                        instances: prev._modified.instances
                            ? prev.instances
                            : item.instances || {},
                        variables: {},
                        conditions: {},
                        other: item.other || {},
                        _modified: {
                            basicInfo: false,
                            inputs: false,
                            outputs: false,
                            // Keep instances modified flag if it was already set
                            instances: prev._modified.instances,
                            variables: false,
                            conditions: false,
                            other: false,
                        },
                    }))
                }
            }

            loadData()

            // Clear unsaved changes indicator when loading a new item
            window.package?.setUnsavedChanges?.(false)
        }
    }, [item])

    useEffect(() => {
        // Notify backend that editor is ready
        window.package?.editorReady?.()

        // Add class to body to hide scrollbars for ItemEditor
        document.body.classList.add("item-editor-active")

        // Cleanup: remove class when component unmounts
        return () => {
            document.body.classList.remove("item-editor-active")
        }
    }, [])

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    const updateFormData = (field, value, section = "basicInfo") => {
        // Add to undo stack before making changes
        addToUndoStack(section, `Change ${field}`)
        
        setFormData((prev) => {
            const newData = {
                ...prev,
                [field]: value,
                _modified: {
                    ...prev._modified,
                    [section]: true,
                },
            }

            // Check if any section has changes
            const hasChanges = Object.values(newData._modified).some(
                (modified) => modified,
            )

            // Update window title with unsaved changes indicator
            window.package?.setUnsavedChanges?.(hasChanges)

            return newData
        })
    }

    // Specialized update functions for different sections
    const updateInputsData = (inputs) => {
        // Add to undo stack before making changes
        addToUndoStack('inputs', 'Update inputs')
        
        setFormData((prev) => ({
            ...prev,
            inputs,
            _modified: {
                ...prev._modified,
                inputs: true,
            },
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateOutputsData = (outputs) => {
        // Add to undo stack before making changes
        addToUndoStack('outputs', 'Update outputs')
        
        setFormData((prev) => ({
            ...prev,
            outputs,
            _modified: {
                ...prev._modified,
                outputs: true,
            },
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateInstancesData = (instances) => {
        // Add to undo stack before making changes
        addToUndoStack('instances', 'Update instances')
        
        setFormData((prev) => ({
            ...prev,
            instances,
            _modified: {
                ...prev._modified,
                instances: true,
            },
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateVariablesData = (variables) => {
        // Add to undo stack before making changes
        addToUndoStack('variables', 'Update Variables')
        
        setFormData((prev) => ({
            ...prev,
            variables,
            _modified: {
                ...prev._modified,
                variables: true,
            },
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateConditionsData = (blocks) => {
        // Add to undo stack before making changes
        addToUndoStack('conditions', 'Update Conditions')
        
        setFormData((prev) => ({
            ...prev,
            blocks, // Store as blocks format
            _modified: {
                ...prev._modified,
                conditions: true,
            },
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const importConditionsData = (blocks) => {
        // Import conditions without marking as modified (for VBSP conversion)
        setFormData((prev) => ({
            ...prev,
            blocks, // Store as blocks instead of conditions
        }))
        // Don't mark as modified or add to undo stack since this is just a format conversion
    }

    const updateOtherData = (other) => {
        // Add to undo stack before making changes
        addToUndoStack('other', 'Update other data')
        
        setFormData((prev) => ({
            ...prev,
            other,
            _modified: {
                ...prev._modified,
                other: true,
            },
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const handleSave = async () => {
        try {
            setIsSaving(true)
            setSaveError(null)

            // Validate required fields
            if (!formData.name?.trim()) {
                throw new Error("Item name cannot be empty")
            }

            const savePromises = []
            let hasErrors = false

            // Save basic info if modified
            if (formData._modified.basicInfo) {
                const saveData = {
                    id: item.id,
                    name: formData.name,
                    fullItemPath: item.fullItemPath,
                    details: {
                        ...item.details,
                        Authors: formData.author,
                        Description: formData.description,
                    },
                    // Include staged icon data if changed
                    iconData: formData.iconChanged
                        ? {
                              stagedIconPath: formData.stagedIconPath,
                              stagedIconName: formData.stagedIconName,
                          }
                        : null,
                }

                savePromises.push(
                    window.package?.saveItem?.(saveData).catch((error) => {
                        console.error("Failed to save basic info:", error)
                        hasErrors = true
                        throw new Error(`Basic info: ${error.message}`)
                    }),
                )
            }

            // Save inputs if modified - handle add/update/remove operations
            if (formData._modified.inputs) {
                try {
                    // Get original inputs to compare changes
                    const originalInputsResult = await window.package.getInputs(
                        item.id,
                    )
                    const originalInputs = originalInputsResult.success
                        ? originalInputsResult.inputs
                        : {}

                    // Find inputs to add, update, or remove
                    const currentInputs = formData.inputs || {}

                    // Remove inputs that are in original but not in current
                    for (const inputName of Object.keys(originalInputs)) {
                        if (!(inputName in currentInputs)) {
                            await window.package.removeInput(item.id, inputName)
                        }
                    }

                    // Add or update inputs
                    for (const [inputName, inputConfig] of Object.entries(
                        currentInputs,
                    )) {
                        if (inputName in originalInputs) {
                            // Update existing input
                            await window.package.updateInput(
                                item.id,
                                inputName,
                                inputConfig,
                            )
                        } else {
                            // Add new input
                            await window.package.addInput(
                                item.id,
                                inputName,
                                inputConfig,
                            )
                        }
                    }
                } catch (error) {
                    console.error("Failed to save inputs:", error)
                    hasErrors = true
                    throw new Error(`Inputs: ${error.message}`)
                }
            }

            // Save outputs if modified - handle add/update/remove operations
            if (formData._modified.outputs) {
                try {
                    // Get original outputs to compare changes
                    const originalOutputsResult =
                        await window.package.getOutputs(item.id)
                    const originalOutputs = originalOutputsResult.success
                        ? originalOutputsResult.outputs
                        : {}

                    // Find outputs to add, update, or remove
                    const currentOutputs = formData.outputs || {}

                    // Remove outputs that are in original but not in current
                    for (const outputName of Object.keys(originalOutputs)) {
                        if (!(outputName in currentOutputs)) {
                            await window.package.removeOutput(
                                item.id,
                                outputName,
                            )
                        }
                    }

                    // Add or update outputs
                    for (const [outputName, outputConfig] of Object.entries(
                        currentOutputs,
                    )) {
                        if (outputName in originalOutputs) {
                            // Update existing output
                            await window.package.updateOutput(
                                item.id,
                                outputName,
                                outputConfig,
                            )
                        } else {
                            // Add new output
                            await window.package.addOutput(
                                item.id,
                                outputName,
                                outputConfig,
                            )
                        }
                    }
                } catch (error) {
                    console.error("Failed to save outputs:", error)
                    hasErrors = true
                    throw new Error(`Outputs: ${error.message}`)
                }
            }

            // Save instances if modified
            if (formData._modified.instances) {
                try {
                    const currentInstances = formData.instances || {}
                    const originalInstances = item.instances || {}

                    // Process removals first
                    for (const [index, instanceData] of Object.entries(
                        currentInstances,
                    )) {
                        if (
                            instanceData._toRemove &&
                            originalInstances[index]
                        ) {
                            console.log(`Removing instance at index ${index}`)
                            await window.package.removeInstance(item.id, index)
                        }
                    }

                    // Process additions
                    for (const [index, instanceData] of Object.entries(
                        currentInstances,
                    )) {
                        if (instanceData._pending && instanceData._filePath) {
                            console.log(
                                `Adding pending instance: ${instanceData.Name}`,
                            )
                            // Use a new backend function to add instance from file path
                            await window.package.addInstanceFromFile(
                                item.id,
                                instanceData._filePath,
                                instanceData.Name,
                            )
                        }
                    }
                } catch (error) {
                    console.error("Failed to save instances:", error)
                    hasErrors = true
                    throw new Error(`Instances: ${error.message}`)
                }
            }

            // Save instance names if any are being edited
            if (Object.keys(editingNames).length > 0) {
                try {
                    for (const [instanceIndex, newName] of Object.entries(editingNames)) {
                        const trimmedName = newName.trim()
                        const defaultName = `Instance ${parseInt(instanceIndex) + 1}`
                        
                        if (trimmedName === defaultName || trimmedName === "") {
                            // Remove custom name
                            await window.package.removeInstanceName(item.id, parseInt(instanceIndex))
                        } else {
                            // Set custom name
                            await window.package.setInstanceName(item.id, parseInt(instanceIndex), trimmedName)
                        }
                    }
                    
                    // Clear editing names after saving
                    setEditingNames({})
                } catch (error) {
                    console.error("Failed to save instance names:", error)
                    hasErrors = true
                    throw new Error(`Instance names: ${error.message}`)
                }
            }

            // Save Variables data if modified
            if (formData._modified.variables) {
                try {
                    await window.package.saveVariables?.(item.id, formData.variables)
                } catch (error) {
                    console.error("Failed to save Variables data:", error)
                    hasErrors = true
                    throw new Error(`Variables: ${error.message}`)
                }
            }

            // Save Conditions data if modified
            if (formData._modified.conditions) {
                try {
                    // Save blocks format - the backend will handle conversion if needed
                    await window.package.saveConditions?.(item.id, { blocks: formData.blocks })
                } catch (error) {
                    console.error("Failed to save Conditions data:", error)
                    hasErrors = true
                    throw new Error(`Conditions: ${error.message}`)
                }
            }

            // Save other data if modified
            if (formData._modified.other) {
                try {
                    await window.package.saveOther?.(item.id, formData.other)
                } catch (error) {
                    console.error("Failed to save other data:", error)
                    hasErrors = true
                    throw new Error(`Other: ${error.message}`)
                }
            }

            // Wait for all saves to complete
            if (savePromises.length > 0) {
                await Promise.all(savePromises)
            }

            if (!hasErrors) {
                // Show checkmark icon temporarily
                setShowSaveSuccess(true)
                setSaveError(null)
                setTimeout(() => setShowSaveSuccess(false), 2000)

                // Clear all modified flags and staged icon data
                setFormData((prev) => ({
                    ...prev,
                    // Clear staged icon data after successful save
                    stagedIconPath: null,
                    stagedIconName: null,
                    iconChanged: false,
                    _modified: {
                        basicInfo: false,
                        inputs: false,
                        outputs: false,
                        instances: false,
                        variables: false,
                        conditions: false,
                        other: false,
                    },
                }))

                // Clear unsaved changes indicator
                window.package?.setUnsavedChanges?.(false)

                // Trigger reload to get fresh data from backend
                reloadItem(item.id)
            }
        } catch (error) {
            console.error("Failed to save:", error)
            setSaveError(error.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCloseError = () => {
        setSaveError(null)
    }

    const handleCloseOrDiscard = () => {
        const hasUnsavedChanges = Object.values(formData._modified).some(
            (modified) => modified,
        )

        if (hasUnsavedChanges) {
            setDiscardDialogOpen(true)
        } else {
            window.close()
        }
    }

    const handleConfirmDiscard = () => {
        setDiscardDialogOpen(false)
        window.close()
    }

    const handleCancelDiscard = () => {
        setDiscardDialogOpen(false)
    }

    if (!item) return null

    console.log(item)

    return (
        <Box
            sx={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}>
            {/* Main Content Area with Vertical Sidebar */}
            <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Vertical Sidebar */}
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    orientation="vertical"
                    variant="scrollable"
                    sx={{
                        borderRight: 1,
                        borderColor: "divider",
                        minWidth: 80,
                        maxWidth: 80,
                        bgcolor: "background.paper",
                        "& .MuiTabs-indicator": {
                            left: 0,
                            width: 3,
                        },
                        "& .MuiTab-root": {
                            minWidth: 80,
                            width: 80,
                            alignItems: "center",
                            justifyContent: "center",
                        },
                    }}>
                    <Tooltip
                        title="Basic Info - Edit name, author, description"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={!formData._modified.basicInfo}>
                                    <Info />
                                </Badge>
                            }
                        />
                    </Tooltip>
                    <Tooltip
                        title="Inputs - Configure item inputs and outputs"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={
                                        !formData._modified.inputs &&
                                        !formData._modified.outputs
                                    }>
                                    <Input />
                                </Badge>
                            }
                        />
                    </Tooltip>
                    <Tooltip
                        title="Instances - Manage item's VMF instances"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={!formData._modified.instances}>
                                    <ViewInAr />
                                </Badge>
                            }
                        />
                    </Tooltip>
                    <Tooltip
                        title="Variables - Configure VBSP variables"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={!formData._modified.variables}>
                                    <DataObject />
                                </Badge>
                            }
                        />
                    </Tooltip>
                    <Tooltip
                        title="Conditions - Configure VBSP conditions and logic"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={!formData._modified.conditions}>
                                    <Rule />
                                </Badge>
                            }
                        />
                    </Tooltip>
                    <Tooltip
                        title="Other - Additional item settings"
                        placement="right">
                        <Tab
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={!formData._modified.other}>
                                    <Construction />
                                </Badge>
                            }
                        />
                    </Tooltip>
                    <Tooltip
                        title="Metadata - Item metadata and tags"
                        placement="right">
                        <Tab icon={<Description />} />
                    </Tooltip>
                </Tabs>

                {/* Tab Content */}
                <Box sx={{ flex: 1, p: 2, overflow: "auto" }}>
                    <Box sx={{ display: tabValue === 0 ? "block" : "none" }}>
                        <BasicInfo
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 1 ? "block" : "none" }}>
                        <Inputs
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onUpdateInputs={updateInputsData}
                            onUpdateOutputs={updateOutputsData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 2 ? "block" : "none" }}>
                        <Instances
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onUpdateInstances={updateInstancesData}
                            editingNames={editingNames}
                            setEditingNames={setEditingNames}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 3 ? "block" : "none" }}>
                        <Variables
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onUpdateVariables={updateVariablesData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 4 ? "block" : "none" }}>
                        <Conditions
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onUpdateConditions={updateConditionsData}
                            onImportConditions={importConditionsData}
                            editingNames={editingNames}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 5 ? "block" : "none" }}>
                        <Other
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onUpdateOther={updateOtherData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 6 ? "block" : "none" }}>
                        <Metadata item={item} />
                    </Box>
                </Box>
            </Box>

            {/* Save/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1}>
                    {/* Undo/Redo Buttons */}
                    <Tooltip title={`Undo (Ctrl+Z)${undoStack.length > 0 ? ` - ${undoStack[undoStack.length - 1]?.description}` : ' - No actions to undo'}`}>
                        <span>
                            <IconButton
                                onClick={performUndo}
                                disabled={undoStack.length === 0}
                                size="small">
                                <Undo />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={`Redo (Ctrl+Y)${redoStack.length > 0 ? ` - ${redoStack[redoStack.length - 1]?.description}` : ' - No actions to redo'}`}>
                        <span>
                            <IconButton
                                onClick={performRedo}
                                disabled={redoStack.length === 0}
                                size="small">
                                <Redo />
                            </IconButton>
                        </span>
                    </Tooltip>
                                            <Tooltip
                        title={(() => {
                            const modifiedSections = Object.entries(
                                formData._modified,
                            )
                                .filter(([section, isModified]) => isModified)
                                .map(([section]) => {
                                    switch (section) {
                                        case "basicInfo":
                                            return "Basic Info"
                                        case "inputs":
                                            return "Inputs"
                                        case "outputs":
                                            return "Outputs"
                                        case "instances":
                                            return "Instances"
                                        case "variables":
                                            return "Variables"
                                        case "conditions":
                                            return "Conditions"
                                        case "other":
                                            return "Other"
                                        default:
                                            return section
                                    }
                                })

                            // Add instance names if being edited
                            if (Object.keys(editingNames).length > 0) {
                                modifiedSections.push("Instance Names")
                            }

                            if (modifiedSections.length === 0) {
                                return "No unsaved changes"
                            }

                            return `Save changes to: ${modifiedSections.join(", ")}`
                        })()}>
                        <Button
                            variant="contained"
                            startIcon={
                                isSaving ? (
                                    <CircularProgress
                                        size={20}
                                        color="inherit"
                                    />
                                ) : showSaveSuccess ? (
                                    <CheckCircle />
                                ) : (
                                    <Save />
                                )
                            }
                            onClick={handleSave}
                            color={showSaveSuccess ? "success" : "primary"}
                            disabled={
                                (!Object.values(formData._modified).some(
                                    (modified) => modified,
                                ) && Object.keys(editingNames).length === 0) || isSaving
                            }
                            sx={{ flex: 1 }}>
                            {isSaving
                                ? "Saving..."
                                : showSaveSuccess
                                  ? "Saved!"
                                  : "Save"}
                        </Button>
                    </Tooltip>
                    <Tooltip
                        title={(() => {
                            const hasUnsavedChanges = Object.values(
                                formData._modified,
                            ).some((modified) => modified)
                            return hasUnsavedChanges
                                ? "Discard unsaved changes and close editor"
                                : "Close editor"
                        })()}>
                        <Button
                            variant="outlined"
                            startIcon={<Close />}
                            onClick={handleCloseOrDiscard}
                            color={
                                Object.values(formData._modified).some(
                                    (modified) => modified,
                                )
                                    ? "error"
                                    : "primary"
                            }
                            sx={{ flex: 1 }}>
                            {Object.values(formData._modified).some(
                                (modified) => modified,
                            )
                                ? "Discard"
                                : "Close"}
                        </Button>
                    </Tooltip>
                </Stack>
                {saveError && (
                    <Alert
                        severity="error"
                        onClose={handleCloseError}
                        sx={{ mt: 2 }}>
                        {saveError}
                    </Alert>
                )}
            </Box>

            {/* Discard Changes Confirmation Dialog */}
            <Dialog
                open={discardDialogOpen}
                onClose={handleCancelDiscard}
                aria-labelledby="discard-dialog-title"
                aria-describedby="discard-dialog-description">
                <DialogTitle id="discard-dialog-title">
                    Discard Unsaved Changes?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="discard-dialog-description">
                        You have unsaved changes that will be lost if you close
                        the editor. Are you sure you want to discard these
                        changes?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDiscard} color="primary">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDiscard}
                        color="error"
                        variant="contained">
                        Discard Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default ItemEditor
