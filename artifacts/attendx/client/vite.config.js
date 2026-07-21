import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// NOTE: sw.js versioning is now handled entirely at runtime by the Express
// server (see server/src/app.ts). The server replaces __BUILD_TIME__ with
// SERVER_START_TIME on every request, so every server restart (= every
// deploy) produces a new SW cache key and forces all PWA clients to update.
// Do NOT add a build-time plugin here that pre-replaces __BUILD_TIME__ —
// it would bake in a fixed timestamp and defeat the runtime replacement.

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "../server/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":   ["react", "react-dom"],
          "vendor-query":   ["@tanstack/react-query"],
          "vendor-charts":  ["recharts"],
          "vendor-motion":  ["framer-motion"],
          "vendor-xlsx":    ["xlsx"],
          "vendor-pdf":     ["jspdf", "jspdf-autotable"],
          "vendor-i18n":    ["i18next", "react-i18next", "i18next-browser-languagedetector", "i18next-http-backend"],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:10000",
        changeOrigin: true,
      },
    },
  },
});
