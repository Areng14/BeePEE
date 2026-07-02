import { useEffect } from "react"
import { SignageEditor, SignageProvider, useSignageContext } from "beepee"

// In the app, the signage arrives over Electron IPC ("load-signage").
// Previews seed the same context with realistic data instead.
const sampleSignage = {
    id: "SIGN_BPEE_CAKE",
    name: "Cake",
    hidden: false,
    secondary: "",
    styles: {
        BEE2_CLEAN: { icon: "signage/bpee/cake_clean.png" },
        BEE2_1950s: { icon: "signage/bpee/cake_50s.png" },
    },
}

function SeedSignage({ signage }: { signage: any }) {
    const { setSignage } = useSignageContext()
    useEffect(() => {
        setSignage(signage)
    }, [])
    return null
}

export const EditorWindow = () => (
    <SignageProvider>
        <SeedSignage signage={sampleSignage} />
        <SignageEditor />
    </SignageProvider>
)
