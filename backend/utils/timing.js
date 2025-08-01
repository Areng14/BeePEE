const { ipcMain } = require("electron")

class Timer {
    constructor(name) {
        this.name = name
        this.startTime = null
    }

    start() {
        this.startTime = process.hrtime.bigint()
        return this
    }

    end() {
        const endTime = process.hrtime.bigint()
        const duration = Number(endTime - this.startTime) / 1_000_000_000 // Convert to seconds
        console.log(`${this.name} (${duration.toFixed(2)}s)`)
        return duration
    }
}

// Helper function to time async operations
async function timeOperation(name, operation) {
    const timer = new Timer(name).start()
    try {
        const result = await operation()
        timer.end()
        return result
    } catch (error) {
        timer.end()
        throw error
    }
}

module.exports = {
    Timer,
    timeOperation,
}
