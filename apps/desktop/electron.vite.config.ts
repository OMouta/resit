import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
        },
      },
    },
  },
  renderer: {
    build: {
      // Keep every font as a file so the strict CSP (no data: fonts) holds.
      assetsInlineLimit: 0,
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      fs: {
        allow: [repoRoot],
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "development-csp",
        transformIndexHtml(html, context) {
          if (!context.server) return html;
          return html
            .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
            .replace(
              "connect-src 'self'",
              "connect-src 'self' ws://127.0.0.1:5173",
            );
        },
      },
    ],
  },
});
