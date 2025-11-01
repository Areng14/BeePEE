const { app } = require("electron")

/**
 * Determines if the application is running in development mode.
 * Returns true if the app is not packaged (i.e., running in development),
 * false if the app is packaged (i.e., production build).
 */
const isDev = !app.isPackaged

module.exports = isDev

