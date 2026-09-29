"use client";

import { useEffect, useState } from "react";

type PromoBanner = {
  id: string;
  title: string;
  imageUrl: string | null;
  message: string;
  discountPct: number;
};

const ROTATE_MS = 4500;

/** Confirmed banners whose dates include today. Text sits on top of the photo. */
export function PromoBannerStrip() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/banners/active")
      .then((res) => (res.ok ? res.json() : { banners: [] }))
      .then((body: { banners?: PromoBanner[] }) => {
        if (!cancelled) setBanners(Array.isArray(body.banners) ? body.banners : []);
      })
      .catch(() => {
        if (!cancelled) setBanners([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % banners.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const banner = banners[index % banners.length];
  if (!banner) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 20,
          overflow: "hidden",
          background: "linear-gradient(145deg, #3a120c 0%, #BD2320 55%, #f5e32d 140%)",
        }}
      >
        {banner.imageUrl && (
          <img
            src={banner.imageUrl}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.05) 55%)",
          }}
        />
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: "#fff" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>
            {Math.round(banner.discountPct)}% OFF
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>{banner.title}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.35, color: "rgba(255,255,255,0.88)" }}>
            {banner.message}
          </p>
        </div>
      </div>
      {banners.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
          {banners.map((item, dot) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Banner ${dot + 1}`}
              onClick={() => setIndex(dot)}
              style={{
                width: dot === index % banners.length ? 16 : 6,
                height: 6,
                borderRadius: 99,
                border: 0,
                padding: 0,
                background: dot === index % banners.length ? "#BD2320" : "rgba(0,0,0,0.2)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
