import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dizy Cars",
    short_name: "Dizy Cars",
    description: "Location de voitures au Maroc. Rent easy, drive happy.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6fa",
    theme_color: "#141a2e",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
