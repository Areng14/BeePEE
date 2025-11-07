import {
    Stack,
    TextField,
    Box,
    Typography,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Alert,
    Tooltip,
    Autocomplete,
    Collapse,
    Divider,
} from "@mui/material"
import {
    Preview,
} from "@mui/icons-material"
import { useState, useEffect } from "react"

// Predefined model options
const predefinedModels = [
    { category: "Generic", label: "Turret", value: "sentry.3ds" },
    { category: "Generic", label: "Light Strip", value: "light_strip.3ds" },
    { category: "Cubes", label: "Cube (Normal)", value: "cube.3ds" },
    { category: "Cubes", label: "Cube (Companion)", value: "cubecompanion.3ds" },
    { category: "Cubes", label: "Cube (Redirection)", value: "cubelaser.3ds" },
    { category: "Cubes", label: "Cube (Edgeless)", value: "cubesphere.3ds" },
    { category: "Buttons", label: "Floor Button (Weighted)", value: "buttonweight.3ds" },
    { category: "Buttons", label: "Floor Button (Cube)", value: "buttoncube.3ds" },
    { category: "Buttons", label: "Floor Button (Sphere)", value: "buttonball.3ds" },
    { category: "Other", label: "Custom", value: "Custom" },
]

function Other({ item, formData, onUpdate, onUpdateOther, onModelGenerationStart, onModelGenerationComplete }) {
    const [selectedInstanceKey, setSelectedInstanceKey] = useState("")
    const [isConverting, setIsConverting] = useState(false)
    const [conversionProgress, setConversionProgress] = useState("")
    const [vbspVariables, setVbspVariables] = useState([])
    const [portal2Status, setPortal2Status] = useState(null)
    const [objFileExists, setObjFileExists] = useState(false)

    // Check Portal 2 installation status on mount
    useEffect(() => {
        const checkPortal2 = async () => {
            try {
                const status = await window.package?.getPortal2Status?.()
                setPortal2Status(status)
            } catch (error) {
                console.error("Failed to check Portal 2 status:", error)
                setPortal2Status({
                    isInstalled: false,
                    features: {
                        modelGeneration: false,
                        autopacking: false,
                        fgdData: false,
                        hammerEditor: false,
                    },
                })
            }
        }
        checkPortal2()
    }, [])

    // Helper function to convert "TIMER DELAY" to "Timer Delay"
    const formatVariableName = (name) => {
        return name
            .split(/[\s_]+/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ")
    }

    // Extract all variables used by the item
    useEffect(() => {
        const variables = []

        // Check if item has any instances - only add "First Instance" if there are instances
        const hasInstances =
            formData?.instances &&
            Object.keys(formData.instances).length > 0

        if (hasInstances) {
            variables.push("First Instance")
        }

        // Add all item variables
        if (Array.isArray(formData?.variables)) {
            // Variables are an array of objects with displayName and fixupName
            formData.variables.forEach((varObj) => {
                if (varObj && varObj.displayName) {
                    // Format the display name nicely (Timer Delay instead of TIMER DELAY)
                    const displayName = formatVariableName(varObj.displayName)
                    if (!variables.includes(displayName)) {
                        variables.push(displayName)
                    }
                }
            })
        }

        setVbspVariables(variables)
    }, [formData?.variables, formData?.instances])

    // Keep selected variable in sync when variables change
    useEffect(() => {
        if (vbspVariables.length === 0) {
            setSelectedInstanceKey("")
            return
        }
        setSelectedInstanceKey((prev) => {
            // Check if previous selection still exists in variables list
            const stillExists = vbspVariables.includes(prev)
            // Default to "First Instance" if previous selection doesn't exist
            return stillExists ? prev : "First Instance"
        })
    }, [vbspVariables])

    // Listen for conversion progress updates from backend
    useEffect(() => {
        const handleProgress = (event, progressData) => {
            const { stage, message, detail } = progressData

            // Update progress message based on stage
            const stageMessages = {
                merge: "📐 Merging VMFs into grid...",
                vmf2obj: "🔄 Converting to OBJ...",
                split: "✂️ Splitting models...",
                mdl: "🔨 Converting to MDL...",
            }

            setConversionProgress(
                stageMessages[stage] || message || "Converting...",
            )
        }

        // Register listener
        window.api?.on?.("conversion-progress", handleProgress)

        // Cleanup
        return () => {
            window.api?.off?.("conversion-progress", handleProgress)
        }
    }, [])

    // Auto-detect custom models: if modelName starts with "bpee/", check if OBJ exists
    useEffect(() => {
        if (formData?.modelName && typeof formData.modelName === 'string') {
            if (formData.modelName.startsWith('bpee/')) {
                // Model is a BeePEE model - check if OBJ exists to determine if it's custom
                console.log(`Detected BeePEE model: ${formData.modelName} (OBJ exists: ${objFileExists})`)
            }
        }
    }, [formData?.modelName, objFileExists])

    // Check if OBJ file exists for preview
    useEffect(() => {
        const checkObjExists = async () => {
            const objPath = getObjPath()
            if (!objPath) {
                setObjFileExists(false)
                return
            }

            try {
                // Check if directory exists and contains OBJ files
                const exists = await window.electron.invoke('check-file-exists', objPath)
                setObjFileExists(exists)
            } catch (error) {
                console.error('Failed to check OBJ file existence:', error)
                setObjFileExists(false)
            }
        }

        checkObjExists()
    }, [item?.packagePath, item?.id, isConverting, formData?.modelName])

    // Get the expected OBJ file path for the model
    // After multi-model generation, files are named after instance names (e.g., half_glass_0.obj)
    // Just return the .bpee/tempmdl directory - backend will find the first OBJ file
    const getObjPath = () => {
        if (!item?.id || !item?.packagePath) return null

        const tempDir = `${item.packagePath}/.bpee/tempmdl`

        // Return directory path - backend will find first OBJ file
        return tempDir
    }

    // Get the expected MTL file path for the model
    const getMtlPath = () => {
        const objPath = getObjPath()
        if (!objPath) return null
        return objPath.replace(/\.obj$/i, ".mtl")
    }

    // Get display name for the current selection
    const getInstanceDisplayName = () => {
        if (!selectedInstanceKey) return null
        return selectedInstanceKey // Just return the variable name (e.g., "TIMER DELAY", "DEFAULT")
    }

    const handleMakeModel = async () => {
        if (!selectedInstanceKey || isConverting) return

        setIsConverting(true)
        setConversionProgress("🚀 Starting conversion...")

        // Notify parent that generation is starting
        onModelGenerationStart?.()

        try {
            // selectedInstanceKey now contains the selected variable name (e.g., "TIMER DELAY", "DEFAULT")
            // Backend will handle mapping variable to appropriate instance

            // Ask backend to resolve the VMF path and convert
            const result = await window.package.convertInstanceToObj(
                item.id,
                selectedInstanceKey, // This is now a variable name, not an instance key
                { textureStyle: "cartoon", isVariable: true },
            )
            if (result?.success) {
                console.log("VMF2OBJ conversion completed successfully")

                // Extract staged editoritems from result
                const stagedEditorItems = result.mdlResult?.stagedEditorItems || result.stagedEditorItems

                // Notify parent that generation is complete with staged data
                onModelGenerationComplete?.(stagedEditorItems)

                // Check MDL conversion result
                if (result.mdlResult?.success) {
                    console.log("✅ MDL conversion successful!")
                    console.log(
                        `   Model path: ${result.mdlResult.relativeModelPath}`,
                    )
                    await window.electron.showMessageBox({
                        type: 'info',
                        title: 'Model Generated Successfully',
                        message: 'Model generated successfully!',
                        detail: `OBJ: ${result.objPath}\nMDL: ${result.mdlResult.relativeModelPath}\n\nChanges will be applied when you click Save in the editor.`,
                        buttons: ['OK']
                    })
                } else if (result.mdlResult?.error) {
                    console.warn(
                        "⚠️ OBJ created but MDL conversion failed:",
                        result.mdlResult.error,
                    )
                    await window.electron.showMessageBox({
                        type: 'warning',
                        title: 'Partial Success',
                        message: 'OBJ model created successfully, but MDL conversion failed',
                        detail: `${result.mdlResult.error}\n\nYou can still preview the OBJ model.`,
                        buttons: ['OK']
                    })
                } else {
                    console.log("OBJ created (MDL conversion skipped)")
                }
            } else {
                console.error("VMF2OBJ failed:", result?.error)
                // Notify parent that generation is complete (no staged data)
                onModelGenerationComplete?.(null)
            }
        } catch (error) {
            console.error("Failed to make model:", error)
            // Notify parent that generation is complete (no staged data)
            onModelGenerationComplete?.(null)
        } finally {
            setIsConverting(false)
            setConversionProgress("")
        }
    }

    const handlePreview = async () => {
        if (!selectedInstanceKey) return

        const objPath = getObjPath()
        const mtlPath = getMtlPath()

        if (!objPath) {
            await window.electron.showMessageBox({
                type: 'warning',
                title: 'Model Not Found',
                message: 'No OBJ path found. Please generate the model first.',
                buttons: ['OK']
            })
            return
        }

        // Check if the OBJ file exists
        try {
            const stats = await window.package?.getFileStats?.(objPath)
            if (!stats) {
                await window.electron.showMessageBox({
                    type: 'warning',
                    title: 'Model File Not Found',
                    message: 'Model file not found. Please click "Make Model" first to generate the 3D model.',
                    buttons: ['OK']
                })
                return
            }
        } catch (e) {
            await window.electron.showMessageBox({
                type: 'warning',
                title: 'Model File Not Found',
                message: 'Model file not found. Please click "Make Model" first to generate the 3D model.',
                buttons: ['OK']
            })
            return
        }

        const title = `${getInstanceDisplayName() || "Instance"} — ${item?.name || "Model"}`
        try {
            await window.package?.showModelPreview?.(objPath, mtlPath, title)
        } catch (e) {
            console.error("Failed to open model preview:", e)
        }
    }

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}>
                <Typography variant="h6">Other</Typography>
            </Box>

            <Stack spacing={2} sx={{ height: "100%" }}>
                {/* Model Chooser */}
                <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Model Chooser
                    </Typography>
                    <Autocomplete
                        freeSolo
                        options={(() => {
                            // Build options list: predefined models + generated models (if any)
                            const options = [...predefinedModels]
                            
                            // If modelName starts with "bpee/" but no OBJ exists, add it to "Generated Models"
                            if (formData.modelName && 
                                typeof formData.modelName === 'string' && 
                                formData.modelName.startsWith('bpee/') && 
                                !objFileExists) {
                                // Extract a display name from the model path
                                const modelPath = formData.modelName
                                const fileName = modelPath.split('/').pop() || modelPath
                                const displayName = fileName.replace(/\.mdl$/i, '')
                                
                                // Add to Generated Models category if not already in options
                                const alreadyExists = options.some(opt => opt.value === modelPath)
                                if (!alreadyExists) {
                                    options.push({
                                        category: "Generated Models",
                                        label: displayName,
                                        value: modelPath
                                    })
                                }
                            }
                            
                            return options
                        })()}
                        groupBy={(option) => option.category}
                        getOptionLabel={(option) => {
                            // Handle both string (custom) and object (predefined) values
                            if (typeof option === "string") return option
                            return option.value
                        }}
                        renderOption={(props, option) => (
                            <li {...props}>
                                <Box>
                                    <Typography variant="body2">
                                        {option.label}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary">
                                        {option.value}
                                    </Typography>
                                </Box>
                            </li>
                        )}
                        value={
                            (() => {
                                // If modelName starts with "bpee/" and OBJ exists, show "Custom"
                                // If modelName starts with "bpee/" and NO OBJ exists, show raw path
                                if (formData.modelName && formData.modelName.startsWith('bpee/')) {
                                    return objFileExists ? "Custom" : formData.modelName
                                }
                                return formData.modelName || ""
                            })()
                        }
                        onChange={(event, newValue) => {
                            // Handle both object (selected from list) and string (typed in)
                            const modelValue =
                                typeof newValue === "string"
                                    ? newValue
                                    : newValue?.value || ""
                            onUpdate("modelName", modelValue, "other")
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Model Name"
                                placeholder="Select or enter model..."
                                helperText="Choose a predefined model or enter a custom path"
                            />
                        )}
                    />
                </Box>

                {/* Model Generator - shown when "Custom" is selected OR custom bpee/ model exists with OBJ files */}
                <Collapse in={formData.modelName === "Custom" || (formData.modelName && formData.modelName.startsWith('bpee/') && objFileExists)} timeout={300}>
                    <Divider sx={{ my: 1 }} />

                    <Box>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>
                            Model Generator
                        </Typography>
                        {!portal2Status?.features?.modelGeneration && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Portal 2 not detected. Model generation requires Portal 2
                                to be installed for STUDIOMDL compilation.
                            </Alert>
                        )}
                        {vbspVariables.length === 0 && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Add at least one instance to enable model generation.
                            </Alert>
                        )}
                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ mb: 1, display: "block" }}>
                                Generates models based on your conditions config. Example:{" "}
                                <Box component="span" sx={{ fontWeight: 500 }}>
                                    Start Enabled
                                </Box>{" "}
                                creates on/off state models.
                            </Typography>
                            <FormControl
                                size="small"
                                fullWidth
                                disabled={
                                    !portal2Status?.features?.modelGeneration ||
                                    vbspVariables.length === 0
                                }>
                                <InputLabel id="variable-select-label">
                                    Generation Type
                                </InputLabel>
                                <Select
                                    labelId="variable-select-label"
                                    label="Generation Type"
                                    value={selectedInstanceKey}
                                    onChange={(e) =>
                                        setSelectedInstanceKey(e.target.value)
                                    }
                                    fullWidth>
                                    {vbspVariables.length === 0 ? (
                                        <MenuItem value="" disabled>
                                            No variables available
                                        </MenuItem>
                                    ) : (
                                        vbspVariables.map((varName) => (
                                            <MenuItem key={varName} value={varName}>
                                                {varName}
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            {/* If custom bpee/ model exists with OBJ files, Preview becomes primary (large) button */}
                            {formData.modelName && formData.modelName.startsWith('bpee/') && objFileExists ? (
                                <>
                                    <Tooltip
                                        title={
                                            vbspVariables.length === 0
                                                ? "Add at least one instance"
                                                : !portal2Status?.features?.modelGeneration
                                                  ? "Portal 2 required"
                                                  : !objFileExists
                                                    ? "Generate model first"
                                                    : ""
                                        }>
                                        <span style={{ flexGrow: 1 }}>
                                            <Button
                                                variant="contained"
                                                onClick={handlePreview}
                                                disabled={
                                                    !selectedInstanceKey ||
                                                    !portal2Status?.features?.modelGeneration ||
                                                    vbspVariables.length === 0 ||
                                                    !objFileExists
                                                }
                                                startIcon={<Preview />}
                                                fullWidth>
                                                Preview
                                            </Button>
                                        </span>
                                    </Tooltip>
                                    <Tooltip
                                        title={
                                            vbspVariables.length === 0
                                                ? "Add at least one instance"
                                                : !portal2Status?.features?.modelGeneration
                                                  ? "Portal 2 required"
                                                  : ""
                                        }>
                                        <span>
                                            <Button
                                                variant="outlined"
                                                onClick={handleMakeModel}
                                                disabled={
                                                    !selectedInstanceKey ||
                                                    isConverting ||
                                                    !portal2Status?.features?.modelGeneration ||
                                                    vbspVariables.length === 0
                                                }
                                                sx={{ flexShrink: 0 }}>
                                                {isConverting ? conversionProgress : "Regenerate"}
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </>
                            ) : (
                                <>
                                    <Tooltip
                                        title={
                                            vbspVariables.length === 0
                                                ? "Add at least one instance"
                                                : !portal2Status?.features?.modelGeneration
                                                  ? "Portal 2 required"
                                                  : !objFileExists
                                                    ? "Generate model first"
                                                    : ""
                                        }>
                                        <span>
                                            <Button
                                                variant="outlined"
                                                onClick={handlePreview}
                                                disabled={
                                                    !selectedInstanceKey ||
                                                    !portal2Status?.features?.modelGeneration ||
                                                    vbspVariables.length === 0 ||
                                                    !objFileExists
                                                }
                                                startIcon={<Preview />}
                                                sx={{ flexShrink: 0 }}>
                                                Preview
                                            </Button>
                                        </span>
                                    </Tooltip>
                                    <Tooltip
                                        title={
                                            vbspVariables.length === 0
                                                ? "Add at least one instance"
                                                : !portal2Status?.features?.modelGeneration
                                                  ? "Portal 2 required"
                                                  : ""
                                        }>
                                        <span style={{ flexGrow: 1 }}>
                                            <Button
                                                variant="contained"
                                                onClick={handleMakeModel}
                                                disabled={
                                                    !selectedInstanceKey ||
                                                    isConverting ||
                                                    !portal2Status?.features?.modelGeneration ||
                                                    vbspVariables.length === 0
                                                }
                                                fullWidth
                                                startIcon={
                                                    isConverting ? (
                                                        <CircularProgress
                                                            size={20}
                                                            color="inherit"
                                                        />
                                                    ) : null
                                                }>
                                                {isConverting
                                                    ? conversionProgress || "Converting..."
                                                    : "Make Model"}
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </>
                            )}
                        </Stack>
                    </Box>
                </Collapse>
            </Stack>
        </Box>
    )
}

export default Other
