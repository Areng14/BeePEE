import { useState } from "react"
import { SignageInfo } from "beepee"

const availableSignages = [
    { id: "SIGN_BPEE_CAKE", name: "Cake" },
    { id: "SIGN_BPEE_ARROW_UP", name: "Arrow Up" },
    { id: "SIGN_BPEE_DANGER", name: "Danger" },
]

function Stateful({ initial, showId }: { initial: any; showId?: boolean }) {
    const [formData, setFormData] = useState(initial)
    return (
        <SignageInfo
            formData={formData}
            availableSignages={availableSignages}
            showId={showId}
            onUpdate={(field: string, value: any) =>
                setFormData((prev: any) => ({ ...prev, [field]: value }))
            }
        />
    )
}

export const SingleSign = () => (
    <Stateful
        showId
        initial={{
            id: "SIGN_BPEE_CAKE",
            name: "Cake",
            hidden: false,
            secondary: "",
            styles: {},
        }}
    />
)

export const DualSign = () => (
    <Stateful
        initial={{
            id: "SIGN_BPEE_ARROW_UP",
            name: "Arrow Up",
            hidden: false,
            secondary: "SIGN_BPEE_DANGER",
            styles: {},
        }}
    />
)

export const HiddenSecondary = () => (
    <Stateful
        initial={{
            id: "SIGN_BPEE_DANGER",
            name: "Danger",
            hidden: true,
            secondary: "",
            styles: {},
        }}
    />
)
