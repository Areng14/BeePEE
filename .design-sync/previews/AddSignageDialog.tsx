import { AddSignageDialog } from "beepee"

// Rendered open - the dialog is the whole card (cardMode: single).
// Create stays disabled until a name is typed; the picker requires
// Electron so the empty dropzone state is the honest static render.
export const NewSignage = () => (
    <AddSignageDialog open onClose={() => {}} />
)
