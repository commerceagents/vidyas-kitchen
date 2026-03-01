"use client";

import { useState } from "react";
import { SmoothScroll } from "@/components/effects/SmoothScroll";
import { SplashScreen } from "@/components/ui/SplashScreen";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <SplashScreen onComplete={() => setShowSplash(false)} />
      {!showSplash && <SmoothScroll>{children}</SmoothScroll>}
    </>
  );
}
