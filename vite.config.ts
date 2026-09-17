import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
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
