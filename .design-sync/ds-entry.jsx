// Curated design-sync bundle entry for BeePEE (an Electron app, not a library).
// Exports only the signage editor surface plus the wrappers needed to render it
// outside Electron. This file is the source of truth for what syncs to Claude Design.
export { default as SignageEditor } from "../src/components/SignageEditor"
export { default as SignageInfo } from "../src/components/signages/Info"
export { default as SignageStyles } from "../src/components/signages/Styles"
export { default as AddSignageDialog } from "../src/components/signages/AddSignageDialog"
export { default as SignageDesigner } from "../src/components/signages/SignageDesigner"
export { SignageProvider, useSignageContext } from "../src/contexts/SignageContext"
export { theme } from "../src/theme"
export { BeePEETheme } from "./mock-providers"
