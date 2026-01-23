const electron = require("electron")
console.log("Type of electron:", typeof electron)
console.log("Is string:", typeof electron === "string")

if (typeof electron === "object") {
    console.log("Keys:", Object.keys(electron))
    console.log("app:", typeof electron.app)
    console.log("protocol:", typeof electron.protocol)
} else {
    console.log("Value (first 200 chars):", String(electron).substring(0, 200))
}

// Try to access built-in module directly
try {
    const { app } = require("electron")
    console.log("app from destructure:", typeof app)
    if (app) {
        app.on("ready", () => {
            console.log("App is ready!")
            app.quit()
        })
    }
} catch (e) {
    console.log("Error:", e.message)
}
