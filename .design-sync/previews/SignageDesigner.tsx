import { SignageDesigner } from "beepee"

// The drag-and-drop icon designer, open on its empty 512x512 canvas -
// palette (Glyphs/Primitives tabs), align toolbar, snap control, and the
// properties column are all visible in this state.
export const Designer = () => (
    <SignageDesigner onCancel={() => {}} onSave={() => {}} />
)
