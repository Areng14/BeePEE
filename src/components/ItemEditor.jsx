import { useEffect, useState } from 'react'
import {
    Box,
    Tabs,
    Tab,
    Button,
    Stack
} from '@mui/material'
import { 
    Info, 
    Input, 
    ViewInAr,
    Code,
    Save, 
    Close 
} from '@mui/icons-material'
import BasicInfo from './items/BasicInfo'
import Inputs from './items/Inputs'
import Instances from './items/Instances'
import Vbsp from './items/Vbsp'

function ItemEditor() {
    const [item, setItem] = useState(null)
    const [tabValue, setTabValue] = useState(0)
    const [name, setName] = useState('')
    const [author, setAuthor] = useState('')
    const [description, setDescription] = useState('')
    const [iconSrc, setIconSrc] = useState(null)

    useEffect(() => {
        const handleLoadItem = (event, loadedItem) => {
            setItem(loadedItem)
            setName(loadedItem.name || '')
            setAuthor(loadedItem.details?.Authors || '')
            setDescription(loadedItem.details?.Description || '')
            
            // Load the icon
            if (loadedItem.icon) {
                window.package.loadFile(loadedItem.icon).then(setIconSrc)
            }
        }

        window.package?.onItemLoaded?.(handleLoadItem)
        window.package?.editorReady?.()
    }, [])

    useEffect(() => {
        if (item) {
            document.title = `Edit ${name}`
        }
    }, [name, item])

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    const handleSave = () => {
        console.log('Save:', { name, author })
        // TODO: Send save data via IPC
    }

    if (!item) return null

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Icon Banner */}
            <Box sx={{
                height: 120,
                background: 'linear-gradient(135deg, #669bea 0%, #4b55a2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <img
                    src={iconSrc || 'placeholder.png'}
                    alt={item.name}
                    style={{
                        width: 64,
                        height: 64,
                        border: '2px solid white',
                        borderRadius: 4
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
                    borderColor: 'divider',
                    minHeight: 48
                }}
            >
                <Tab icon={<Info />} />
                <Tab icon={<Input />} />
                <Tab icon={<ViewInAr />} />
                <Tab icon={<Code />} />  {/* Add this */}
            </Tabs>

            {/* Tab Content */}
            <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
                {tabValue === 0 && (
                    <BasicInfo 
                        name={name} 
                        setName={setName} 
                        author={author} 
                        setAuthor={setAuthor}
                        description={description}
                        setDescription={setDescription} 
                    />
                )}
                {tabValue === 1 && (
                    <Inputs item={item} />
                )}
                {tabValue === 2 && (
                    <Instances item={item} />
                )}
                {tabValue === 3 && (
                    <Vbsp item={item} />
                )}
            </Box>

            {/* Save/Close Buttons */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSave}
                        fullWidth
                    >
                        Save
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<Close />}
                        onClick={() => window.close?.()}
                        fullWidth
                    >
                        Close
                    </Button>
                </Stack>
            </Box>
        </Box>
    )
}

export default ItemEditor