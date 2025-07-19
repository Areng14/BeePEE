import { Stack, TextField } from '@mui/material'

function BasicInfo({ name, setName, author, setAuthor }) {
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
        </Stack>
    )
}

export default BasicInfo