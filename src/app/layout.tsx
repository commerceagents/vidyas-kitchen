import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Caveat, Outfit } from "next/font/google";
import "./globals.css";
import { ClientLayout } from "@/components/layout/ClientLayout";

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vidya's Kitchen | Premium Home Catering",
  description:
    "Experience the finest home catering with Vidya's Kitchen. Fresh ingredients, traditional recipes, and modern convenience.",
  // iOS ignores the manifest's icons and reads these instead, so a home screen
  // install on Safari falls back to a screenshot of the page without them.
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Vidya's Kitchen",
    // The in-app splash is light on phones; a translucent bar would put dark
    // iOS status text on top of it rather than over our own header.
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0d0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning translate="no">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body
        className={`${jetBrainsMono.variable} ${caveat.variable} ${outfit.variable} antialiased selection:bg-primary selection:text-black overflow-x-hidden bg-black`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
