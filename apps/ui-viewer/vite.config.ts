import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __REPO_ROOT__: JSON.stringify(repoRoot),
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
