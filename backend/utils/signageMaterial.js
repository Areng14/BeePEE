// Generates the in-game Source material for a designer-made signage: one VTF
// and a VMT in resources/materials/signage/, in the exact format stock BEE2
// signage uses. The texture is opaque (white backplate + artwork); its ALPHA
// channel is the self-illum mask — Source's $selfillum without an explicit
// $selfillummask glows wherever the base texture's alpha is bright, which is
// how the stock signs get their lit white plate with dark artwork.
const fs = require("fs")
const path = require("path")
const { convertImageToVTF } = require("./vtfConverter.js")

function writeDataUrlPng(dataUrl, filePath) {
    const b64 = String(dataUrl).split(",")[1]
    fs.writeFileSync(filePath, Buffer.from(b64, "base64"))
}

// Mirrors the stock signage VMTs (e.g. signage/invis1.vmt): LightmappedGeneric
// decal, NO $translucent (alpha is the glow mask, not transparency), and
// $selfillum with no mask so the base alpha drives the glow.
// opts: { glowIntensity: 0-100 }
function buildSignageVMT(signageId, hasGlow, opts = {}) {
    const tex = `signage/${signageId.toLowerCase()}`
    // Property set mirrors the canonical BEE2 signage package's VMTs
    // ($nodecal keeps bullet holes off the sign)
    const lines = [
        '"LightmappedGeneric"',
        "{",
        `\t"$basetexture" "${tex}"`,
        '\t"$surfaceprop" "glass"',
        '\t"$nodecal" 1',
    ]
    if (hasGlow) {
        lines.push('\t"$selfillum" 1')
        const intensity =
            typeof opts.glowIntensity === "number"
                ? Math.max(0, Math.min(100, opts.glowIntensity)) / 100
                : 1
        if (intensity !== 1) {
            const t = intensity.toFixed(3)
            lines.push(`\t"$selfillumtint" "[${t} ${t} ${t}]"`)
        }
    }
    lines.push('\t"%nopaint" 1')
    lines.push('\t"%noportal" 1')
    lines.push('\t"%keywords" "portal2"')
    lines.push("}")
    return lines.join("\n") + "\n"
}

/**
 * @param {object} args
 * @param {string} args.packageDir  Package root
 * @param {string} args.signageId   Texture name (lowercased for filenames)
 * @param {string} args.baseData    data-URL PNG: the sign image (opaque)
 * @param {string} [args.maskData]  data-URL PNG: grayscale glow mask, joined
 *                                  in as the texture's alpha channel (sent
 *                                  separately because canvas premultiplies —
 *                                  alpha 0 would black out the RGB)
 * @param {object} [args.options]   { glowIntensity, glow } — glow: false
 *                                  omits $selfillum from the VMT
 * @returns {Promise<{vtf:string, vmt:string, hasGlow:boolean}>}
 */
async function generateSignageMaterial({
    packageDir,
    signageId,
    baseData,
    maskData,
    options = {},
}) {
    const id = signageId.toLowerCase()
    const matDir = path.join(packageDir, "resources", "materials", "signage")
    fs.mkdirSync(matDir, { recursive: true })
    const tmpDir = path.join(packageDir, ".bpee", "tempmat")
    fs.mkdirSync(tmpDir, { recursive: true })

    const baseTmp = path.join(tmpDir, `${id}_base.png`)
    writeDataUrlPng(baseData, baseTmp)

    // Join the grayscale mask into the alpha channel (straight alpha —
    // sharp keeps the RGB intact where the mask is 0)
    if (maskData) {
        const maskTmp = path.join(tmpDir, `${id}_mask.png`)
        writeDataUrlPng(maskData, maskTmp)
        const sharp = require("sharp")
        const meta = await sharp(baseTmp).metadata()
        const alpha = await sharp(maskTmp)
            .resize(meta.width, meta.height, { fit: "fill" })
            .extractChannel(0)
            .raw()
            .toBuffer()
        // Two separate pipelines: sharp applies ops in ITS order, not call
        // order — removeAlpha + joinChannel in one pipeline strips the
        // joined mask again
        const rgb = await sharp(baseTmp).removeAlpha().png().toBuffer()
        const combined = await sharp(rgb)
            .joinChannel(alpha, {
                raw: { width: meta.width, height: meta.height, channels: 1 },
            })
            .png()
            .toBuffer()
        fs.writeFileSync(baseTmp, combined)
        try {
            fs.unlinkSync(maskTmp)
        } catch {
            /* ignore */
        }
    }

    const baseVtf = path.join(matDir, `${id}.vtf`)
    // DXT5 keeps the 8-bit alpha channel (the glow mask); mips like the
    // stock signage VTFs so signs don't shimmer at a distance
    await convertImageToVTF(baseTmp, baseVtf, {
        format: "DXT5",
        skipVMT: true,
        mips: true,
    })

    const hasGlow = options.glow !== false
    const vmtPath = path.join(matDir, `${id}.vmt`)
    fs.writeFileSync(vmtPath, buildSignageVMT(signageId, hasGlow, options))

    // Clean up: temp png, plus any separate mask texture from the older
    // (incorrect) two-texture format so re-saves don't leave stale files
    try {
        fs.unlinkSync(baseTmp)
    } catch {
        /* ignore temp cleanup failure */
    }
    try {
        const oldMask = path.join(matDir, `${id}_selfillummask.vtf`)
        if (fs.existsSync(oldMask)) fs.unlinkSync(oldMask)
    } catch {
        /* ignore */
    }

    return { vtf: baseVtf, vmt: vmtPath, hasGlow }
}

module.exports = { generateSignageMaterial, buildSignageVMT }
