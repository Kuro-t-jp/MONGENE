import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

const shimDir = fileURLToPath(new URL("src/tauri-shims", import.meta.url));

// GAS ビルド設定
// 出力: gas/index.html (Code.gs と同じディレクトリ)
// - すべての JS/CSS をインライン化 (vite-plugin-singlefile)
// - Tauri API はシムに差し替え
// - pdfjs worker は CDN を使用

export default defineConfig({
  plugins: [tailwindcss(), react(), viteSingleFile()],
  base: "./",
  publicDir: false,  // public/ の静的ファイルはGASには不要
  define: {
    "import.meta.env.VITE_GAS_BUILD": JSON.stringify("true"),
  },
  resolve: {
    alias: {
      "@tauri-apps/api/core": `${shimDir}/core.ts`,
      "@tauri-apps/api/event": `${shimDir}/event.ts`,
      "@tauri-apps/plugin-opener": `${shimDir}/plugin-opener.ts`,
    },
  },
  build: {
    outDir: "gas",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
