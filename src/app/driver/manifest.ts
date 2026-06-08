import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VK Driver",
    short_name: "VK Driver",
    description: "Vidya's Kitchen delivery app",
    start_url: "/driver",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#f5e32d",
    icons: [
      { src: "/vk-logo.png", sizes: "192x192", type: "image/png" },
      { src: "/vk_logo_full.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
