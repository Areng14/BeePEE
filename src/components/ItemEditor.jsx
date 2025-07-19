import { useEffect, useState } from "react"
import { Box, Tabs, Tab, Button, Stack } from "@mui/material"
import {
    Info,
    Input,
    ViewInAr,
    Code,
    Save,
    Close,
    Construction,
} from "@mui/icons-material"
import BasicInfo from "./items/BasicInfo"
import Inputs from "./items/Inputs"
import Instances from "./items/Instances"
import Vbsp from "./items/Vbsp"
import Other from "./items/Other"

function ItemEditor() {
    const [item, setItem] = useState(null)
    const [tabValue, setTabValue] = useState(0)
    const [iconSrc, setIconSrc] = useState(null)
    
    // Form state for all tabs
    const [formData, setFormData] = useState({
        name: '',
        author: '',
        description: '',
        // Add other fields as needed for other tabs
    })

    useEffect(() => {
        const handleLoadItem = (event, loadedItem) => {
            setItem(loadedItem)
            document.title = `Edit ${loadedItem.name}`
            
            // Initialize form data with loaded item
            const desc = loadedItem.details?.Description
            let description = ''
            
            if (desc && typeof desc === 'object') {
                const descValues = Object.keys(desc)
                    .filter(key => key.startsWith('desc_'))
                    .sort()
                    .map(key => desc[key])
                    .filter(value => value && value.trim() !== '')
                    .join('\n')
                    .trim()
                description = descValues
            } else {
                description = desc || ''
            }
            
            setFormData({
                name: loadedItem.name || '',
                author: loadedItem.details?.Authors || '',
                description: description,
                // Add other fields here
            })

            // Load the icon
            if (loadedItem.icon) {
                window.package.loadFile(loadedItem.icon).then(setIconSrc)
            }
        }

        window.package?.onItemLoaded?.(handleLoadItem)
        window.package?.editorReady?.()
    }, [])

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    const updateFormData = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const handleSave = () => {
        console.log("Saving:", formData)
        // TODO: Send save data via IPC
        // window.package?.saveItem?.(formData)
    }

    if (!item) return null

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Icon Banner */}
            <Box
                sx={{
                    height: 120,
                    background:
                        "linear-gradient(135deg, #d2b019ff 0%, #b8951a 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                <img
                    src={iconSrc || "placeholder.png"}
                    alt={item.name}
                    style={{
                        width: 64,
                        height: 64,
                        border: "2px solid white",
                        borderRadius: 4,
                    }}
                />
            </Box>

            {/* Tabs */}
            <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    minHeight: 48,
                }}>
                <Tab icon={<Info />} />
                <Tab icon={<Input />} />
                <Tab icon={<ViewInAr />} />
                <Tab icon={<Code />} />
                <Tab icon={<Construction />} />
            </Tabs>
            
            {/* Tab Content */}
            <Box sx={{ flex: 1, p: 2, overflow: "auto" }}>
                <Box sx={{ display: tabValue === 0 ? 'block' : 'none' }}>
                    <BasicInfo 
                        item={item} 
                        formData={formData} 
                        onUpdate={updateFormData} 
                    />
                </Box>
                <Box sx={{ display: tabValue === 1 ? 'block' : 'none' }}>
                    <Inputs 
                        item={item} 
                        formData={formData} 
                        onUpdate={updateFormData} 
                    />
                </Box>
                <Box sx={{ display: tabValue === 2 ? 'block' : 'none' }}>
                    <Instances 
                        item={item} 
                        formData={formData} 
                        onUpdate={updateFormData} 
                    />
                </Box>
                <Box sx={{ display: tabValue === 3 ? 'block' : 'none' }}>
                    <Vbsp 
                        item={item} 
                        formData={formData} 
                        onUpdate={updateFormData} 
                    />
                </Box>
                <Box sx={{ display: tabValue === 4 ? 'block' : 'none' }}>
                    <Other 
                        item={item} 
                        formData={formData} 
                        onUpdate={updateFormData} 
                    />
                </Box>
            </Box>

            {/* Save/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSave}
                        fullWidth>
                        Save
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<Close />}
                        onClick={() => window.close?.()}
                        fullWidth>
                        Close
                    </Button>
                </Stack>
            </Box>
        </Box>
    )
}

export default ItemEditor