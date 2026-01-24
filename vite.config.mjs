import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig(({ command }) => {
    const isServe = command === "serve"

    const debugEnvPlugin = isServe
        ? {
              name: "beepee-debug-env-requests",
              configureServer(server) {
                  server.middlewares.use((req, res, next) => {
                      if (
                          req.url?.includes("env.mjs") ||
                          req.url?.includes("@vite/env") ||
                          req.url?.includes("client.mjs") ||
                          req.url?.includes("@vite/client")
                      ) {
                          console.log(`[vite] dev asset request: ${req.method} ${req.url}`)
                      }
                      next()
                  })
              },
          }
        : null

    return {
        plugins: [react(), ...(debugEnvPlugin ? [debugEnvPlugin] : [])],
        // Use absolute paths during dev so Vite's client assets load via HTTP,
        // but switch to relative paths for the packaged file:// protocol.
        base: isServe ? "/" : "./",
        server: {
            watch: {
                // Ignore packages folder to prevent file locks on Windows
                // This folder contains extracted BEE2 packages and is managed by Electron
                ignored: ["**/packages/**", "**/node_modules/**"],
            },
        },
    }
})
