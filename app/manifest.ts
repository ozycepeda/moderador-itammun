import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moderador ITAMMUN",
    short_name: "ITAMMUN",
    description: "Consola local para conducir comités y debates de ITAMMUN.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F1E8",
    theme_color: "#0E1B17",
    lang: "es-MX",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
