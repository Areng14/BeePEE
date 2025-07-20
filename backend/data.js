const fs = require("fs")
const path = require("path")
const WinReg = require("winreg")
const vdf = require("vdf-parser")

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
    // 3. Check for Portal 2 in each library
    for (const lib of uniqueLibs) {
        const p2dir = path.join(lib, "steamapps", "common", "Portal 2")
        if (fs.existsSync(path.join(p2dir, "portal2.exe"))) {
            log.log("Found Portal 2 at:", p2dir)
            return p2dir
        }
    }
    log.error("Portal 2 not found in any Steam library.")
    return null
}

function parseFGD(fgdPath, log = console) {
    if (!fs.existsSync(fgdPath)) {
        log.error("FGD file not found:", fgdPath)
        return null
    }

    try {
        log.log("Parsing FGD file with regex:", fgdPath)
        const fgdContent = fs.readFileSync(fgdPath, 'utf-8')
        const entities = {}
        
        // Split into entity blocks - look for @PointClass, @SolidClass, @BaseClass
        const entityBlocks = fgdContent.split(/@(?:PointClass|SolidClass|BaseClass)/)
        
        for (const block of entityBlocks) {
            if (!block.trim()) continue
            
            // Extract entity name (after = sign)
            const nameMatch = block.match(/=\s*(\w+)/)
            if (!nameMatch) continue
            
            const entityName = nameMatch[1]
            const inputs = []
            const outputs = []
            
            // Extract inputs: input InputName(type) : "description"
            const inputMatches = [...block.matchAll(/input\s+(\w+)\s*\([^)]*\)\s*:\s*"([^"]*)"/g)]
            for (const match of inputMatches) {
                inputs.push(match[1])
            }
            
            // Extract outputs: output OutputName(type) : "description"  
            const outputMatches = [...block.matchAll(/output\s+(\w+)\s*\([^)]*\)\s*:\s*"([^"]*)"/g)]
            for (const match of outputMatches) {
                outputs.push(match[1])
            }
            
            // Only add entities that have inputs or outputs
            if (inputs.length > 0 || outputs.length > 0) {
                entities[entityName] = {
                    inputs,
                    outputs
                }
            }
        }
        
        // Add universal Source engine inputs/outputs to all entities
        const universalInputs = ['FireUser1', 'FireUser2', 'FireUser3', 'FireUser4']
        const universalOutputs = ['OnUser1', 'OnUser2', 'OnUser3', 'OnUser4']
        
        for (const entityName in entities) {
            const entity = entities[entityName]
            
            // Add universal inputs if they don't already exist
            for (const input of universalInputs) {
                if (!entity.inputs.includes(input)) {
                    entity.inputs.push(input)
                }
            }
            
            // Add universal outputs if they don't already exist  
            for (const output of universalOutputs) {
                if (!entity.outputs.includes(output)) {
                    entity.outputs.push(output)
                }
            }
        }
        
        log.log(`Found ${Object.keys(entities).length} entities with inputs/outputs`)
        
        return entities
        
    } catch (e) {
        log.error("FGD regex parsing failed:", e.message)
        return null
    }
}

let cachedResources = null

async function findPortal2Resources(log = console) {
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

    // Check for gameinfo.txt
    const gameinfoPath = path.join(p2dir, "portal2", "gameinfo.txt")
    if (fs.existsSync(gameinfoPath)) {
        paths.gameinfo = gameinfoPath
    }

    // Check for FGD file and parse it
    const fgdPath = path.join(p2dir, "bin", "portal2.fgd")
    if (fs.existsSync(fgdPath)) {
        paths.fgd = fgdPath
        paths.entities = parseFGD(fgdPath, log)
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
}

// Simple getter for hammer path
function getHammerPath() {
    return cachedResources?.hammer || null
}

// Add a function to check if any Hammer is available
function getHammerAvailability() {
    if (!cachedResources) return { available: false, type: null }
    if (cachedResources.hammerPlusPlus) return { available: true, type: 'Hammer++' }
    if (cachedResources.hammer) return { available: true, type: 'Hammer' }
    return { available: false, type: null }
}

module.exports = {
    findPortal2Dir,
    findPortal2Resources,
    parseFGD,
    getHammerPath,
    getHammerAvailability,
}