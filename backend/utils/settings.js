const { app } = require("electron")
const fs = require("fs")
const path = require("path")

// Get settings file path
function getSettingsPath() {
    const userDataPath = app.getPath("userData")
    return path.join(userDataPath, "settings.json")
}

// Load settings from disk
function loadSettings() {
    try {
        const settingsPath = getSettingsPath()
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, "utf-8")
            return JSON.parse(data)
        }
    } catch (error) {
        console.error("Failed to load settings:", error)
    }
    return {}
}

// Save settings to disk
function saveSettings(settings) {
    try {
        const settingsPath = getSettingsPath()
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8")
        return true
    } catch (error) {
        console.error("Failed to save settings:", error)
        return false
    }
}

// Get a specific setting
function getSetting(key, defaultValue = null) {
    const settings = loadSettings()
    return settings[key] !== undefined ? settings[key] : defaultValue
}

// Set a specific setting
function setSetting(key, value) {
    const settings = loadSettings()
    settings[key] = value
    return saveSettings(settings)
}

// Get last seen version
function getLastSeenVersion() {
    return getSetting("lastSeenVersion", null)
}

// Set last seen version
function setLastSeenVersion(version) {
    return setSetting("lastSeenVersion", version)
}

module.exports = {
    loadSettings,
    saveSettings,
    getSetting,
    setSetting,
    getLastSeenVersion,
    setLastSeenVersion,
}
