import type { MetadataRoute } from "next";

export function driverManifest(): MetadataRoute.Manifest {
  return {
    id: "/driver",
    name: "VK's Driver",
    short_name: "VK's Driver",
    description: "Vidya's Kitchen delivery app",
    start_url: "/driver",
    scope: "/driver",
    display: "standalone",
    orientation: "portrait",
    background_color: "#BD2320",
    theme_color: "#BD2320",
    icons: [
      { src: "/driver-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/driver-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Launchers crop maskable icons to their own shape. These keep the rider
      // inside the area that survives a circle, so nothing is cut off.
      { src: "/driver-icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/driver-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
