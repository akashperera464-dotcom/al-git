import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    strategies: "injectManifest",
    srcDir: "public",
    filename: "sw.ts",
    injectRegister: false,
    manifest: false,
    injectManifest: { globPatterns: ["**/*.{js,css,html,png,svg,json,woff2}"], maximumFileSizeToCacheInBytes: 3 * 1024 * 1024 },
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
