import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isWebBuild = process.env.WEB_BUILD === "true";

const shimDir = fileURLToPath(new URL("src/tauri-shims", import.meta.url));

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],
  base: isWebBuild ? "/MONGENE/" : "/",
  resolve: isWebBuild
    ? {
        alias: {
          "@tauri-apps/api/core": `${shimDir}/core.ts`,
          "@tauri-apps/api/event": `${shimDir}/event.ts`,
          "@tauri-apps/plugin-opener": `${shimDir}/plugin-opener.ts`,
        },
      }
    : {},

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
