import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trailhead Simplified Content Co-pilot",
    short_name: "Trailhead Simplified",
    description: "A daily content workspace for Trailhead Simplified.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B111D",
    theme_color: "#0B111D",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
