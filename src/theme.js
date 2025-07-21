import { createTheme } from "@mui/material/styles"

export const theme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#d2b019ff" },
        success: { main: "#1db34fff" },
        secondary: { main: "#dc004e" },
        background: {
            default: "#1d1e1f",
            paper: "#2a2d30",
        },
        text: {
            primary: "#c3c7c9ff",
        },
    },
    shape: {
        borderRadius: 8,
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
                        borderColor: "#555",
                    },
                    "&:hover fieldset": {
                        borderColor: "#777",
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
                    borderRadius: 6,
                    fontWeight: 500,
                    boxShadow: "none",
                    "&:hover": {
                        boxShadow: "none",
                    },
                },
                contained: {
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    "&:hover": {
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                    border: "1px solid #3a3a3a",
                    backgroundImage: "none",
                    backgroundColor: "#2a2d30",
                },
            },
        },
        MuiBackdrop: {
            styleOverrides: {
                root: {
                    backdropFilter: "blur(4px)",
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: "#e0e0e0",
                    paddingBottom: 16,
                    borderBottom: "1px solid #3a3a3a",
                },
            },
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    padding: "24px",
                    "&:first-of-type": {
                        paddingTop: 24,
                    },
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    padding: "16px 24px 24px",
                    gap: 12,
                    borderTop: "1px solid #3a3a3a",
                    "& .MuiButton-root": {
                        minWidth: 80,
                        height: 36,
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    backgroundColor: "#2a2d30",
                    border: "1px solid #3a3a3a",
                },
                outlined: {
                    borderColor: "#3a3a3a",
                },
            },
        },
        MuiAccordion: {
            styleOverrides: {
                root: {
                    backgroundColor: "#2a2d30",
                    border: "1px solid #3a3a3a",
                    borderRadius: 8,
                    "&:before": {
                        display: "none",
                    },
                    "&.Mui-expanded": {
                        margin: 0,
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    backgroundColor: "#3a3a3a",
                    color: "#c3c7c9ff",
                    borderRadius: 6,
                },
                outlined: {
                    borderColor: "#555",
                    backgroundColor: "transparent",
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: {
                    borderBottom: "1px solid #3a3a3a",
                },
                indicator: {
                    backgroundColor: "#d2b019ff",
                    height: 3,
                    borderRadius: 2,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 500,
                    color: "#888",
                    "&.Mui-selected": {
                        color: "#d2b019ff",
                    },
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
                subtitle2: {
                    color: "#b0b0b0",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    fontSize: "0.75rem",
                },
            },
        },
    },
})
