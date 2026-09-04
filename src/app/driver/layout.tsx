import type { Metadata, Viewport } from "next";
import { DriverPwa } from "./driver-pwa";

export const metadata: Metadata = {
  title: "VK's Driver",
  description: "Vidya's Kitchen delivery app",
  manifest: "/driver/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/driver-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/driver-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/driver-apple-touch.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "VK's Driver",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#BD2320",
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DriverPwa />
      {children}
    </>
  );
}
