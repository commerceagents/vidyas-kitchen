import type { MetadataRoute } from "next";

const CITY = process.env.NEXT_PUBLIC_DELIVERY_CITY || "Sivakasi";

/** Customer PWA. Served at /manifest.webmanifest via a route, not app/manifest.ts
 *  — that special file always injects a root <link rel="manifest"> and won
 *  over the driver layout, so /driver installed the food app. */
export function customerManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vidya's Kitchen",
    short_name: "Vidya's Kitchen",
    description: `Premium home-style gourmet food, cooked fresh and delivered across ${CITY}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F5F7",
    theme_color: "#0d0d0d",
    categories: ["food", "lifestyle", "shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
