import {
    Stack,
    TextField,
    FormControlLabel,
    Checkbox,
    Typography,
    Divider,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    InputAdornment,
} from "@mui/material"
import { Lock } from "@mui/icons-material"

function SignageInfo({
    formData,
    onUpdate,
    availableSignages = [],
    showId = false,
}) {
    // Filter out current signage from the list
    const otherSignages = availableSignages.filter((s) => s.id !== formData.id)

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}>
                <Typography variant="h6">Signage Info</Typography>
            </Box>

            <Stack spacing={2}>
                {showId && (
                    <TextField
                        label="ID"
                        value={formData.id}
                        disabled
                        helperText="Fixed identifier — cannot be changed"
                        fullWidth
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Lock
                                        sx={{
                                            fontSize: 16,
                                            color: "text.disabled",
                                        }}
                                    />
                                </InputAdornment>
                            ),
                        }}
                    />
                )}
                <TextField
                    label="Name"
                    value={formData.name}
                    onChange={(e) => onUpdate("name", e.target.value)}
                    helperText="Display name in the app"
                    fullWidth
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={formData.hidden}
                            onChange={(e) => onUpdate("hidden", e.target.checked)}
                        />
                    }
                    label="Hidden (secondary/alternate sign - not selectable in UI)"
                />

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600}>
                    Dual Sign Configuration
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                    Link a secondary sign to create a dual sign. When placed, this
                    sign appears on the left and the secondary on the right.
                </Typography>

                <FormControl fullWidth>
                    <InputLabel>Secondary Sign</InputLabel>
                    <Select
                        value={formData.secondary || ""}
                        label="Secondary Sign"
                        onChange={(e) => onUpdate("secondary", e.target.value)}>
                        <MenuItem value="">
                            <em>None (single sign)</em>
                        </MenuItem>
                        {otherSignages.map((sig) => (
                            <MenuItem key={sig.id} value={sig.id}>
                                {sig.name || sig.id}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>
        </Box>
    )
}

export default SignageInfo
