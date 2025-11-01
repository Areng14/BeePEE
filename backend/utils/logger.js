const fs = require("fs")
const path = require("path")
const { app } = require("electron")

/**
 * Logger utility with file rotation (keeps only 10 most recent log files)
 */
class Logger {
    constructor() {
        this.logDir = null
        this.logFile = null
        this.stream = null
        this.maxLogFiles = 10
        this.isInitialized = false
    }

    /**
     * Initialize the logger - must be called after app is ready
     */
    initialize() {
        if (this.isInitialized) return

        try {
            // Get logs directory path
            const userDataPath = app.getPath("userData")
            this.logDir = path.join(userDataPath, "logs")

            // Ensure logs directory exists
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true })
            }

            // Create log file with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
            const logFileName = `beepee-${timestamp}.log`
            this.logFile = path.join(this.logDir, logFileName)

            // Create write stream
            this.stream = fs.createWriteStream(this.logFile, { flags: "a" })

            // Rotate old logs (before setting isInitialized to avoid recursion)
            this.rotateLogs()

            this.isInitialized = true
            
            // Now safe to log initialization
            const formattedMessage = this.formatMessage("info", "Logger initialized", { logFile: this.logFile })
            console.log(formattedMessage.trim())
            if (this.stream) {
                this.stream.write(formattedMessage)
            }
        } catch (error) {
            // Fallback to console if logger initialization fails
            console.error("Failed to initialize logger:", error)
        }
    }

    /**
     * Rotate log files - keep only the 10 most recent
     */
    rotateLogs() {
        try {
            if (!fs.existsSync(this.logDir)) return

            // Get all log files
            const files = fs
                .readdirSync(this.logDir)
                .filter((file) => file.startsWith("beepee-") && file.endsWith(".log"))
                .map((file) => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    time: fs.statSync(path.join(this.logDir, file)).mtime.getTime(),
                }))
                .sort((a, b) => b.time - a.time) // Sort by modification time, newest first

            // Delete files beyond the limit (excluding current log file)
            const currentFileName = path.basename(this.logFile)
            const filesToDelete = files.filter(
                (file) => file.name !== currentFileName && file.time < Date.now(), // Don't delete current file
            )

            // Keep only maxLogFiles, delete the rest
            if (filesToDelete.length > this.maxLogFiles) {
                const filesToRemove = filesToDelete.slice(this.maxLogFiles)
                for (const file of filesToRemove) {
                    try {
                        fs.unlinkSync(file.path)
                        // Only log if logger is initialized (avoid recursion during init)
                        if (this.isInitialized) {
                            this.info(`Deleted old log file: ${file.name}`)
                        }
                    } catch (err) {
                        console.error(`Failed to delete log file ${file.name}:`, err)
                    }
                }
            }
        } catch (error) {
            console.error("Failed to rotate logs:", error)
        }
    }

    /**
     * Format log message with timestamp and level
     */
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString()
        const formattedArgs = args
            .map((arg) => {
                if (typeof arg === "object") {
                    try {
                        return JSON.stringify(arg, null, 2)
                    } catch {
                        return String(arg)
                    }
                }
                return String(arg)
            })
            .join(" ")

        return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs ? " " + formattedArgs : ""}\n`
    }

    /**
     * Write to log file
     */
    writeLog(level, message, ...args) {
        const formattedMessage = this.formatMessage(level, message, ...args)

        // Always write to console for development
        if (level === "error") {
            console.error(formattedMessage.trim())
        } else if (level === "warn") {
            console.warn(formattedMessage.trim())
        } else {
            console.log(formattedMessage.trim())
        }

        // Write to file if initialized
        if (this.isInitialized && this.stream) {
            try {
                this.stream.write(formattedMessage)
            } catch (error) {
                console.error("Failed to write to log file:", error)
            }
        }
    }

    /**
     * Log info message
     */
    info(message, ...args) {
        this.writeLog("info", message, ...args)
    }

    /**
     * Log warning message
     */
    warn(message, ...args) {
        this.writeLog("warn", message, ...args)
    }

    /**
     * Log error message
     */
    error(message, ...args) {
        this.writeLog("error", message, ...args)
    }

    /**
     * Log debug message (only in development)
     */
    debug(message, ...args) {
        if (!app.isPackaged) {
            this.writeLog("debug", message, ...args)
        }
    }

    /**
     * Close the log stream
     */
    close() {
        if (this.stream) {
            this.stream.end()
            this.stream = null
        }
        this.isInitialized = false
    }

    /**
     * Get the path to the current log file
     */
    getLogFilePath() {
        return this.logFile
    }

    /**
     * Get the logs directory path
     */
    getLogsDirectory() {
        return this.logDir
    }
}

// Create singleton instance
const logger = new Logger()

// Export logger instance and initialization function
module.exports = {
    logger,
    initializeLogger: () => logger.initialize(),
}

