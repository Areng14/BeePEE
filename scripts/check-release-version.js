/**
 * Guards publish scripts against version/channel mismatches
 * Run with: node scripts/check-release-version.js <stable|beta>
 *
 * - publish:beta requires a prerelease version (e.g. 1.2.0-beta.1)
 * - publish requires a plain version (e.g. 1.2.0)
 *
 * Beta builds detect their channel from the version suffix at runtime
 * (backend/utils/betaInfo.js), so publishing the wrong version to a
 * channel would break the beta popup, updater channel, and report endpoint.
 */

const packageJson = require("../package.json")

const mode = process.argv[2]
const version = packageJson.version
const isPrerelease = /-(beta|alpha|rc)(\.|\d|$)/i.test(version)

if (mode === "beta" && !isPrerelease) {
    console.error(`ERROR: publish:beta requires a prerelease version, but package.json has "${version}"`)
    console.error('       Set the version to e.g. "1.2.0-beta.1" first')
    process.exit(1)
}

if (mode === "stable" && isPrerelease) {
    console.error(`ERROR: publish requires a stable version, but package.json has "${version}"`)
    console.error("       Use npm run publish:beta for prerelease versions")
    process.exit(1)
}

console.log(`OK: Version ${version} is valid for a ${mode} release`)
