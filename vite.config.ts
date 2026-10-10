import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), VitePWA({
    strategies: "generateSW",
    filename: "sw.js",
    injectRegister: false,
    manifest: false,
    registerType: "prompt",
    includeAssets: ["manifest.json", "kdu-logo.png", "kdu-icon-1024.png"],
    workbox: {
      globPatterns: ["**/*.{html,js,css,png,svg,woff2}"],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
      // Activate after old tabs close, preserving unsaved field forms.
      skipWaiting: false,
      clientsClaim: true,
      // Private database/auth responses must never enter the shared cache.
      runtimeCaching: [],
    },
    devOptions: { enabled: false },
  })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // Allow the sandbox preview gateway (preview-<bot-id>.space-z.ai) to reach
    // Vite through the Caddy reverse proxy. Without this, Vite 7's strict
    // host-check returns 403 for any non-localhost Host header.
    allowedHosts: true,
    host: true,
    port: 3000,
    strictPort: true,
  },
});
