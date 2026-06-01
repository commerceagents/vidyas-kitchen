import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vidya's Kitchen",
    short_name: "VK",
    description: "Premium home-style gourmet food from Sivakasi",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#BD2320",
    icons: [
      { src: "/vk-logo.png", sizes: "192x192", type: "image/png" },
      { src: "/vk_logo_full.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
