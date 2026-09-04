import type { Metadata, Viewport } from "next";
import { DriverPwa } from "./driver-pwa";

export const metadata: Metadata = {
  title: "VK Driver",
  description: "Vidya's Kitchen delivery app",
  // Without this, /driver inherits the customer manifest and "Add to Home
  // Screen" installs the food app — whose start_url is `/`, not deliveries.
  manifest: "/driver/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "VK Driver",
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
