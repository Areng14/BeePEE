/**
 * Beta build detection
 *
 * A build is considered a beta when the package.json version carries a
 * prerelease suffix (e.g. "1.2.0-beta.1", "1.2.0-alpha.2", "1.2.0-rc.1").
 * Beta releases are published with `npm run publish:beta`, which marks the
 * GitHub release as a prerelease so stable builds never auto-update to it.
 */

const packageJson = require("../../package.json")

function isBeta() {
    return /-(beta|alpha|rc)(\.|\d|$)/i.test(packageJson.version)
}

function getVersion() {
    return packageJson.version
}

module.exports = { isBeta, getVersion }
