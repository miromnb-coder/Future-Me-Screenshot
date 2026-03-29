import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Future Me",
    short_name: "Future Me",
    description: "Talk to your future self in a clean, persistent chat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ebe4d8",
    theme_color: "#101826",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
