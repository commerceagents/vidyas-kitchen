import type { MetadataRoute } from "next";

export function dashboardManifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "VK Dashboard",
    short_name: "VK Dash",
    description: "Vidya's Kitchen — owner operations",
    start_url: "/dashboard",
    scope: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0B0F",
    theme_color: "#F5C518",
    icons: [
      { src: "/dashboard-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/dashboard-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Launchers crop maskable icons to their own shape. These keep the crest
      // inside the area that survives a circle, so nothing is cut off.
      { src: "/dashboard-icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/dashboard-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
