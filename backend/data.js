const fs = require("fs")
const path = require("path")
const WinReg = require("winreg")
const vdf = require("vdf-parser")
const fgdParser = require("fgdparser") // npm i fgdparser

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
        log.log("Parsing FGD file:", fgdPath)
        const fgdContent = fs.readFileSync(fgdPath, 'utf-8')
        const parsed = fgdParser.parse(fgdContent)
        
        const entities = {}
        
        // Extract inputs/outputs for each entity
        for (const entity of parsed.entities) {
            entities[entity.name] = {
                type: entity.type,
                description: entity.description,
                inputs: (entity.inputs || []).map(i => i.name),
                outputs: (entity.outputs || []).map(o => o.name),
                inputDetails: entity.inputs || [],
                outputDetails: entity.outputs || []
            }
        }
        
        log.log(`Parsed ${Object.keys(entities).length} entities from FGD`)
        return entities
    } catch (e) {
        log.error("Error parsing FGD:", e)
        return null
    }
}

async function findPortal2Resources(log = console) {
    const p2dir = await findPortal2Dir(log)
    if (!p2dir) return null

    const paths = {
        root: p2dir,
        gameinfo: null,
        fgd: null,
        maps: null,
        scripts: null,
        bin: null,
        entities: null // FGD parsed data
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
    }

    return paths
}

module.exports = { findPortal2Dir, findPortal2Resources, parseFGD }