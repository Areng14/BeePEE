const fs = require("fs")
const path = require("path")
const WinReg = require("winreg")
const vdf = require("vdf-parser")
const { timeOperation } = require("./utils/timing")

async function findPortal2Dir(log = console) {
    // 1. Find main Steam path from registry
    log.log("Finding Steam...")
    let steamPath = null
    try {
        const regKey = new WinReg({
            hive: WinReg.HKCU,
            key: "\\Software\\Valve\\Steam",
        })
        steamPath = await new Promise((resolve, reject) => {
            regKey.get("SteamPath", (err, item) => {
                if (err) reject(err)
                else resolve(item.value)
            })
        })
    } catch (e) {
        log.error("Could not find Steam path in registry:", e)
        return null
    }
    if (!fs.existsSync(steamPath)) {
        log.error("Steam path does not exist:", steamPath)
        return null
    }
    // 2. Find all Steam libraries
    const steamLibs = [steamPath.toLowerCase()]
    try {
        const libVdfPath = path.join(
            steamPath,
            "steamapps",
            "libraryfolders.vdf",
        )
        if (fs.existsSync(libVdfPath)) {
            const conf = vdf.parse(fs.readFileSync(libVdfPath, "utf-8"))
            const folders = conf.LibraryFolders || conf.libraryfolders
            for (const key in folders) {
                if (/^\d+$/.test(key)) {
                    let lib = folders[key].path || folders[key]
                    if (typeof lib === "object" && lib.path) lib = lib.path
                    if (
                        lib &&
                        fs.existsSync(path.join(lib, "steamapps", "common"))
                    ) {
                        steamLibs.push(lib.replace(/\\/g, "/").toLowerCase())
                    }
                }
            }
        }
    } catch (e) {
        log.error("Error parsing libraryfolders.vdf:", e)
    }
    // Remove duplicates
    const uniqueLibs = Array.from(new Set(steamLibs))

    // 3. Find Portal 2 directory
    for (const lib of uniqueLibs) {
        const p2dir = path.join(lib, "steamapps", "common", "Portal 2")
        if (fs.existsSync(p2dir)) {
            return p2dir
        }
    }

    log.error("Could not find Portal 2 directory")
    return null
}

async function parseFGD(fgdPath, log = console) {
    return timeOperation("Parse FGD file", async () => {
        if (!fs.existsSync(fgdPath)) {
            log.error("FGD file not found:", fgdPath)
            return null
        }

        try {
            log.log("Parsing FGD file:", fgdPath)
            const fgdContent = fs.readFileSync(fgdPath, "utf-8")

            const baseClasses = {}
            const entities = {}

            // More robust regex to match entity declarations
            // Matches: @PointClass, @SolidClass, @BaseClass with everything until the next @
            const entityRegex =
                /@(PointClass|SolidClass|BaseClass)([^@]+?)(?=@|$)/gs
            const matches = [...fgdContent.matchAll(entityRegex)]

            for (const match of matches) {
                const entityType = match[1] // PointClass, SolidClass, BaseClass
                const entityBlock = match[2].trim()

                // Extract entity name - look for = EntityName
                const nameMatch = entityBlock.match(
                    /=\s*([A-Za-z_][A-Za-z0-9_]*)/s,
                )
                if (!nameMatch) continue

                const entityName = nameMatch[1]

                // Extract base classes - look for base(BaseClass1, BaseClass2)
                const baseMatch = entityBlock.match(/base\s*\(\s*([^)]+)\s*\)/s)
                const parents = baseMatch
                    ? baseMatch[1]
                          .split(",")
                          .map((p) => p.trim())
                          .filter((p) => p)
                    : []

                // Extract inputs - look for input InputName(type) : "description"
                const inputs = []
                const inputMatches = [
                    ...entityBlock.matchAll(
                        /input\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([^)]*?)\s*\)\s*:\s*"([^"]*)"/gs,
                    ),
                ]
                for (const inputMatch of inputMatches) {
                    const inputName = inputMatch[1]
                    const paramType = inputMatch[2].trim()
                    inputs.push({
                        name: inputName,
                        paramType: paramType,
                        needsParam: paramType !== "void" && paramType !== "",
                    })
                }

                // Extract outputs - look for output OutputName(type) : "description"
                const outputs = []
                const outputMatches = [
                    ...entityBlock.matchAll(
                        /output\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([^)]*?)\s*\)\s*:\s*"([^"]*)"/gs,
                    ),
                ]
                for (const outputMatch of outputMatches) {
                    const outputName = outputMatch[1]
                    const paramType = outputMatch[2].trim()
                    outputs.push({
                        name: outputName,
                        paramType: paramType,
                        needsParam: paramType !== "void" && paramType !== "",
                    })
                }

                const entityData = {
                    inputs,
                    outputs,
                    parents,
                    type: entityType,
                }

                if (entityType === "BaseClass") {
                    baseClasses[entityName] = entityData
                } else {
                    // PointClass or SolidClass are concrete entities
                    entities[entityName] = entityData
                }
            }

            // Function to resolve inheritance
            const resolveInheritance = (entityName, visited = new Set()) => {
                if (visited.has(entityName)) {
                    return { inputs: [], outputs: [] }
                }

                visited.add(entityName)

                const entity = entities[entityName] || baseClasses[entityName]
                if (!entity) {
                    visited.delete(entityName)
                    return { inputs: [], outputs: [] }
                }

                let allInputs = [...entity.inputs]
                let allOutputs = [...entity.outputs]

                // Recursively resolve parent classes
                for (const parent of entity.parents) {
                    const parentData = resolveInheritance(parent, visited)
                    allInputs.unshift(...parentData.inputs)
                    allOutputs.unshift(...parentData.outputs)
                }

                visited.delete(entityName)

                // Remove duplicates (later entries take precedence)
                const uniqueInputs = []
                const uniqueOutputs = []
                const seenInputs = new Set()
                const seenOutputs = new Set()

                // Process in reverse to give precedence to derived classes
                for (let i = allInputs.length - 1; i >= 0; i--) {
                    const input = allInputs[i]
                    if (!seenInputs.has(input.name)) {
                        seenInputs.add(input.name)
                        uniqueInputs.unshift(input)
                    }
                }

                for (let i = allOutputs.length - 1; i >= 0; i--) {
                    const output = allOutputs[i]
                    if (!seenOutputs.has(output.name)) {
                        seenOutputs.add(output.name)
                        uniqueOutputs.unshift(output)
                    }
                }

                return { inputs: uniqueInputs, outputs: uniqueOutputs }
            }

            // Resolve inheritance for all concrete entities
            const finalEntities = {}
            for (const [entityName, entityData] of Object.entries(entities)) {
                const resolved = resolveInheritance(entityName)
                finalEntities[entityName] = resolved
            }

            return finalEntities
        } catch (error) {
            log.error("Failed to parse FGD file:", error)
            return null
        }
    })
}

let cachedResources = null

/**
 * Parse gameinfo.txt to find all search paths and DLC folders
 * @param {string} gameinfoPath - Path to gameinfo.txt
 * @param {string} baseDir - Base directory for resolving relative paths
 * @returns {Object} Object containing search paths and DLC info
 */
async function parseGameInfo(gameinfoPath, baseDir, log = console) {
    try {
        log.log(`Parsing gameinfo.txt: ${gameinfoPath}`)
        const content = fs.readFileSync(gameinfoPath, "utf-8")

        const searchPaths = []
        const dlcFolders = []

        // Parse SearchPaths section
        const searchPathsMatch = content.match(/SearchPaths\s*\{([^}]+)\}/s)
        if (searchPathsMatch) {
            const searchPathsContent = searchPathsMatch[1]
            log.log(`📁 Parsing SearchPaths section from gameinfo.txt`)

            // Extract all search paths
            const pathMatches =
                searchPathsContent.matchAll(/Game\s+([^\r\n]+)/g)
            for (const match of pathMatches) {
                const searchPath = match[1].trim()
                if (searchPath) {
                    searchPaths.push(searchPath)
                    log.log(`  ✅ Found search path: ${searchPath}`)
                }
            }
            
            log.log(`📊 Total search paths found: ${searchPaths.length}`)
        } else {
            log.log(`⚠️ No SearchPaths section found in gameinfo.txt`)
        }

        return { searchPaths, dlcFolders: [] }
    } catch (error) {
        log.error(`Failed to parse gameinfo.txt: ${error.message}`)
        return { searchPaths: [], dlcFolders: [] }
    }
}

async function findPortal2Resources(log = console) {
    return timeOperation("Find Portal 2 resources", async () => {
        // Return cached resources if already found
        if (cachedResources) {
            return cachedResources
        }

        const p2dir = await findPortal2Dir(log)
        if (!p2dir) return null

        const paths = {
            root: p2dir,
            gameinfo: null,
            fgd: null,
            maps: null,
            scripts: null,
            bin: null,
            entities: null,
            hammer: null,
        }

        // Check for gameinfo.txt and parse it
        const gameinfoPath = path.join(p2dir, "portal2", "gameinfo.txt")
        if (fs.existsSync(gameinfoPath)) {
            paths.gameinfo = gameinfoPath
            log.log(`📄 Found gameinfo.txt: ${gameinfoPath}`)
            
            const gameInfo = await parseGameInfo(
                gameinfoPath,
                path.join(p2dir, "portal2"),
                log,
            )
            paths.searchPaths = gameInfo.searchPaths
            
            log.log(`📊 Gameinfo parsing complete:`)
            log.log(`  - Search paths: ${gameInfo.searchPaths.length}`)
        } else {
            log.log(`⚠️ No gameinfo.txt found at: ${gameinfoPath}`)
            paths.searchPaths = []
        }

        // Always scan for DLCs automatically (like Portal 2 does)
        log.log(`🔍 Auto-scanning for DLC folders...`)
        const portal2Root = p2dir // Portal 2 root directory
        log.log(`  Scanning in: ${portal2Root}`)
        
        const autoDlcFolders = []
        let dlcNumber = 1
        while (true) {
            const dlcFolderName = `portal2_dlc${dlcNumber}` // Correct naming: portal2_dlc1, portal2_dlc2, etc.
            const dlcPath = path.join(portal2Root, dlcFolderName)
            log.log(`  🔍 Checking: ${dlcFolderName} at ${dlcPath}`)
            
            if (fs.existsSync(dlcPath)) {
                log.log(`    ✅ Found DLC: ${dlcFolderName} at ${dlcPath}`)
                autoDlcFolders.push({
                    name: dlcFolderName,
                    path: dlcPath,
                    gameinfo: null,
                })
                dlcNumber++ // Check next DLC
            } else {
                log.log(`    ❌ DLC ${dlcFolderName} not found, stopping at ${dlcNumber - 1}`)
                break // Stop when we hit a missing DLC
            }
        }
        
        paths.dlcFolders = autoDlcFolders
        log.log(`📊 Auto DLC scan complete: ${autoDlcFolders.length} DLCs found`)

        // Check for FGD files and parse them
        const fgdPath = path.join(p2dir, "bin", "portal2.fgd")
        const baseFgdPath = path.join(p2dir, "bin", "base.fgd")

        let allEntities = {}

        // Parse base.fgd first if it exists
        if (fs.existsSync(baseFgdPath)) {
            log.log("Parsing base.fgd...")
            const baseEntities = await parseFGD(baseFgdPath, log)
            if (baseEntities) {
                allEntities = { ...baseEntities }
                log.log(
                    `Found ${Object.keys(baseEntities).length} entities in base.fgd`,
                )
            }
        }

        // Parse portal2.fgd and merge with base entities
        if (fs.existsSync(fgdPath)) {
            paths.fgd = fgdPath
            log.log("Parsing portal2.fgd...")
            const p2Entities = await parseFGD(fgdPath, log)
            if (p2Entities) {
                log.log(
                    `Found ${Object.keys(p2Entities).length} entities in portal2.fgd`,
                )
                // Merge entities, with portal2.fgd taking precedence
                for (const [entityName, entityData] of Object.entries(
                    p2Entities,
                )) {
                    if (allEntities[entityName]) {
                        // Merge inputs and outputs, avoiding duplicates
                        const existingInputNames = new Set(
                            allEntities[entityName].inputs.map((i) => i.name),
                        )
                        const existingOutputNames = new Set(
                            allEntities[entityName].outputs.map((o) => o.name),
                        )

                        const newInputs = entityData.inputs.filter(
                            (input) => !existingInputNames.has(input.name),
                        )
                        const newOutputs = entityData.outputs.filter(
                            (output) => !existingOutputNames.has(output.name),
                        )

                        allEntities[entityName].inputs.push(...newInputs)
                        allEntities[entityName].outputs.push(...newOutputs)
                    } else {
                        allEntities[entityName] = entityData
                    }
                }
            }
        }

        if (Object.keys(allEntities).length > 0) {
            paths.entities = allEntities
            log.log(`Total entities loaded: ${Object.keys(allEntities).length}`)
        }

        // Maps, scripts, bin
        const mapsPath = path.join(p2dir, "portal2", "maps")
        if (fs.existsSync(mapsPath)) {
            paths.maps = mapsPath
        }
        const scriptsPath = path.join(p2dir, "portal2", "scripts")
        if (fs.existsSync(scriptsPath)) {
            paths.scripts = scriptsPath
        }
        const binPath = path.join(p2dir, "bin")
        if (fs.existsSync(binPath)) {
            paths.bin = binPath
            // Check for hammer++ first, then regular hammer
            const hammerPlusPlusPath = path.join(binPath, "hammerplusplus.exe")
            const hammerPath = path.join(binPath, "hammer.exe")

            if (fs.existsSync(hammerPlusPlusPath)) {
                paths.hammerPlusPlus = hammerPlusPlusPath
                paths.hammer = hammerPlusPlusPath // Default to Hammer++ if available
            } else if (fs.existsSync(hammerPath)) {
                paths.hammer = hammerPath
            }
        }

        // Cache the results
        cachedResources = paths
        return paths
    })
}

// Simple getter for hammer path
function getHammerPath() {
    return cachedResources?.hammer || null
}

// Add a function to check if any Hammer is available
function getHammerAvailability() {
    if (!cachedResources) return { available: false, type: null }
    if (cachedResources.hammerPlusPlus)
        return { available: true, type: "Hammer++" }
    if (cachedResources.hammer) return { available: true, type: "Hammer" }
    return { available: false, type: null }
}

module.exports = {
    findPortal2Resources,
    getHammerPath,
    getHammerAvailability,
    parseGameInfo,
}
