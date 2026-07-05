import { useState, useEffect, useCallback } from "react"
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Checkbox,
    Chip,
    Stack,
    CircularProgress,
    Alert,
    Divider,
    Tooltip,
    Snackbar,
} from "@mui/material"
import {
    Inventory2 as ItemsIcon,
    Image as SignagesIcon,
    Download,
} from "@mui/icons-material"

// One selectable row (item or signage) with icon + name + id
function ImportRow({ entry, checked, onToggle }) {
    return (
        <Box
            onClick={() => !entry.exists && onToggle(entry.id)}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 0.5,
                pr: 1,
                borderRadius: 1,
                cursor: entry.exists ? "default" : "pointer",
                opacity: entry.exists ? 0.5 : 1,
                "&:hover": entry.exists
                    ? {}
                    : { bgcolor: "action.hover" },
            }}>
            <Checkbox
                size="small"
                checked={checked}
                disabled={entry.exists}
                sx={{ p: 0.5 }}
            />
            <Box
                sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 0.75,
                    bgcolor: "background.default",
                    border: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                }}>
                {entry.icon ? (
                    <img
                        src={entry.icon}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                        }}
                    />
                ) : (
                    <ItemsIcon
                        sx={{ fontSize: 18, color: "text.disabled" }}
                    />
                )}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                    {entry.name}
                </Typography>
                <Typography
                    variant="caption"
                    color="text.disabled"
                    noWrap
                    sx={{ display: "block", fontFamily: "ui-monospace, Consolas, monospace" }}>
                    {entry.id}
                </Typography>
            </Box>
            {entry.exists && (
                <Tooltip title="This ID already exists in the current package">
                    <Chip
                        label="already here"
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: 11 }}
                    />
                </Tooltip>
            )}
        </Box>
    )
}

function ImportSection({ title, icon, entries, selected, setSelected }) {
    if (!entries.length) return null
    const selectable = entries.filter((e) => !e.exists)
    const allSelected =
        selectable.length > 0 &&
        selectable.every((e) => selected.has(e.id))

    const toggle = (id) =>
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const toggleAll = () =>
        setSelected((prev) => {
            const next = new Set(prev)
            if (allSelected) selectable.forEach((e) => next.delete(e.id))
            else selectable.forEach((e) => next.add(e.id))
            return next
        })

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.5,
                }}>
                <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={
                        !allSelected &&
                        selectable.some((e) => selected.has(e.id))
                    }
                    disabled={!selectable.length}
                    onChange={toggleAll}
                    sx={{ p: 0.5 }}
                />
                {icon}
                <Typography variant="subtitle2" fontWeight={600}>
                    {title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {selectable.length
                        ? `${[...selected].filter((id) => entries.some((e) => e.id === id)).length}/${selectable.length} selected`
                        : "all already in this package"}
                </Typography>
            </Box>
            <Stack spacing={0.25} sx={{ pl: 1 }}>
                {entries.map((e) => (
                    <ImportRow
                        key={e.id}
                        entry={e}
                        checked={selected.has(e.id)}
                        onToggle={toggle}
                    />
                ))}
            </Stack>
        </Box>
    )
}

// The Item Importer: File > Import from Package... opens it, the backend
// extracts the picked .bpee, and the user checks what to bring in.
function ImportItemsDialog() {
    const [open, setOpen] = useState(false)
    const [phase, setPhase] = useState("loading") // loading | pick | importing
    const [manifest, setManifest] = useState(null) // { sourceName, items, signages }
    const [selected, setSelected] = useState(new Set())
    const [error, setError] = useState(null)
    const [result, setResult] = useState(null) // toast after success

    const browse = useCallback(async () => {
        setPhase("loading")
        setError(null)
        setManifest(null)
        setSelected(new Set())
        try {
            const r = await window.package.importItemsBrowse()
            if (!r?.success) {
                setError(r?.error || "Failed to read that package")
                setPhase("pick")
                return
            }
            if (r.canceled) {
                setOpen(false)
                return
            }
            setManifest(r)
            setPhase("pick")
        } catch (err) {
            setError(err.message)
            setPhase("pick")
        }
    }, [])

    useEffect(() => {
        window.package.onOpenImportItems?.(() => {
            setOpen(true)
            browse()
        })
        return () => window.package.onOpenImportItems?.(null)
    }, [browse])

    const handleClose = () => {
        if (phase === "importing") return
        window.package.importItemsCancel?.().catch?.(() => {})
        setOpen(false)
    }

    const handleImport = async () => {
        if (!manifest) return
        setPhase("importing")
        setError(null)
        try {
            const itemIds = (manifest.items || [])
                .filter((e) => selected.has(e.id))
                .map((e) => e.id)
            const signageIds = (manifest.signages || [])
                .filter((e) => selected.has(e.id))
                .map((e) => e.id)
            const r = await window.package.importItemsExecute({
                itemIds,
                signageIds,
            })
            if (!r?.success) {
                setError(r?.error || "Import failed")
                setPhase("pick")
                return
            }
            setResult(r)
            setOpen(false)
        } catch (err) {
            setError(err.message)
            setPhase("pick")
        }
    }

    const selectedCount = selected.size
    const nothingToImport =
        manifest &&
        !(manifest.items || []).length &&
        !(manifest.signages || []).length

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth>
                <DialogTitle>
                    Import from Package
                    {manifest?.sourceName ? ` — ${manifest.sourceName}` : ""}
                </DialogTitle>
                <DialogContent dividers sx={{ maxHeight: "60vh" }}>
                    {phase === "loading" ? (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                justifyContent: "center",
                                p: 4,
                            }}>
                            <CircularProgress size={22} />
                            <Typography variant="body2" color="text.secondary">
                                Reading package...
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={2}>
                            {error && (
                                <Alert
                                    severity="error"
                                    onClose={() => setError(null)}>
                                    {error}
                                </Alert>
                            )}
                            {nothingToImport && (
                                <Alert severity="info">
                                    That package has no items or signages.
                                </Alert>
                            )}
                            {manifest && (
                                <>
                                    <ImportSection
                                        title="Items"
                                        icon={
                                            <ItemsIcon
                                                sx={{
                                                    fontSize: 18,
                                                    color: "text.secondary",
                                                }}
                                            />
                                        }
                                        entries={manifest.items || []}
                                        selected={selected}
                                        setSelected={setSelected}
                                    />
                                    {!!(manifest.items || []).length &&
                                        !!(manifest.signages || []).length && (
                                            <Divider />
                                        )}
                                    <ImportSection
                                        title="Signages"
                                        icon={
                                            <SignagesIcon
                                                sx={{
                                                    fontSize: 18,
                                                    color: "text.secondary",
                                                }}
                                            />
                                        }
                                        entries={manifest.signages || []}
                                        selected={selected}
                                        setSelected={setSelected}
                                    />
                                </>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="outlined"
                        onClick={handleClose}
                        disabled={phase === "importing"}
                        sx={{ minWidth: 80 }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleImport}
                        disabled={
                            phase !== "pick" || !selectedCount || !manifest
                        }
                        startIcon={
                            phase === "importing" ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                <Download />
                            )
                        }
                        sx={{ minWidth: 120 }}>
                        {phase === "importing"
                            ? "Importing..."
                            : `Import${selectedCount ? ` (${selectedCount})` : ""}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Success toast */}
            <Snackbar
                open={!!result}
                autoHideDuration={5000}
                onClose={(e, reason) => {
                    if (reason !== "clickaway") setResult(null)
                }}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}>
                <Alert
                    severity="success"
                    variant="filled"
                    onClose={() => setResult(null)}
                    sx={{ boxShadow: 4 }}>
                    {(() => {
                        if (!result) return ""
                        const parts = []
                        if (result.imported?.items)
                            parts.push(
                                `${result.imported.items} item${result.imported.items === 1 ? "" : "s"}`,
                            )
                        if (result.imported?.signages)
                            parts.push(
                                `${result.imported.signages} signage${result.imported.signages === 1 ? "" : "s"}`,
                            )
                        const skippedCount =
                            (result.skipped?.items?.length || 0) +
                            (result.skipped?.signages?.length || 0)
                        let msg = parts.length
                            ? `Imported ${parts.join(" and ")}`
                            : "Nothing imported"
                        if (skippedCount)
                            msg += ` (${skippedCount} already existed)`
                        return msg
                    })()}
                </Alert>
            </Snackbar>
        </>
    )
}

export default ImportItemsDialog
