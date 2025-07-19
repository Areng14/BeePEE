class Window {
    constructor(size = { width: 1200, height: 800 }, options = {}) {
        this.size = size
        this.options = {
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "..", "preload.js"),
            },
            ...options,
        }

        this.window = new BrowserWindow({
            width: this.size.width,
            height: this.size.height,
            ...this.options,
        })

        this.setupEvents()
    }

    setupEvents() {
        this.window.on("closed", () => {
            this.onClosed()
        })
    }

    loadFile(filePath) {
        this.window.loadFile(filePath)
    }

    send(channel, data) {
        this.window.webContents.send(channel, data)
    }

    focus() {
        this.window.focus()
    }

    close() {
        this.window.close()
    }

    onClosed() {
        // Override this in subclasses or set as callback
    }
}

module.exports = { Window }
