import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? '/HRBoard/' : '/',
  build: {
    sourcemap: true, // Enable source maps for debugging
    // Optional: Adjust chunk size warning if needed (from your build output)
    chunkSizeWarningLimit: 1000, // Increase limit to avoid warnings for 825 kB chunk
  },
  server: {
    host: "0.0.0.0", // This makes the server accessible externally
    port: 5173, // Or whatever port Vite defaults to (commonly 5173)
    allowedHosts: [
      "5173-itmanco-hrboard-mr0pzbppb93.ws-us120.gitpod.io",
      // Add any other hosts if necessary, e.g., 'localhost', '127.0.0.1'
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
