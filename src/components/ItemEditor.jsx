import { useEffect, useState } from "react"
import { Box, TextField, Button, Typography, Paper, Stack } from "@mui/material"
import { Save, Close } from "@mui/icons-material"

function ItemEditor() {
    const [item, setItem] = useState(null)
    const [name, setName] = useState("")
    const [author, setAuthor] = useState("")

    useEffect(() => {
        // Listen for item data from the main process
        const handleLoadItem = (event, loadedItem) => {
            console.log("Received item:", loadedItem)
            console.log("Item name:", loadedItem?.name)
            console.log("Item details:", loadedItem?.details)
            console.log("Item authors:", loadedItem?.details?.Authors)
            setItem(loadedItem)
            setName(loadedItem.name || "")
            setAuthor(loadedItem.details?.Authors || "")
        }

        window.package?.onItemLoaded?.(handleLoadItem)

        // Tell main process we're ready to receive data
        window.package?.editorReady?.()
    }, [])

    const handleSave = () => {
        // TODO: Saving
        console.log("Saving:", { name, author })
    }

    if (!item) return <Typography>Loading...</Typography>

    return (
        <Box sx={{ p: 2, height: "100vh" }}>
            <Paper sx={{ p: 2, height: "100%" }}>
                <Typography variant="h6" gutterBottom>
                    Edit Item
                </Typography>

                <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                    />

                    <TextField
                        label="Author"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        fullWidth
                    />

                    <Stack direction="row" spacing={1} sx={{ mt: "auto" }}>
                        <Button
                            variant="contained"
                            startIcon={<Save />}
                            onClick={handleSave}>
                            Save
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<Close />}
                            onClick={() => window.close?.()}>
                            Close
                        </Button>
                    </Stack>
                </Stack>
            </Paper>
        </Box>
    )
}

export default ItemEditor
