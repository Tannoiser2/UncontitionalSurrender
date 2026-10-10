import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Percorso base del sito. Di default "/" (sviluppo, Vercel, app Electron con app://).
// Per GitHub Pages il sito vive in /UncontitionalSurrender/: lo imposta il workflow con BASE_PATH.
const base = process.env.BASE_PATH || "/";

// Il codice usa percorsi assoluti per i file di public/ ("/actions/…", "/scenarios/…"):
// con un base diverso da "/" li prefissa in fase di build, senza toccare i sorgenti.
const PUBLIC_DIRS = "splash|actions|event-icons|scenarios|weather-icons";
function publicBase(): Plugin {
  const re = new RegExp(`(["'\`])/(${PUBLIC_DIRS})/`, "g");
  return {
    name: "public-base",
    enforce: "pre",
    transform(code, id) {
      if (base === "/" || id.includes("node_modules") || !/\.(tsx?|jsx?)$/.test(id)) return null;
      return code.includes("/") ? code.replace(re, `$1${base}$2/`) : null;
    }
  };
}

export default defineConfig({
  base,
  plugins: [publicBase(), react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
