import { Stack, TextField } from '@mui/material'

function BasicInfo({ name, setName, author, setAuthor, description, setDescription }) {
    return (
        <Stack spacing={2}>
            <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                variant="outlined"
            />
            
            <TextField
                label="Author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                fullWidth
                variant="outlined"
            />

            <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                variant="outlined"
                multiline
                sx={{ 
                    flex: 1,  // This makes it expand
                    '& .MuiInputBase-root': {
                        height: '100%',
                        alignItems: 'flex-start'
                    }
                }}
            />
        </Stack>
    )
}

export default BasicInfo