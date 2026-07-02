import { useState } from "react"
import { SignageStyles } from "beepee"

function Stateful({ initialStyles }: { initialStyles: any }) {
    const [formData, setFormData] = useState({ styles: initialStyles })
    return (
        <SignageStyles
            formData={formData}
            onUpdate={(field: string, value: any) =>
                setFormData((prev: any) => ({ ...prev, [field]: value }))
            }
        />
    )
}

export const WithStyles = () => (
    <Stateful
        initialStyles={{
            BEE2_CLEAN: { icon: "signage/bpee/cake_clean.png" },
            BEE2_1950s: { icon: "signage/bpee/cake_50s.png" },
        }}
    />
)

export const Empty = () => <Stateful initialStyles={{}} />
