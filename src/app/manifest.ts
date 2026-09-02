import type { MetadataRoute } from "next";

const CITY = process.env.NEXT_PUBLIC_DELIVERY_CITY || "Chennai";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vidya's Kitchen",
    // Shown under the home screen icon and in the install prompt. "VK" was
    // unrecognisable next to the other apps on a launcher.
    short_name: "Vidya's Kitchen",
    description: `Premium home-style gourmet food, cooked fresh and delivered across ${CITY}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Android paints this behind the icon on the launch screen, before any of
    // our code runs. It has to match the in-app splash or the app opens with a
    // black flash that then snaps to white.
    background_color: "#F5F5F7",
    // Matches the `themeColor` in layout.tsx so the status bar doesn't change
    // colour between the browser tab and the installed app.
    theme_color: "#0d0d0d",
    categories: ["food", "lifestyle", "shopping"],
    icons: [
      // `any` icons are used wherever the platform shows the artwork
      // unmodified — iOS home screen, install dialogs, the task switcher.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `maskable` icons let Android crop to its own shape. Without these it
      // treats the icon as legacy art and shrinks it onto a white circle.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
