import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Replaces the __BUILD_TIME__ placeholder in the output sw.js with the
 * actual build timestamp so the browser always detects a content change
 * and installs a fresh Service Worker on every new deploy.
 */
function swVersionPlugin() {
  const buildTime = Date.now().toString();
  return {
    name: "sw-version",
    // Runs after Vite has copied public/ files to the output directory.
    closeBundle() {
      const swOut = path.resolve(__dirname, "../server/public/sw.js");
      if (!fs.existsSync(swOut)) return;
      const original = fs.readFileSync(swOut, "utf-8");
      const patched = original.replace("__BUILD_TIME__", buildTime);
      fs.writeFileSync(swOut, patched);
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), swVersionPlugin()],
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
