/**
 * Determines if the application is running in development mode.
 * Returns true if the app is not packaged (i.e., running in development),
 * false if the app is packaged (i.e., production build).
 *
 * Uses a getter to defer Electron require until first access,
 * preventing issues when modules are loaded before Electron is ready.
 */

let _isDev = null

// Use a getter so we can lazily evaluate isDev when first accessed
// This prevents requiring electron at module load time
module.exports = {
    get isDev() {
        if (_isDev === null) {
            try {
                const { app } = require("electron")
                _isDev = app && typeof app.isPackaged !== "undefined"
                    ? !app.isPackaged
                    : true
            } catch (e) {
                _isDev = true
            }
        }
        return _isDev
    }
}

// Also export a function for explicit calls
module.exports.getIsDev = function() {
    return module.exports.isDev
}

