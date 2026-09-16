import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

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
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
    plugins: [
      react(),
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
