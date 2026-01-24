// VMF Atlas - Merge multiple VMF instances into a single grid layout
const fs = require("fs")
const path = require("path")
const { isDev } = require("./isDev.js")

/**
 * Get the path to the VMF merge executable
 * @returns {string} Path to merge.exe
 */
function getMergeExePath() {
    const bundledExe = isDev
        ? path.join(__dirname, "..", "libs", "areng_vmfMerge", "merge.exe")
        : path.join(
              process.resourcesPath,
              "extraResources",
              "areng_vmfMerge",
              "merge.exe",
          )

    console.log("🔍 Checking for bundled merge.exe at:", bundledExe)
    console.log("   Exists?", fs.existsSync(bundledExe))

    if (fs.existsSync(bundledExe)) {
        console.log("✅ Using bundled merge.exe:", bundledExe)
        return bundledExe
    }

    // Fallback error - we need the exe
    throw new Error(
        `VMF merge executable not found at: ${bundledExe}. Please ensure it is properly packaged.`,
    )
}

/**
 * Calculate grid dimensions for N items (tries to make it roughly square)
 * @param {number} count - Number of items to arrange
 * @returns {{cols: number, rows: number}}
 */
function calculateGridDimensions(count) {
    const cols = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / cols)
    return { cols, rows }
}

/**
 * Get bounding box of a VMF file from text content
 * @param {string} vmfContent - VMF file content as text
 * @returns {{minX, maxX, minY, maxY, minZ, maxZ, width, height, depth}}
 */
function getVMFBoundsFromText(vmfContent) {
    let minX = Infinity,
        maxX = -Infinity
    let minY = Infinity,
        maxY = -Infinity
    let minZ = Infinity,
        maxZ = -Infinity

    // Find all "origin" lines in VMF
    const originRegex = /"origin"\s+"([^"]+)"/g
    let match

    while ((match = originRegex.exec(vmfContent)) !== null) {
        const [x, y, z] = match[1].split(" ").map(parseFloat)
        if (!isNaN(x)) {
            minX = Math.min(minX, x)
            maxX = Math.max(maxX, x)
        }
        if (!isNaN(y)) {
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)
        }
        if (!isNaN(z)) {
            minZ = Math.min(minZ, z)
            maxZ = Math.max(maxZ, z)
        }
    }

    // Also check plane coordinates for brushes
    const planeRegex = /"plane"\s+"\(([^)]+)\)\s+\(([^)]+)\)\s+\(([^)]+)\)"/g
    while ((match = planeRegex.exec(vmfContent)) !== null) {
        for (let i = 1; i <= 3; i++) {
            const [x, y, z] = match[i].split(" ").map(parseFloat)
            if (!isNaN(x)) {
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
            }
            if (!isNaN(y)) {
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
            }
            if (!isNaN(z)) {
                minZ = Math.min(minZ, z)
                maxZ = Math.max(maxZ, z)
            }
        }
    }

    // If no coordinates found, use default bounds
    if (!isFinite(minX)) {
        return {
            minX: 0,
            maxX: 128,
            minY: 0,
            maxY: 128,
            minZ: 0,
            maxZ: 128,
            width: 128,
            height: 128,
            depth: 128,
        }
    }

    return {
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
        width: maxX - minX,
        height: maxY - minY,
        depth: maxZ - minZ,
    }
}

/**
 * Offset all coordinates in VMF text content
 * @param {string} vmfContent - VMF file content as text
 * @param {number} offsetX - X offset
 * @param {number} offsetY - Y offset
 * @param {number} offsetZ - Z offset
 * @returns {string} Modified VMF content
 */
function offsetVMFText(vmfContent, offsetX, offsetY, offsetZ) {
    let result = vmfContent

    // Offset "origin" properties
    result = result.replace(/"origin"\s+"([^"]+)"/g, (match, coords) => {
        const parts = coords.split(" ").map(parseFloat)
        if (parts.length >= 3 && !parts.some(isNaN)) {
            const newX = parts[0] + offsetX
            const newY = parts[1] + offsetY
            const newZ = parts[2] + offsetZ
            return `"origin" "${newX} ${newY} ${newZ}"`
        }
        return match
    })

    // Offset "plane" properties - format: "plane" "(x y z) (x y z) (x y z)"
    result = result.replace(
        /"plane"\s+"\(([^)]+)\)\s+\(([^)]+)\)\s+\(([^)]+)\)"/g,
        (match, p1, p2, p3) => {
            const offsetPoint = (pointStr) => {
                const parts = pointStr.split(" ").map(parseFloat)
                if (parts.length >= 3 && !parts.some(isNaN)) {
                    return `${parts[0] + offsetX} ${parts[1] + offsetY} ${parts[2] + offsetZ}`
                }
                return pointStr
            }

            return `"plane" "(${offsetPoint(p1)}) (${offsetPoint(p2)}) (${offsetPoint(p3)})"`
        },
    )

    return result
}

/**
 * Merge multiple VMF files into a single VMF with grid layout
 * Uses Python srctools for proper texture locking
 * @param {Array<{path: string, name: string}>} vmfFiles - Array of VMF file info
 * @param {string} outputPath - Where to save the merged VMF
 * @param {Object} options - Options
 * @returns {Promise<{success: boolean, gridLayout: Array, bounds: Object}>}
 */
async function mergeVMFsIntoGrid(vmfFiles, outputPath, options = {}) {
    const spacing = options.spacing || 384 // Default spacing between models (very large gap for clean splitting)

    console.log(`📐 Merging ${vmfFiles.length} VMF files into grid layout...`)

    // Validate VMF files exist
    const validFiles = []
    for (const file of vmfFiles) {
        if (!fs.existsSync(file.path)) {
            console.warn(`⚠️  VMF file not found: ${file.path}`)
            continue
        }

        // Validate VMF doesn't have NaN values
        const content = fs.readFileSync(file.path, "utf-8")
        if (content.includes("NaN")) {
            console.error(
                `  ❌ VMF contains NaN values: ${file.name} (skipping)`,
            )
            continue
        }

        validFiles.push(file)
    }

    if (validFiles.length === 0) {
        throw new Error("No valid VMF files could be found")
    }

    // Use bundled merge executable with srctools for proper texture locking
    const { spawn } = require("child_process")
    const mergeExePath = getMergeExePath()

    // Create JSON config for merge script
    const configPath = outputPath.replace(".vmf", "_merge_config.json")
    const config = {
        inputs: validFiles.map((f) => f.path),
        output: outputPath,
        spacing: spacing,
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    console.log(`  ⚙️  Running bundled merge executable with texture locking...`)

    // Run merge executable
    return new Promise((resolve, reject) => {
        const mergeProcess = spawn(mergeExePath, ["--json", configPath], {
            cwd: path.dirname(mergeExePath),
            windowsHide: true,
        })

        let stdout = ""
        let stderr = ""

        mergeProcess.stdout.on("data", (data) => {
            const output = data.toString()
            stdout += output
            // Forward merge output to console
            output.split("\n").forEach((line) => {
                if (line.trim()) console.log(`    ${line}`)
            })
        })

        mergeProcess.stderr.on("data", (data) => {
            stderr += data.toString()
        })

        mergeProcess.on("close", (code) => {
            // Clean up config file
            try {
                if (fs.existsSync(configPath)) fs.unlinkSync(configPath)
            } catch (e) {}

            if (code !== 0) {
                console.error(`  ❌ VMF merge failed with code ${code}`)
                if (stderr) console.error(stderr)
                return reject(
                    new Error(`VMF merge failed: ${stderr || "Unknown error"}`),
                )
            }

            // Parse result from merge output (last line should be JSON)
            const lines = stdout.trim().split("\n")
            const lastLine = lines[lines.length - 1]

            try {
                const result = JSON.parse(lastLine)

                // Load the layout JSON file created by Python
                const layoutPath = outputPath.replace(".vmf", "_layout.json")
                if (!fs.existsSync(layoutPath)) {
                    throw new Error("Layout file not created by merge script")
                }

                const layoutData = JSON.parse(
                    fs.readFileSync(layoutPath, "utf-8"),
                )

                // Map the layout to our expected format
                const gridLayout = layoutData.layout.map((item) => ({
                    name: item.name,
                    index: item.index,
                    col: item.col,
                    row: item.row,
                    cellX: item.cellX,
                    cellY: item.cellY,
                    offsetX: item.offsetX,
                    offsetY: item.offsetY,
                    offsetZ: item.offsetZ,
                    bounds: {
                        minX: item.bounds.minX,
                        maxX: item.bounds.maxX,
                        minY: item.bounds.minY,
                        maxY: item.bounds.maxY,
                        minZ: item.bounds.minZ,
                        maxZ: item.bounds.maxZ,
                    },
                }))

                console.log(`✅ Merged VMF saved to: ${outputPath}`)
                console.log(
                    `   Grid: ${layoutData.cols}×${layoutData.rows}, Cell size: ${Math.round(layoutData.cellSize)} (square)`,
                )

                resolve({
                    success: true,
                    gridLayout,
                    bounds: {
                        cols: layoutData.cols,
                        rows: layoutData.rows,
                        cellSize: layoutData.cellSize,
                        totalWidth: layoutData.cols * layoutData.cellSize,
                        totalHeight: layoutData.rows * layoutData.cellSize,
                    },
                })
            } catch (parseError) {
                console.error(
                    `  ❌ Failed to parse merge result:`,
                    parseError.message,
                )
                reject(
                    new Error(
                        `Failed to parse merge result: ${parseError.message}`,
                    ),
                )
            }
        })

        mergeProcess.on("error", (error) => {
            console.error(`  ❌ Failed to spawn merge process:`, error.message)
            try {
                if (fs.existsSync(configPath)) fs.unlinkSync(configPath)
            } catch (e) {}
            reject(new Error(`Failed to run VMF merge: ${error.message}`))
        })
    })
}

/**
 * Split a combined OBJ back into individual models based on grid layout
 * Uses proper grid-based cell assignment - each model occupies a square cell
 * @param {string} objPath - Path to the combined OBJ file
 * @param {Array} gridLayout - Grid layout info from mergeVMFsIntoGrid
 * @param {string} outputDir - Directory to save individual OBJs
 * @param {number} cellSize - Size of each grid cell (should match the cellSize from merge)
 * @param {Object} options - Additional options
 * @param {string} options.namePrefix - Prefix for output files (e.g., "itemname" -> "itemname_0.obj")
 * @returns {Promise<Array<{name: string, objPath: string, index: number}>>}
 */
async function splitOBJByGrid(objPath, gridLayout, outputDir, cellSize = 256, options = {}) {
    const { namePrefix = null } = options
    console.log(
        `✂️  Splitting combined OBJ into ${gridLayout.length} individual models...`,
    )
    console.log(`  📦 Using grid-based cell assignment for clean splits`)

    if (!fs.existsSync(objPath)) {
        throw new Error(`OBJ file not found: ${objPath}`)
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    const objContent = fs.readFileSync(objPath, "utf-8")
    const lines = objContent.split("\n")

    // Parse OBJ file components
    const vertices = [] // v x y z
    const texCoords = [] // vt u v
    const normals = [] // vn x y z
    const faces = [] // f v/vt/vn v/vt/vn v/vt/vn with vertex indices
    const materials = [] // usemtl name
    let currentMaterial = null
    let mtlLib = null

    for (const line of lines) {
        const trimmed = line.trim()

        if (trimmed.startsWith("v ")) {
            const parts = trimmed.split(/\s+/)
            vertices.push({
                x: parseFloat(parts[1]),
                y: parseFloat(parts[2]),
                z: parseFloat(parts[3]),
                line,
                cluster: -1, // Will be assigned during clustering
            })
        } else if (trimmed.startsWith("vt ")) {
            texCoords.push(line)
        } else if (trimmed.startsWith("vn ")) {
            normals.push(line)
        } else if (trimmed.startsWith("f ")) {
            // Parse vertex indices from face
            const vertexIndices = []
            const parts = trimmed.substring(2).trim().split(/\s+/)
            for (const part of parts) {
                const indices = part.split("/")
                if (indices[0]) {
                    vertexIndices.push(parseInt(indices[0]))
                }
            }
            faces.push({
                line,
                material: currentMaterial,
                vertexIndices, // 1-based indices
            })
        } else if (trimmed.startsWith("usemtl ")) {
            currentMaterial = trimmed.substring(7).trim()
            if (!materials.includes(currentMaterial)) {
                materials.push(currentMaterial)
            }
        } else if (trimmed.startsWith("mtllib ")) {
            mtlLib = trimmed
        }
    }

    console.log(
        `  📊 Parsed OBJ: ${vertices.length} vertices, ${faces.length} faces, ${materials.length} materials`,
    )

    // Build connectivity graph - vertices connected by faces
    const adjacency = new Map() // vertex index -> Set of connected vertex indices
    for (let i = 0; i < vertices.length; i++) {
        adjacency.set(i, new Set())
    }

    // Build adjacency list from faces
    for (const face of faces) {
        const verts = face.vertexIndices.map((idx) => idx - 1) // Convert to 0-based
        // Connect all vertices in this face to each other
        for (let i = 0; i < verts.length; i++) {
            for (let j = i + 1; j < verts.length; j++) {
                if (
                    verts[i] >= 0 &&
                    verts[i] < vertices.length &&
                    verts[j] >= 0 &&
                    verts[j] < vertices.length
                ) {
                    adjacency.get(verts[i]).add(verts[j])
                    adjacency.get(verts[j]).add(verts[i])
                }
            }
        }
    }

    console.log(`  🔗 Built connectivity graph`)

    // New logic: Find all connected mesh components (clusters) first
    console.log(`  🔗 Finding connected mesh components (clusters)...`)

    const visited = new Array(vertices.length).fill(false)
    const clusters = [] // Array of Set<number> for vertex indices of each component

    for (let i = 0; i < vertices.length; i++) {
        if (!visited[i]) {
            const cluster = new Set()
            const queue = [i] // Using BFS to find connected component
            visited[i] = true
            cluster.add(i)

            while (queue.length > 0) {
                const vIdx = queue.shift()

                const neighbors = adjacency.get(vIdx) || new Set()
                for (const neighbor of neighbors) {
                    if (!visited[neighbor]) {
                        visited[neighbor] = true
                        cluster.add(neighbor)
                        queue.push(neighbor)
                    }
                }
            }
            clusters.push(cluster)
        }
    }

    console.log(`  Found ${clusters.length} distinct mesh components.`)

    // Each cell is a square of size cellSize, positioned at (col*cellSize, row*cellSize)
    console.log(`  📊 Cell size: ${cellSize}`)

    // Build grid cell boundaries based on the grid positions from merge script
    const cellBoundaries = gridLayout.map((cell) => ({
        minX: cell.cellX,
        maxX: cell.cellX + cellSize,
        minY: cell.cellY,
        maxY: cell.cellY + cellSize,
    }))

    // Assign each cluster to a cell based on where the majority of its vertices are
    console.log(
        `  🗳️  Assigning mesh components to grid cells by majority vote...`,
    )
    // First pass – majority vote per cluster.
    const clusterAssignments = new Array(clusters.length).fill(-1)
    const clusterSizes = clusters.map((c) => c.size)

    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
        const cluster = clusters[cIdx]
        const votes = new Array(gridLayout.length).fill(0)

        for (const vIdx of cluster) {
            const v = vertices[vIdx]
            const sourceX = v.x
            const sourceY = -v.z

            for (let cellIdx = 0; cellIdx < gridLayout.length; cellIdx++) {
                const b = cellBoundaries[cellIdx]
                if (
                    sourceX >= b.minX &&
                    sourceX < b.maxX &&
                    sourceY >= b.minY &&
                    sourceY < b.maxY
                ) {
                    votes[cellIdx]++
                    break
                }
            }
        }

        // pick winner
        let win = -1,
            max = -1
        for (let i = 0; i < votes.length; i++) {
            if (votes[i] > max) {
                max = votes[i]
                win = i
            }
        }
        clusterAssignments[cIdx] = win
    }

    // Second pass – reassign tiny fragments to nearest cell centre
    const avgSize =
        clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length
    const tinyThreshold = Math.max(100, avgSize * 0.05) // 5 % of average or <100 verts
    let fragmentsReassigned = 0

    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
        if (clusterSizes[cIdx] >= tinyThreshold) continue // not tiny

        const cluster = clusters[cIdx]
        // compute centroid
        let sx = 0,
            sy = 0
        for (const vIdx of cluster) {
            sx += vertices[vIdx].x
            sy += -vertices[vIdx].z
        }
        const cx = sx / cluster.size
        const cy = sy / cluster.size

        // nearest cell centre
        let best = -1,
            bestDist = Infinity
        for (let cellIdx = 0; cellIdx < gridLayout.length; cellIdx++) {
            const cell = gridLayout[cellIdx]
            const centerX = cell.cellX + cellSize / 2
            const centerY = cell.cellY + cellSize / 2
            const dx = cx - centerX
            const dy = cy - centerY
            const d2 = dx * dx + dy * dy
            if (d2 < bestDist) {
                bestDist = d2
                best = cellIdx
            }
        }
        if (best !== -1 && best !== clusterAssignments[cIdx]) {
            clusterAssignments[cIdx] = best
            fragmentsReassigned++
        }
    }

    if (fragmentsReassigned) {
        console.log(
            `  🔄 Reassigned ${fragmentsReassigned} tiny mesh fragments to nearest cell centre.`,
        )
    }

    // Build final vertex sets based on (possibly updated) assignments
    const cellVertexSets = gridLayout.map(() => new Set())
    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
        const cellIdx = clusterAssignments[cIdx]
        if (cellIdx === -1) continue
        for (const vIdx of clusters[cIdx]) {
            cellVertexSets[cellIdx].add(vIdx)
        }
    }

    // Mark vertex.cluster for downstream splitting
    for (let cellIdx = 0; cellIdx < gridLayout.length; cellIdx++) {
        for (const vIdx of cellVertexSets[cellIdx]) {
            vertices[vIdx].cluster = cellIdx
        }
    }

    // Logging
    console.log(`  🌱 Vertex assignment (after fragment reassignment):`)
    for (let cellIdx = 0; cellIdx < gridLayout.length; cellIdx++) {
        const count = cellVertexSets[cellIdx].size
        console.log(
            `    Cell ${cellIdx} (${gridLayout[cellIdx].name}): ${count} vertices`,
        )
    }

    // ------------------------------------------------------------
    // Healing pass: ensure every face is self-consistent
    // ------------------------------------------------------------
    console.log("⛑️  Healing faces that straddle cell boundaries...")
    let healedFaces = 0
    for (const face of faces) {
        // OBJ faces reference 1-based vertex indices
        const assignments = face.vertexIndices.map((idx) => {
            const v = vertices[idx - 1]
            return v ? v.cluster : -1
        })
        const first = assignments[0]
        if (assignments.every((a) => a === first)) continue // face already consistent

        // Determine majority cluster
        const voteCount = {}
        for (const a of assignments) {
            if (a !== -1) voteCount[a] = (voteCount[a] || 0) + 1
        }
        let majority = -1,
            max = 0
        for (const k in voteCount) {
            if (voteCount[k] > max) {
                max = voteCount[k]
                majority = parseInt(k)
            }
        }
        if (majority === -1) continue

        // Reassign all vertices of this face to majority cluster
        for (const idx of face.vertexIndices) {
            const v = vertices[idx - 1]
            if (v) v.cluster = majority
        }
        healedFaces++
    }

    if (healedFaces > 0) {
        console.log(`  ✅ Healed ${healedFaces} faces by majority reassignment`)
    }

    // Now split into individual OBJs based on vertex clusters
    const results = []

    for (let cellIdx = 0; cellIdx < gridLayout.length; cellIdx++) {
        const cell = gridLayout[cellIdx]
        // Use namePrefix_index format if provided, otherwise use cell.name
        const outputName = namePrefix ? `${namePrefix}_${cellIdx}` : cell.name
        console.log(`  ✂️  Extracting ${outputName} (from ${cell.name})...`)

        // Find all vertices in this cluster
        const cellVertexIndices = []
        const vertexMap = new Map() // old index (0-based) -> new index (1-based for OBJ)

        for (let vIdx = 0; vIdx < vertices.length; vIdx++) {
            if (vertices[vIdx].cluster === cellIdx) {
                cellVertexIndices.push(vIdx)
                vertexMap.set(vIdx + 1, cellVertexIndices.length) // OBJ uses 1-based indexing
            }
        }

        console.log(`    Found ${cellVertexIndices.length} vertices in cluster`)

        if (cellVertexIndices.length === 0) {
            console.warn(`    ⚠️  No vertices found for ${cell.name}, skipping`)
            continue
        }

        // Extract faces that use ONLY vertices from this cluster
        const cellFaces = faces.filter((face) => {
            // Check if ALL vertices in the face belong to this cluster
            return face.vertexIndices.every((idx) => vertexMap.has(idx))
        })

        console.log(`    Found ${cellFaces.length} faces`)

        // Build new OBJ content
        const objLines = []
        const splitMtlName = `${outputName}.mtl`
        objLines.push(`mtllib ${splitMtlName}`)
        objLines.push("")

        // Write vertices - offset back to their original positions
        // The vertices are currently at their merged positions, we need to undo the offset
        // Rotation: Source (x,y,z) -> OBJ (x,z,-y)
        // So to reverse: OBJ (x,y,z) -> Source would need inverse rotation
        // But we want to undo the offset that was applied in Source space

        const rotatedOffsetX = cell.offsetX
        const rotatedOffsetY = cell.offsetZ // y' = z
        const rotatedOffsetZ = -cell.offsetY // z' = -y

        for (const vIdx of cellVertexIndices) {
            const v = vertices[vIdx]
            const newX = v.x - rotatedOffsetX
            const newY = v.y - rotatedOffsetY
            const newZ = v.z - rotatedOffsetZ
            objLines.push(`v ${newX} ${newY} ${newZ}`)
        }

        // Write texture coords and normals (keep all for simplicity)
        objLines.push("")
        texCoords.forEach((tc) => objLines.push(tc))
        objLines.push("")
        normals.forEach((n) => objLines.push(n))
        objLines.push("")

        // Write faces with remapped indices
        let lastMaterial = null
        for (const face of cellFaces) {
            // Change material if needed
            if (face.material !== lastMaterial) {
                objLines.push(`usemtl ${face.material}`)
                lastMaterial = face.material
            }

            // Remap vertex indices in the face
            const remapped = face.line.replace(
                /(\d+)(\/\d+)?(\/\d+)?/g,
                (match, vIdx, vt, vn) => {
                    const oldIdx = parseInt(vIdx)
                    const newVIdx = vertexMap.get(oldIdx)
                    if (!newVIdx) {
                        console.warn(
                            `    ⚠️  Vertex ${oldIdx} not in cluster map!`,
                        )
                        return match
                    }
                    return `${newVIdx}${vt || ""}${vn || ""}`
                },
            )

            objLines.push(remapped)
        }

        // Write OBJ file
        const outputPath = path.join(outputDir, `${outputName}.obj`)
        fs.writeFileSync(outputPath, objLines.join("\n"), "utf-8")
        console.log(`    ✅ Saved: ${outputPath}`)

        // Create MTL file for this split model (copy from combined MTL)
        const splitMtlPath = path.join(outputDir, `${outputName}.mtl`)
        if (mtlLib) {
            const combinedMtlFile = mtlLib.replace("mtllib ", "").trim()
            const combinedMtlPath = path.join(
                path.dirname(objPath),
                combinedMtlFile,
            )

            if (fs.existsSync(combinedMtlPath)) {
                fs.copyFileSync(combinedMtlPath, splitMtlPath)
                console.log(`    ✅ Copied MTL: ${outputName}.mtl`)
            } else {
                console.warn(
                    `    ⚠️  Combined MTL not found: ${combinedMtlPath}`,
                )
            }
        }

        results.push({
            name: outputName,
            originalName: cell.name,
            objPath: outputPath,
            mtlPath: splitMtlPath,
            index: cellIdx,
        })
    }

    console.log(`✅ Split into ${results.length} individual OBJ files`)

    return results
}

module.exports = {
    calculateGridDimensions,
    getVMFBoundsFromText,
    offsetVMFText,
    mergeVMFsIntoGrid,
    splitOBJByGrid,
}
