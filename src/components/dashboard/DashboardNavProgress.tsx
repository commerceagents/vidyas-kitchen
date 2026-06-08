"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function DashboardNavProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setLoading(true);
    setProgress(30);

    const t1 = setTimeout(() => setProgress(60), 80);
    const t2 = setTimeout(() => setProgress(85), 200);
    const t3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setLoading(false), 180);
    }, 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname]);

  if (!loading) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #f5e32d, #F5A623)",
          borderRadius: "0 2px 2px 0",
          transition: progress === 100 ? "width 0.18s ease, opacity 0.18s ease" : "width 0.25s ease",
          opacity: progress === 100 ? 0 : 1,
          boxShadow: "0 0 8px rgba(245,227,45,0.4)",
        }}
      />
    </div>
  );
}
