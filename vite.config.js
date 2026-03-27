import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        collections: resolve(__dirname, "pages/collections.html"),
        designers: resolve(__dirname, "pages/designers.html"),
        hotels: resolve(__dirname, "pages/hotels.html"),
        process: resolve(__dirname, "pages/process.html"),
        contact: resolve(__dirname, "pages/contact.html"),
      },
    },
  },
});
