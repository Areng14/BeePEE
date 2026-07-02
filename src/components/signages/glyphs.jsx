// Portal-ish solid glyph library shared by the designer palette and canvas.
// Each entry is an array of SVG path `d` strings drawn in a single fill
// color on a 24x24 viewBox.

export const GLYPHS = {
    arrowUp: { label: "Arrow Up", paths: ["M12 3l7 8h-4v8h-6v-8H5z"] },
    arrowDown: { label: "Arrow Down", paths: ["M12 21l-7-8h4V5h6v8h4z"] },
    arrowLeft: { label: "Arrow Left", paths: ["M3 12l8-7v4h8v6h-8v4z"] },
    arrowRight: { label: "Arrow Right", paths: ["M21 12l-8 7v-4H5V9h8V5z"] },
    cube: {
        label: "Cube",
        paths: ["M12 2l8 4.5v9L12 20l-8-4.5v-9z", "M12 2v18M4 6.5l8 4.5 8-4.5"],
    },
    heart: {
        label: "Heart",
        paths: [
            "M12 21S3.5 15.4 3.5 9.6C3.5 6.9 5.6 5 8 5c1.7 0 3.1.9 4 2.3C12.9 5.9 14.3 5 16 5c2.4 0 4.5 1.9 4.5 4.6C20.5 15.4 12 21 12 21z",
        ],
    },
    sphere: { label: "Sphere", paths: ["M12 2a10 10 0 100 20 10 10 0 000-20z"] },
    triangle: {
        label: "Hazard",
        paths: ["M12 2l11 19H1z", "M11 9h2v6h-2zM11 16h2v2h-2z"],
    },
    check: {
        label: "Check",
        paths: ["M9 16.2l-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z"],
    },
    cross: {
        label: "Cross",
        paths: [
            "M18.3 5.7L12 12 5.7 5.7 4.3 7.1 10.6 13.4 4.3 19.7 5.7 21.1 12 14.8l6.3 6.3 1.4-1.4L13.4 13.4l6.3-6.3z",
        ],
    },
    star: {
        label: "Star",
        paths: ["M12 2l3 6.5 7 .8-5 4.8 1.3 7L12 18l-6.6 3.9 1.3-7-5-4.8 7-.8z"],
    },
    dot: { label: "Dot", paths: ["M12 8a4 4 0 100 8 4 4 0 000-8z"] },
    fizzler: {
        label: "Fizzler",
        paths: ["M5 4h3v16H5zM10.5 4h3v16h-3zM16 4h3v16h-3z"],
    },
    button: {
        label: "Button",
        paths: ["M12 5a5 5 0 015 5v2H7v-2a5 5 0 015-5z", "M4 15h16v3H4z"],
    },
    laser: {
        label: "Laser",
        paths: ["M2 11h20v2H2z", "M12 7a5 5 0 100 10 5 5 0 000-10z"],
    },
    diamond: { label: "Diamond", paths: ["M12 2l7 10-7 10-7-10z"] },
    plus: { label: "Plus", paths: ["M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"] },
    ring: {
        label: "Ring",
        paths: ["M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12z"],
    },
}

// Basic geometric primitives — also path-based so they share the renderer.
export const PRIMS = {
    square: { label: "Square", paths: ["M3 3h18v18H3z"] },
    rect: { label: "Rectangle", paths: ["M2 6h20v12H2z"] },
    circle: { label: "Circle", paths: ["M12 2a10 10 0 100 20 10 10 0 000-20z"] },
    tri: { label: "Triangle", paths: ["M12 3l9 18H3z"] },
    roundsq: {
        label: "Rounded",
        paths: [
            "M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3z",
        ],
    },
    bar: { label: "Bar", paths: ["M2 10h20v4H2z"] },
    pill: { label: "Pill", paths: ["M7 7h10a5 5 0 010 10H7A5 5 0 017 7z"] },
    diamondP: { label: "Diamond", paths: ["M12 2l10 10-10 10L2 12z"] },
    hexP: { label: "Hexagon", paths: ["M7 3h10l5 9-5 9H7l-5-9z"] },
    ringP: {
        label: "Ring",
        paths: ["M12 2a10 10 0 100 20 10 10 0 000-20zm0 5a5 5 0 110 10 5 5 0 010-10z"],
    },
}

export const SHAPES = { ...GLYPHS, ...PRIMS }

export function ShapeSvg({ id, color, w, h }) {
    const g = SHAPES[id]
    if (!g) return null
    return (
        <svg
            width={w}
            height={h ?? w}
            viewBox="0 0 24 24"
            fill={color}
            preserveAspectRatio="none"
            style={{ display: "block", width: w, height: h ?? w }}>
            {g.paths.map((d, i) => (
                <path key={i} d={d} />
            ))}
        </svg>
    )
}

// Locked output resolution for designed signage icons (square)
export const CANVAS_SIZE = 512

// Renders a layer stack as a small SVG thumbnail (same transform math as
// the designer canvas, so previews are exact).
export function LayersThumb({ layers, size, bg }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
            style={{ display: "block", background: bg || "transparent", borderRadius: 4 }}>
            {layers.map((l) => (
                <g
                    key={l.id}
                    transform={`translate(${l.x},${l.y}) rotate(${l.rot || 0} ${l.w / 2} ${l.h / 2})`}>
                    <svg
                        x={0}
                        y={0}
                        width={l.w}
                        height={l.h}
                        viewBox="0 0 24 24"
                        fill={l.color}
                        preserveAspectRatio="none">
                        {SHAPES[l.glyph].paths.map((d, i) => (
                            <path key={i} d={d} />
                        ))}
                    </svg>
                </g>
            ))}
        </svg>
    )
}

// Rasterize a layer stack to a PNG data URL at the locked 512x512 output
// size — WYSIWYG with the designer's white canvas.
export function rasterizeLayers(layers, size = CANVAS_SIZE) {
    const inner = layers
        .map((l) => {
            const paths = SHAPES[l.glyph].paths
                .map((d) => `<path d="${d}"/>`)
                .join("")
            return (
                `<g transform="translate(${l.x},${l.y}) rotate(${l.rot || 0} ${l.w / 2} ${l.h / 2})">` +
                `<svg x="0" y="0" width="${l.w}" height="${l.h}" viewBox="0 0 24 24" fill="${l.color}" preserveAspectRatio="none">${paths}</svg>` +
                `</g>`
            )
        })
        .join("")
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">` +
        `<rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="#ffffff"/>` +
        inner +
        `</svg>`

    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = size
            canvas.height = size
            canvas.getContext("2d").drawImage(img, 0, 0, size, size)
            resolve(canvas.toDataURL("image/png"))
        }
        img.onerror = reject
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
    })
}
