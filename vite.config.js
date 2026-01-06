import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon.png"],
      manifest: {
        name: "Raza Embroidery",
        short_name: "Raza Embroidery",
        start_url: ".",
        display: "standalone",
        theme_color: "#127475",
        background_color: "#ffffff",
        icons: [
          {
            src: "/icon.png",
            sizes: "192x192",
            type: "image/png"
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    hmr: {
      host: "localhost",
      port: 5173,
    }
  }
});
