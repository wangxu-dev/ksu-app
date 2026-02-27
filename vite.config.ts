import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Packaged Electron uses file:// protocol, so build assets must be relative.
  base: command === "build" ? "./" : "/",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
}));
