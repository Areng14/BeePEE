import { useState, useRef, useEffect, useCallback } from "react"
import {
    Dialog,
    Box,
    Typography,
    TextField,
    Button,
    IconButton,
    Slider,
    Tooltip,
    Stack,
    Divider,
} from "@mui/material"
import { useTheme } from "@mui/material/styles"
import { Close, ChevronLeft, ChevronRight } from "@mui/icons-material"
import { GLYPHS, PRIMS, SHAPES, ShapeSvg, LayersThumb, CANVAS_SIZE } from "./glyphs"

// Palette tabs — extensible: add a new entry to show another category.
const PALETTE_TABS = [
    { id: "glyphs", label: "Glyphs", icon: "star", ids: Object.keys(GLYPHS) },
    { id: "prims", label: "Primitives", icon: "square", ids: Object.keys(PRIMS) },
]
const DISPLAY = 300 // on-screen canvas size
const GRID_STEPS = [0, 4, 8, 12, 16, 24, 32] // 0 = None (snap off)
const CUSTOM_PRESET = ["#4caf50", "#e05c4a", "#4a90d9"] // extra presets after B/W + gold

let _lid = 0
const nextId = () => "L" + ++_lid
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// align tool icon (18x18): a gold guide edge + bars aligned to it
function AlignIcon({ type, gold, bar }) {
    const rc = (x, y, w, ht, fill, key) => (
        <rect key={key} x={x} y={y} width={w} height={ht} rx={0.6} fill={fill} />
    )
    let els
    if (type === "left")
        els = [rc(2, 2.5, 2, 13, gold, "g"), rc(5.5, 4.5, 9, 3.4, bar, "a"), rc(5.5, 9.6, 6, 3.4, bar, "b")]
    else if (type === "ch")
        els = [rc(8.6, 2.5, 1.6, 13, gold, "g"), rc(2.5, 4.5, 13, 3.4, bar, "a"), rc(5, 9.6, 8, 3.4, bar, "b")]
    else if (type === "right")
        els = [rc(14, 2.5, 2, 13, gold, "g"), rc(3.5, 4.5, 9, 3.4, bar, "a"), rc(6.5, 9.6, 6, 3.4, bar, "b")]
    else if (type === "top")
        els = [rc(2.5, 2, 13, 2, gold, "g"), rc(4.5, 5.5, 3.4, 9, bar, "a"), rc(9.6, 5.5, 3.4, 6, bar, "b")]
    else if (type === "mv")
        els = [rc(2.5, 8.6, 13, 1.6, gold, "g"), rc(4.5, 2.5, 3.4, 13, bar, "a"), rc(9.6, 5, 3.4, 8, bar, "b")]
    else
        els = [rc(2.5, 14, 13, 2, gold, "g"), rc(4.5, 3.5, 3.4, 9, bar, "a"), rc(9.6, 6.5, 3.4, 6, bar, "b")]
    return (
        <svg width={18} height={18} viewBox="0 0 18 18" style={{ display: "block" }}>
            {els}
        </svg>
    )
}

function NumField({ label, value, min, max, onChange }) {
    return (
        <TextField
            label={label}
            type="number"
            size="small"
            value={value}
            inputProps={{ min, max }}
            onChange={(e) => onChange(+e.target.value || 0)}
            fullWidth
        />
    )
}

function SignageDesigner({ initialName = "", onCancel, onSave }) {
    const theme = useTheme()
    const gold = theme.palette.primary.main

    const [name, setName] = useState(initialName)
    const [layers, setLayers] = useState([])
    const [sel, setSel] = useState(null)
    const [dropHint, setDropHint] = useState(false)
    const [snap, setSnap] = useState(true)
    const [gridN, setGridN] = useState(8)
    const [snapMenu, setSnapMenu] = useState(false)
    const [paletteTab, setPaletteTab] = useState("glyphs")
    const [paletteOpen, setPaletteOpen] = useState(true)
    const activePalette =
        PALETTE_TABS.find((t) => t.id === paletteTab) || PALETTE_TABS[0]
    const canvasRef = useRef(null)
    const op = useRef(null) // active transform: { type, id, ... }

    const cell = gridN > 0 ? CANVAS_SIZE / gridN : 0
    const selLayer = layers.find((l) => l.id === sel) || null

    const snapLayer = useCallback(
        (l, doSnap) => {
            if (!doSnap || !cell) return l
            const cx = Math.round((l.x + l.w / 2) / cell) * cell
            const cy = Math.round((l.y + l.h / 2) / cell) * cell
            return { ...l, x: cx - l.w / 2, y: cy - l.h / 2 }
        },
        [cell],
    )

    const updateSel = (fn) =>
        setLayers((ls) => ls.map((l) => (l.id === sel ? fn(l) : l)))

    const addLayer = useCallback(
        (glyph, x, y) => {
            const id = nextId()
            const size = snap && cell ? cell * 2 : 128
            let l = {
                id,
                glyph,
                x: x - size / 2,
                y: y - size / 2,
                w: size,
                h: size,
                color: gold,
                rot: 0,
            }
            l = snapLayer(l, snap)
            setLayers((ls) => [...ls, l])
            setSel(id)
        },
        [cell, snap, snapLayer, gold],
    )

    const toCanvas = (e) => {
        const r = canvasRef.current.getBoundingClientRect()
        const scale = CANVAS_SIZE / r.width
        return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale }
    }

    const onCanvasDrop = (e) => {
        e.preventDefault()
        setDropHint(false)
        const glyph = e.dataTransfer.getData("glyph")
        if (!glyph) return
        const p = toCanvas(e)
        addLayer(glyph, p.x, p.y)
    }

    const startMove = (e, l) => {
        e.stopPropagation()
        setSel(l.id)
        const p = toCanvas(e)
        op.current = { type: "move", id: l.id, dx: p.x - l.x, dy: p.y - l.y }
    }
    const startResize = (e, l, handle) => {
        e.stopPropagation()
        e.preventDefault()
        setSel(l.id)
        op.current = {
            type: "resize",
            id: l.id,
            handle,
            ax: handle.indexOf("l") >= 0 ? l.x + l.w : l.x,
            ay: handle.indexOf("t") >= 0 ? l.y + l.h : l.y,
        }
    }
    const startRotate = (e, l) => {
        e.stopPropagation()
        e.preventDefault()
        setSel(l.id)
        op.current = { type: "rotate", id: l.id }
    }

    useEffect(() => {
        const move = (e) => {
            const o = op.current
            if (!o) return
            const p = toCanvas(e)
            setLayers((ls) =>
                ls.map((l) => {
                    if (l.id !== o.id) return l
                    const doSnap = snap !== e.shiftKey // Shift temporarily inverts snapping
                    if (o.type === "move") {
                        const n = { ...l, x: p.x - o.dx, y: p.y - o.dy }
                        return doSnap ? snapLayer(n, true) : n
                    }
                    if (o.type === "rotate") {
                        const cx = l.x + l.w / 2
                        const cy = l.y + l.h / 2
                        let ang =
                            (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90
                        if (doSnap) ang = Math.round(ang / 15) * 15
                        return { ...l, rot: ((Math.round(ang) % 360) + 360) % 360 }
                    }
                    if (o.type === "resize") {
                        const hd = o.handle
                        let nw = l.w,
                            nh = l.h,
                            nx = l.x,
                            ny = l.y
                        if (hd.indexOf("l") >= 0 || hd.indexOf("r") >= 0) {
                            let w = clamp(Math.abs(p.x - o.ax), 24, CANVAS_SIZE)
                            if (doSnap && cell)
                                w = clamp(Math.round(w / cell) * cell, cell, CANVAS_SIZE)
                            nw = w
                            nx = hd.indexOf("l") >= 0 ? o.ax - w : o.ax
                        }
                        if (hd.indexOf("t") >= 0 || hd.indexOf("b") >= 0) {
                            let hh = clamp(Math.abs(p.y - o.ay), 24, CANVAS_SIZE)
                            if (doSnap && cell)
                                hh = clamp(Math.round(hh / cell) * cell, cell, CANVAS_SIZE)
                            nh = hh
                            ny = hd.indexOf("t") >= 0 ? o.ay - hh : o.ay
                        }
                        return { ...l, x: nx, y: ny, w: nw, h: nh }
                    }
                    return l
                }),
            )
        }
        const up = () => {
            op.current = null
        }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup", up)
        return () => {
            window.removeEventListener("mousemove", move)
            window.removeEventListener("mouseup", up)
        }
    }, [snap, snapLayer, cell])

    useEffect(() => {
        const onKey = (e) => {
            if (!sel) return
            const tag = (e.target.tagName || "").toLowerCase()
            if (tag === "input" || tag === "textarea") return
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault()
                removeSel()
            } else if (e.key.startsWith("Arrow")) {
                e.preventDefault()
                const d = snap && cell ? cell : e.shiftKey ? 10 : 2
                const dd = {
                    ArrowUp: [0, -d],
                    ArrowDown: [0, d],
                    ArrowLeft: [-d, 0],
                    ArrowRight: [d, 0],
                }[e.key]
                updateSel((l) => ({ ...l, x: l.x + dd[0], y: l.y + dd[1] }))
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sel, snap, cell])

    const removeSel = () => {
        setLayers((ls) => ls.filter((l) => l.id !== sel))
        setSel(null)
    }
    const dupSel = () => {
        if (!selLayer) return
        const id = nextId()
        setLayers((ls) => [
            ...ls,
            snapLayer(
                {
                    ...selLayer,
                    id,
                    x: selLayer.x + (cell || 20),
                    y: selLayer.y + (cell || 20),
                },
                snap,
            ),
        ])
        setSel(id)
    }
    const raise = (dir) =>
        setLayers((ls) => {
            const i = ls.findIndex((l) => l.id === sel)
            if (i < 0) return ls
            const j = dir > 0 ? ls.length - 1 : 0
            const copy = ls.slice()
            const [it] = copy.splice(i, 1)
            copy.splice(j, 0, it)
            return copy
        })
    const align = (kind) =>
        updateSel((l) => {
            const map = {
                left: { x: 0 },
                ch: { x: (CANVAS_SIZE - l.w) / 2 },
                right: { x: CANVAS_SIZE - l.w },
                top: { y: 0 },
                mv: { y: (CANVAS_SIZE - l.h) / 2 },
                bottom: { y: CANVAS_SIZE - l.h },
            }
            return snapLayer({ ...l, ...map[kind] }, snap)
        })

    const canSave = name.trim() && layers.length > 0
    const s = DISPLAY / CANVAS_SIZE
    const gridIdx = snap ? Math.max(0, GRID_STEPS.indexOf(gridN)) : 0

    const alignBtn = (kind, title) => (
        <Tooltip key={kind} title={title}>
            <Box
                component="button"
                disabled={!selLayer}
                onClick={() => selLayer && align(kind)}
                sx={{
                    width: 32,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "none",
                    borderRight: 1,
                    borderColor: "divider",
                    cursor: selLayer ? "pointer" : "not-allowed",
                    opacity: selLayer ? 1 : 0.35,
                    p: 0,
                }}>
                <AlignIcon type={kind} gold={gold} bar={theme.palette.text.primary} />
            </Box>
        </Tooltip>
    )

    const paletteCell = (id) => (
        <Box
            key={id}
            draggable
            title={SHAPES[id].label}
            onDragStart={(e) => e.dataTransfer.setData("glyph", id)}
            onDoubleClick={() => addLayer(id, CANVAS_SIZE / 2, CANVAS_SIZE / 2)}
            sx={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                cursor: "grab",
            }}>
            <ShapeSvg id={id} color={theme.palette.text.primary} w={24} />
        </Box>
    )

    return (
        <Dialog open onClose={onCancel} maxWidth={false}>
            <Box
                sx={{
                    width: 900,
                    maxWidth: "94vw",
                    height: 560,
                    maxHeight: "94vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}>
                {/* Title bar */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2,
                        py: 1.5,
                        borderBottom: 1,
                        borderColor: "divider",
                        bgcolor: "#232628",
                    }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                        Signage Designer
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton size="small" onClick={onCancel}>
                        <Close fontSize="small" />
                    </IconButton>
                </Box>

                {/* Body */}
                <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
                    {/* Palette */}
                    {paletteOpen ? (
                        <Box
                            sx={{
                                width: 176,
                                borderRight: 1,
                                borderColor: "divider",
                                bgcolor: "#232628",
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                            }}>
                            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, pt: 1.25, pl: 1.5, pr: 1 }}>
                                {PALETTE_TABS.map((tab) => {
                                    const on = paletteTab === tab.id
                                    return (
                                        <Box
                                            key={tab.id}
                                            component="button"
                                            onClick={() => setPaletteTab(tab.id)}
                                            sx={{
                                                flex: 1,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 0.6,
                                                py: 0.9,
                                                px: 0.5,
                                                cursor: "pointer",
                                                bgcolor: on ? "background.paper" : "transparent",
                                                border: 1,
                                                borderColor: on ? "divider" : "transparent",
                                                borderBottom: "none",
                                                borderTopLeftRadius: 6,
                                                borderTopRightRadius: 6,
                                                color: on ? "text.primary" : "text.disabled",
                                                fontSize: 11.5,
                                                fontWeight: 600,
                                                fontFamily: "inherit",
                                            }}>
                                            <ShapeSvg
                                                id={tab.icon}
                                                color={on ? gold : "currentColor"}
                                                w={14}
                                            />
                                            {tab.label}
                                        </Box>
                                    )
                                })}
                                <Tooltip title="Collapse palette">
                                    <IconButton size="small" onClick={() => setPaletteOpen(false)} sx={{ mb: "1px" }}>
                                        <ChevronLeft fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <Box
                                sx={{
                                    flex: 1,
                                    p: 1.5,
                                    overflowY: "auto",
                                    borderTop: 1,
                                    borderColor: "divider",
                                    mt: "-1px",
                                }}>
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                                    {activePalette.ids.map(paletteCell)}
                                </Box>
                                <Typography
                                    variant="caption"
                                    color="text.disabled"
                                    sx={{ display: "block", mt: 1.5, lineHeight: 1.5 }}>
                                    Drag onto canvas, or double-click to drop in center.
                                </Typography>
                            </Box>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                width: 40,
                                borderRight: 1,
                                borderColor: "divider",
                                bgcolor: "#232628",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                py: 1.25,
                            }}>
                            <Tooltip title="Expand palette">
                                <IconButton size="small" onClick={() => setPaletteOpen(true)}>
                                    <ChevronRight fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{
                                    writingMode: "vertical-rl",
                                    mt: 1.5,
                                    fontWeight: 700,
                                    letterSpacing: 1.5,
                                    textTransform: "uppercase",
                                    fontSize: 10.5,
                                }}>
                                Palette
                            </Typography>
                        </Box>
                    )}

                    {/* Canvas column */}
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            p: 1.75,
                            bgcolor: "background.default",
                            minWidth: 0,
                        }}>
                        {/* Toolbar */}
                        <Box
                            sx={{
                                alignSelf: "stretch",
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                                mb: 1.5,
                            }}>
                            <Box
                                sx={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    letterSpacing: 0.4,
                                    px: 1,
                                    py: 0.6,
                                    border: 1,
                                    borderColor: "divider",
                                    borderRadius: 1,
                                    bgcolor: "#232628",
                                    whiteSpace: "nowrap",
                                }}>
                                512 × 512
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    border: 1,
                                    borderColor: "#555",
                                    borderRadius: 1,
                                    overflow: "hidden",
                                }}>
                                {alignBtn("left", "Align left")}
                                {alignBtn("ch", "Center horizontally")}
                                {alignBtn("right", "Align right")}
                                <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "#555" }} />
                                {alignBtn("top", "Align top")}
                                {alignBtn("mv", "Center vertically")}
                                {alignBtn("bottom", "Align bottom")}
                            </Box>
                            <Box sx={{ flex: 1 }} />
                            {/* Snap control — toggle + density in one dropdown */}
                            <Box sx={{ position: "relative" }}>
                                <Button
                                    size="small"
                                    variant={snap ? "contained" : "outlined"}
                                    onClick={() => setSnapMenu((v) => !v)}
                                    sx={{ whiteSpace: "nowrap", px: 1.5 }}>
                                    Snap {snap ? `· ${gridN}×${gridN}` : "· off"}
                                    <Box component="span" sx={{ ml: 0.5, fontSize: 10 }}>
                                        {snapMenu ? "▴" : "▾"}
                                    </Box>
                                </Button>
                                {snapMenu && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: "calc(100% + 6px)",
                                            right: 0,
                                            width: 220,
                                            bgcolor: "background.paper",
                                            border: 1,
                                            borderColor: "#555",
                                            borderRadius: 2,
                                            boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                                            p: 1.75,
                                            zIndex: 5,
                                        }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                mb: 1,
                                            }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Grid density
                                            </Typography>
                                            <Typography variant="caption" fontWeight={600}>
                                                {gridIdx === 0 ? "None (off)" : `${gridN} × ${gridN}`}
                                            </Typography>
                                        </Box>
                                        <Slider
                                            size="small"
                                            min={0}
                                            max={GRID_STEPS.length - 1}
                                            step={1}
                                            value={gridIdx}
                                            onChange={(e, v) => {
                                                if (v === 0) setSnap(false)
                                                else {
                                                    setSnap(true)
                                                    setGridN(GRID_STEPS[v])
                                                }
                                            }}
                                        />
                                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                            <Typography variant="caption" color="text.disabled">
                                                No grid
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled">
                                                Fine
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Canvas */}
                        <Box
                            ref={canvasRef}
                            onMouseDown={() => {
                                setSel(null)
                                setSnapMenu(false)
                            }}
                            onDragOver={(e) => {
                                e.preventDefault()
                                setDropHint(true)
                            }}
                            onDragLeave={() => setDropHint(false)}
                            onDrop={onCanvasDrop}
                            sx={{
                                width: DISPLAY,
                                height: DISPLAY,
                                position: "relative",
                                borderRadius: 2,
                                background: "#ffffff",
                                backgroundImage: snap
                                    ? "linear-gradient(rgba(0,0,0,0.09) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.09) 1px,transparent 1px)"
                                    : "none",
                                backgroundSize: `${DISPLAY / (gridN || 8)}px ${DISPLAY / (gridN || 8)}px`,
                                border: dropHint ? `2px solid ${gold}` : "2px dashed #555",
                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                                overflow: "hidden",
                            }}>
                            {layers.length === 0 && !dropHint && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "rgba(0,0,0,0.4)",
                                        fontSize: 13,
                                        pointerEvents: "none",
                                        textAlign: "center",
                                        p: 3,
                                    }}>
                                    Drop glyphs here to compose your signage icon
                                </Box>
                            )}
                            {layers.map((l) => {
                                const active = l.id === sel
                                const handle = (hd, cursor, pos) => (
                                    <Box
                                        key={hd}
                                        onMouseDown={(e) => startResize(e, l, hd)}
                                        sx={{
                                            position: "absolute",
                                            width: 10,
                                            height: 10,
                                            bgcolor: "primary.main",
                                            border: "1.5px solid #1d1e1f",
                                            borderRadius: "2px",
                                            cursor,
                                            ...pos,
                                        }}
                                    />
                                )
                                return (
                                    <Box
                                        key={l.id}
                                        onMouseDown={(e) => startMove(e, l)}
                                        sx={{
                                            position: "absolute",
                                            left: l.x * s,
                                            top: l.y * s,
                                            width: l.w * s,
                                            height: l.h * s,
                                            transform: `rotate(${l.rot || 0}deg)`,
                                            cursor: "move",
                                        }}>
                                        <ShapeSvg id={l.glyph} color={l.color} w={l.w * s} h={l.h * s} />
                                        {active && (
                                            <>
                                                <Box
                                                    sx={{
                                                        position: "absolute",
                                                        inset: -2,
                                                        outline: `1.5px solid ${gold}`,
                                                        borderRadius: "3px",
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                                {handle("tl", "nwse-resize", { left: -5, top: -5 })}
                                                {handle("tr", "nesw-resize", { right: -5, top: -5 })}
                                                {handle("bl", "nesw-resize", { left: -5, bottom: -5 })}
                                                {handle("br", "nwse-resize", { right: -5, bottom: -5 })}
                                                {handle("t", "ns-resize", { left: "50%", top: -5, ml: "-5px" })}
                                                {handle("b", "ns-resize", { left: "50%", bottom: -5, ml: "-5px" })}
                                                {handle("l", "ew-resize", { top: "50%", left: -5, mt: "-5px" })}
                                                {handle("r", "ew-resize", { top: "50%", right: -5, mt: "-5px" })}
                                                <Box
                                                    sx={{
                                                        position: "absolute",
                                                        left: "50%",
                                                        top: -24,
                                                        width: "1.5px",
                                                        height: 18,
                                                        bgcolor: "primary.main",
                                                        transform: "translateX(-50%)",
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                                <Tooltip title="Rotate">
                                                    <Box
                                                        onMouseDown={(e) => startRotate(e, l)}
                                                        sx={{
                                                            position: "absolute",
                                                            left: "50%",
                                                            top: -34,
                                                            width: 12,
                                                            height: 12,
                                                            ml: "-6px",
                                                            borderRadius: "50%",
                                                            bgcolor: "primary.main",
                                                            border: "1.5px solid #1d1e1f",
                                                            cursor: "grab",
                                                        }}
                                                    />
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                )
                            })}
                        </Box>
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5 }}>
                            {layers.length} layer{layers.length === 1 ? "" : "s"} ·{" "}
                            {snap ? `snapping to ${gridN}×${gridN} grid` : "free placement"}
                        </Typography>
                    </Box>

                    {/* Properties */}
                    <Box
                        sx={{
                            width: 210,
                            borderLeft: 1,
                            borderColor: "divider",
                            p: 1.75,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                        }}>
                        <Box>
                            <Typography
                                variant="subtitle2"
                                fontWeight={600}
                                sx={{ mb: 1 }}>
                                Name
                            </Typography>
                            <TextField
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Reflection Cube"
                                autoFocus
                                size="small"
                                fullWidth
                                helperText="ID generated automatically"
                            />
                        </Box>
                        <Divider />
                        {selLayer ? (
                            <Stack spacing={1.75}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Transform · {SHAPES[selLayer.glyph].label}
                                </Typography>
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
                                    <NumField
                                        label="Width"
                                        value={Math.round(selLayer.w)}
                                        min={24}
                                        max={CANVAS_SIZE}
                                        onChange={(v) =>
                                            updateSel((l) =>
                                                snapLayer({ ...l, w: clamp(v, 24, CANVAS_SIZE) }, snap),
                                            )
                                        }
                                    />
                                    <NumField
                                        label="Height"
                                        value={Math.round(selLayer.h)}
                                        min={24}
                                        max={CANVAS_SIZE}
                                        onChange={(v) =>
                                            updateSel((l) =>
                                                snapLayer({ ...l, h: clamp(v, 24, CANVAS_SIZE) }, snap),
                                            )
                                        }
                                    />
                                </Box>
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, alignItems: "end" }}>
                                    <NumField
                                        label="Rotate°"
                                        value={Math.round(selLayer.rot || 0)}
                                        min={0}
                                        max={359}
                                        onChange={(v) =>
                                            updateSel((l) => ({
                                                ...l,
                                                rot: ((v % 360) + 360) % 360,
                                            }))
                                        }
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() =>
                                            updateSel((l) => snapLayer({ ...l, h: l.w }, snap))
                                        }
                                        sx={{ fontSize: 11.5, px: 0.5 }}>
                                        Make square
                                    </Button>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                                        Color
                                    </Typography>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                                        {["#000000", "#ffffff", gold, ...CUSTOM_PRESET].map((c) => {
                                            const on =
                                                (selLayer.color || "").toLowerCase() === c.toLowerCase()
                                            return (
                                                <Box
                                                    key={c}
                                                    title={c}
                                                    onClick={() =>
                                                        updateSel((l) => ({ ...l, color: c }))
                                                    }
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: "5px",
                                                        background: c,
                                                        cursor: "pointer",
                                                        border: on
                                                            ? `2px solid ${gold}`
                                                            : "1px solid #555",
                                                        boxSizing: "border-box",
                                                    }}
                                                />
                                            )
                                        })}
                                        {(() => {
                                            const presets = ["#000000", "#ffffff", gold, ...CUSTOM_PRESET].map(
                                                (x) => x.toLowerCase(),
                                            )
                                            const isCustom =
                                                selLayer.color &&
                                                presets.indexOf(selLayer.color.toLowerCase()) < 0
                                            return (
                                                <Box
                                                    component="label"
                                                    title="Custom color"
                                                    sx={{
                                                        position: "relative",
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: "5px",
                                                        cursor: "pointer",
                                                        overflow: "hidden",
                                                        boxSizing: "border-box",
                                                        border: isCustom
                                                            ? `2px solid ${gold}`
                                                            : "1px solid #555",
                                                        background: isCustom
                                                            ? selLayer.color
                                                            : "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                                                    }}>
                                                    <input
                                                        type="color"
                                                        value={
                                                            selLayer.color &&
                                                            selLayer.color[0] === "#" &&
                                                            selLayer.color.length === 7
                                                                ? selLayer.color
                                                                : "#d2b019"
                                                        }
                                                        onChange={(e) => {
                                                            const v = e.target.value
                                                            updateSel((l) => ({ ...l, color: v }))
                                                        }}
                                                        style={{
                                                            position: "absolute",
                                                            inset: 0,
                                                            opacity: 0,
                                                            cursor: "pointer",
                                                            border: "none",
                                                            padding: 0,
                                                        }}
                                                    />
                                                </Box>
                                            )
                                        })()}
                                    </Box>
                                </Box>
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                                    <Button variant="outlined" size="small" onClick={() => raise(1)}>
                                        Front
                                    </Button>
                                    <Button variant="outlined" size="small" onClick={() => raise(-1)}>
                                        Back
                                    </Button>
                                    <Button variant="outlined" size="small" onClick={dupSel}>
                                        Duplicate
                                    </Button>
                                    <Button variant="outlined" size="small" color="error" onClick={removeSel}>
                                        Delete
                                    </Button>
                                </Box>
                            </Stack>
                        ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.6 }}>
                                No layer selected. Drag a glyph from the palette, then use
                                the handles to move, resize and rotate it.
                            </Typography>
                        )}
                        <Box sx={{ flex: 1 }} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                                Preview
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Box sx={{ p: 0.75, bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: 1 }}>
                                    <LayersThumb layers={layers} size={56} bg="#ffffff" />
                                </Box>
                                <Box sx={{ p: 0.75, bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: 1 }}>
                                    <LayersThumb layers={layers} size={32} bg="#ffffff" />
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Footer */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 1.25,
                        px: 2,
                        py: 1.5,
                        borderTop: 1,
                        borderColor: "divider",
                        bgcolor: "#232628",
                    }}>
                    <Button variant="outlined" onClick={onCancel} sx={{ minWidth: 84 }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!canSave}
                        onClick={() => onSave({ name: name.trim(), layers })}
                        sx={{ minWidth: 84 }}>
                        Save Signage
                    </Button>
                </Box>
            </Box>
        </Dialog>
    )
}

export default SignageDesigner
