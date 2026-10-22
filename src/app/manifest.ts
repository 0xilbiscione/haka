import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haka — Screener Saham BEI",
    short_name: "Haka",
    description: "Screener teknikal saham Bursa Efek Indonesia",
    start_url: "/",
    display: "standalone",
    background_color: "#060a14",
    theme_color: "#060a14",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
