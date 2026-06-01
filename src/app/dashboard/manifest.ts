import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VK Dashboard",
    short_name: "VK Dash",
    description: "Vidya's Kitchen — owner operations",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#F5C518",
    icons: [
      { src: "/vk-logo.png", sizes: "192x192", type: "image/png" },
      { src: "/vk_logo_full.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
