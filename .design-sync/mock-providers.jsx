// Preview wrapper: the app mounts everything under ThemeProvider + CssBaseline
// (see src/main.jsx). Previews and designs built with these components need the
// same wrap or MUI falls back to the default light theme.
import { ThemeProvider } from "@mui/material/styles"
import { CssBaseline } from "@mui/material"
import { theme } from "../src/theme"

export function BeePEETheme({ children }) {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    )
}
