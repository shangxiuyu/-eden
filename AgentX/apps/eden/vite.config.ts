import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src/client"),
      "@": path.resolve(__dirname, "./src/client"),
      "@server": path.resolve(__dirname, "./src/server"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@features": path.resolve(__dirname, "./src/client/features"),
      "@ui": path.resolve(__dirname, "./src/client/ui"),
      "@services": path.resolve(__dirname, "./src/client/services"),
      "@store": path.resolve(__dirname, "./src/client/store"),
      "@utils": path.resolve(__dirname, "./src/client/utils"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5200",
        changeOrigin: true,
      },
      "/agentx": {
        target: "http://localhost:5200",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:5200",
        ws: true,
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ["**/eden-skills-config.json", "**/.git/**", "**/node_modules/**"],
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
