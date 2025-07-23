import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
   base: process.env.NODE_ENV === 'production' ? '/HRBoard/' : '/',
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
