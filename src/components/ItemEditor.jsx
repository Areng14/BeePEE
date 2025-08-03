import { useEffect, useState } from "react"
import { Box, Tabs, Tab, Button, Stack, Alert, Tooltip, Badge } from "@mui/material"
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
} from "@mui/icons-material"
import BasicInfo from "./items/BasicInfo"
import Inputs from "./items/Inputs"
import Instances from "./items/Instances"
import Vbsp from "./items/Vbsp"
import Other from "./items/Other"
import Metadata from "./items/Metadata"
import { useItemContext } from "../contexts/ItemContext"

function ItemEditor() {
    const { item, reloadItem } = useItemContext()
    const [tabValue, setTabValue] = useState(0)
    const [saveError, setSaveError] = useState(null)
    const [showSaveSuccess, setShowSaveSuccess] = useState(false)

    // Form state for all tabs
    const [formData, setFormData] = useState({
        name: "",
        author: "",
        description: "",
        // Inputs and Outputs data
        inputs: {},
        outputs: {},
        // Instances data
        instances: {},
        // VBSP data
        vbsp: {},
        // Other tab data
        other: {},
        // Track what has been modified
        _modified: {
            basicInfo: false,
            inputs: false,
            outputs: false,
            instances: false,
            vbsp: false,
            other: false,
        }
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

            // Load inputs and outputs
            const loadInputsOutputs = async () => {
                try {
                    const [inputResult, outputResult] = await Promise.all([
                        window.package.getInputs(item.id),
                        window.package.getOutputs(item.id),
                    ])
                    
                    setFormData(prev => ({
                        ...prev,
                        name: item.name || "",
                        author: item.details?.Authors || "",
                        description: description,
                        inputs: inputResult.success ? inputResult.inputs : {},
                        outputs: outputResult.success ? outputResult.outputs : {},
                        // Only update instances if we don't have local modifications
                        instances: prev._modified.instances ? prev.instances : (item.instances || {}),
                        vbsp: item.vbsp || {},
                        other: item.other || {},
                        _modified: {
                            basicInfo: false,
                            inputs: false,
                            outputs: false,
                            // Keep instances modified flag if it was already set
                            instances: prev._modified.instances,
                            vbsp: false,
                            other: false,
                        }
                    }))
                } catch (error) {
                    console.error("Failed to load inputs/outputs:", error)
                    setFormData(prev => ({
                        ...prev,
                        name: item.name || "",
                        author: item.details?.Authors || "",
                        description: description,
                        inputs: {},
                        outputs: {},
                        // Only update instances if we don't have local modifications
                        instances: prev._modified.instances ? prev.instances : (item.instances || {}),
                        vbsp: item.vbsp || {},
                        other: item.other || {},
                        _modified: {
                            basicInfo: false,
                            inputs: false,
                            outputs: false,
                            // Keep instances modified flag if it was already set
                            instances: prev._modified.instances,
                            vbsp: false,
                            other: false,
                        }
                    }))
                }
            }
            
            loadInputsOutputs()

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

    const updateFormData = (field, value, section = 'basicInfo') => {
        setFormData((prev) => {
            const newData = {
                ...prev,
                [field]: value,
                _modified: {
                    ...prev._modified,
                    [section]: true
                }
            }

            // Check if any section has changes
            const hasChanges = Object.values(newData._modified).some(modified => modified)

            // Update window title with unsaved changes indicator
            window.package?.setUnsavedChanges?.(hasChanges)

            return newData
        })
    }

    // Specialized update functions for different sections
    const updateInputsData = (inputs) => {
        setFormData(prev => ({
            ...prev,
            inputs,
            _modified: {
                ...prev._modified,
                inputs: true
            }
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateOutputsData = (outputs) => {
        setFormData(prev => ({
            ...prev,
            outputs,
            _modified: {
                ...prev._modified,
                outputs: true
            }
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateInstancesData = (instances) => {
        setFormData(prev => ({
            ...prev,
            instances,
            _modified: {
                ...prev._modified,
                instances: true
            }
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateVbspData = (vbsp) => {
        setFormData(prev => ({
            ...prev,
            vbsp,
            _modified: {
                ...prev._modified,
                vbsp: true
            }
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const updateOtherData = (other) => {
        setFormData(prev => ({
            ...prev,
            other,
            _modified: {
                ...prev._modified,
                other: true
            }
        }))
        window.package?.setUnsavedChanges?.(true)
    }

    const handleSave = async () => {
        try {
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
                }

                savePromises.push(
                    window.package?.saveItem?.(saveData).catch(error => {
                        console.error("Failed to save basic info:", error)
                        hasErrors = true
                        throw new Error(`Basic info: ${error.message}`)
                    })
                )
            }

            // Save inputs if modified - handle add/update/remove operations
            if (formData._modified.inputs) {
                try {
                    // Get original inputs to compare changes
                    const originalInputsResult = await window.package.getInputs(item.id)
                    const originalInputs = originalInputsResult.success ? originalInputsResult.inputs : {}
                    
                    // Find inputs to add, update, or remove
                    const currentInputs = formData.inputs || {}
                    
                    // Remove inputs that are in original but not in current
                    for (const inputName of Object.keys(originalInputs)) {
                        if (!(inputName in currentInputs)) {
                            await window.package.removeInput(item.id, inputName)
                        }
                    }
                    
                    // Add or update inputs
                    for (const [inputName, inputConfig] of Object.entries(currentInputs)) {
                        if (inputName in originalInputs) {
                            // Update existing input
                            await window.package.updateInput(item.id, inputName, inputConfig)
                        } else {
                            // Add new input
                            await window.package.addInput(item.id, inputName, inputConfig)
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
                    const originalOutputsResult = await window.package.getOutputs(item.id)
                    const originalOutputs = originalOutputsResult.success ? originalOutputsResult.outputs : {}
                    
                    // Find outputs to add, update, or remove
                    const currentOutputs = formData.outputs || {}
                    
                    // Remove outputs that are in original but not in current
                    for (const outputName of Object.keys(originalOutputs)) {
                        if (!(outputName in currentOutputs)) {
                            await window.package.removeOutput(item.id, outputName)
                        }
                    }
                    
                    // Add or update outputs
                    for (const [outputName, outputConfig] of Object.entries(currentOutputs)) {
                        if (outputName in originalOutputs) {
                            // Update existing output
                            await window.package.updateOutput(item.id, outputName, outputConfig)
                        } else {
                            // Add new output
                            await window.package.addOutput(item.id, outputName, outputConfig)
                        }
                    }
                } catch (error) {
                    console.error("Failed to save outputs:", error)
                    hasErrors = true
                    throw new Error(`Outputs: ${error.message}`)
                }
            }

            // Instances are handled immediately by individual operations (add/remove)
            // The formData._modified.instances flag is used for UI indication only
            // When instances are modified, the backend sends item-updated events
            // which we handle by preserving local modifications

            // Save VBSP data if modified
            if (formData._modified.vbsp) {
                try {
                    await window.package.saveVbsp?.(item.id, formData.vbsp)
                } catch (error) {
                    console.error("Failed to save VBSP data:", error)
                    hasErrors = true
                    throw new Error(`VBSP: ${error.message}`)
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

                // Clear all modified flags
                setFormData(prev => ({
                    ...prev,
                    _modified: {
                        basicInfo: false,
                        inputs: false,
                        outputs: false,
                        instances: false,
                        vbsp: false,
                        other: false,
                    }
                }))

                // Clear unsaved changes indicator
                window.package?.setUnsavedChanges?.(false)

                // Trigger reload to get fresh data from backend
                reloadItem(item.id)
            }
        } catch (error) {
            console.error("Failed to save:", error)
            setSaveError(error.message)
        }
    }

    const handleCloseError = () => {
        setSaveError(null)
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
                        <Tab icon={
                            <Badge 
                                color="primary" 
                                variant="dot" 
                                invisible={!formData._modified.basicInfo}
                            >
                                <Info />
                            </Badge>
                        } />
                    </Tooltip>
                    <Tooltip
                        title="Inputs - Configure item inputs and outputs"
                        placement="right">
                        <Tab icon={
                            <Badge 
                                color="primary" 
                                variant="dot" 
                                invisible={!formData._modified.inputs && !formData._modified.outputs}
                            >
                                <Input />
                            </Badge>
                        } />
                    </Tooltip>
                    <Tooltip
                        title="Instances - Manage item's VMF instances"
                        placement="right">
                        <Tab icon={
                            <Badge 
                                color="primary" 
                                variant="dot" 
                                invisible={!formData._modified.instances}
                            >
                                <ViewInAr />
                            </Badge>
                        } />
                    </Tooltip>
                    <Tooltip
                        title="VBSP - Configure instance swapping and conditions"
                        placement="right">
                        <Tab icon={
                            <Badge 
                                color="primary" 
                                variant="dot" 
                                invisible={!formData._modified.vbsp}
                            >
                                <Code />
                            </Badge>
                        } />
                    </Tooltip>
                    <Tooltip
                        title="Other - Additional item settings"
                        placement="right">
                        <Tab icon={
                            <Badge 
                                color="primary" 
                                variant="dot" 
                                invisible={!formData._modified.other}
                            >
                                <Construction />
                            </Badge>
                        } />
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
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 3 ? "block" : "none" }}>
                        <Vbsp
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onUpdateVbsp={updateVbspData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 4 ? "block" : "none" }}>
                        <Other
                            item={item}
                            formData={formData}
                            onUpdate={updateFormData}
                            onUpdateOther={updateOtherData}
                        />
                    </Box>
                    <Box sx={{ display: tabValue === 5 ? "block" : "none" }}>
                        <Metadata item={item} />
                    </Box>
                </Box>
            </Box>

            {/* Save/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1}>
                    <Tooltip title={(() => {
                        const modifiedSections = Object.entries(formData._modified)
                            .filter(([section, isModified]) => isModified)
                            .map(([section]) => {
                                switch(section) {
                                    case 'basicInfo': return 'Basic Info'
                                    case 'inputs': return 'Inputs'
                                    case 'outputs': return 'Outputs'
                                    case 'instances': return 'Instances'
                                    case 'vbsp': return 'VBSP'
                                    case 'other': return 'Other'
                                    default: return section
                                }
                            })
                        
                        if (modifiedSections.length === 0) {
                            return "No unsaved changes"
                        }
                        
                        return `Save changes to: ${modifiedSections.join(', ')}`
                    })()}>
                        <Button
                            variant="contained"
                            startIcon={
                                showSaveSuccess ? <CheckCircle /> : <Save />
                            }
                            onClick={handleSave}
                            color={showSaveSuccess ? "success" : "primary"}
                            disabled={!Object.values(formData._modified).some(modified => modified)}
                            sx={{ flex: 1 }}>
                            {showSaveSuccess ? "Saved!" : "Save"}
                        </Button>
                    </Tooltip>
                    <Tooltip title="Close editor without saving">
                        <Button
                            variant="outlined"
                            startIcon={<Close />}
                            onClick={() => window.close()}
                            sx={{ flex: 1 }}>
                            Close
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
        </Box>
    )
}

export default ItemEditor
