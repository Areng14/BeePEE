import { createTheme } from "@mui/material/styles"

export const theme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#d2b019ff" },
        secondary: { main: "#dc004e" },
        background: {
            default: "#1d1e1f",
            paper: "#1d1e1f",
        },
        text: {
            primary: "#c3c7c9ff",
        },
    },
    components: {
        MuiTextField: {
            defaultProps: {
                variant: "outlined",
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: "transparent",
                    color: "#c3c7c9ff",
                    "& fieldset": {
                        borderColor: "#ccc",
                    },
                    "&:hover fieldset": {
                        borderColor: "#999",
                    },
                    "&.Mui-focused fieldset": {
                        borderColor: "#d2b019ff",
                    },
                },
                input: {
                    color: "#c3c7c9ff",
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                },
            },
        },
        MuiTypography: {
            styleOverrides: {
                root: {
                    "& strong": {
                        color: "#c3c7c9ff",
                        fontWeight: "bold",
                    },
                },
            },
        },
    },
})
