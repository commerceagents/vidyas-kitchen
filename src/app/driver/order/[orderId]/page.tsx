"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Package,
  User,
  Clock,
} from "lucide-react";
import { haversineMeters } from "@/lib/geo";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";

const YELLOW = "#f5e32d";
const FONT = "var(--font-outfit), system-ui, sans-serif";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

type MenuRef = { name?: string | null; image_url?: string | null } | null;
type ItemRow = { quantity?: number | null; menu_items?: MenuRef };
type UserRef = { full_name?: string | null; phone_number?: string | null } | null;

type DriverOrder = {
  id: string;
  status: string;
  delivery_address?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  phone_number?: string | null;
  users?: UserRef;
  order_items?: ItemRow[] | null;
};

const PROXIMITY_UNLOCK_M = 100;
const LOCATION_POST_MS = 12_000;

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase());
}

// ─── Swipe-to-Deliver Button ─────────────────────────────────────────────────
function SwipeToDeliver({ onSwipe, disabled, label }: { onSwipe: () => void; disabled?: boolean; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startXRef = useRef(0);
  const HANDLE = 56;

  const getMaxOffset = () => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - HANDLE - 8;
  };

  const handleStart = (clientX: number) => {
    if (disabled || completed) return;
    setDragging(true);
    startXRef.current = clientX - offsetX;
  };

  const handleMove = (clientX: number) => {
    if (!dragging) return;
    const max = getMaxOffset();
    const x = Math.max(0, Math.min(clientX - startXRef.current, max));
    setOffsetX(x);
  };

  const handleEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const max = getMaxOffset();
    if (offsetX > max * 0.85) {
      setCompleted(true);
      setOffsetX(max);
      if (navigator.vibrate) navigator.vibrate(100);
      setTimeout(onSwipe, 200);
    } else {
      setOffsetX(0);
    }
  };

  const progress = getMaxOffset() > 0 ? offsetX / getMaxOffset() : 0;

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        height: "64px",
        borderRadius: "16px",
        background: completed ? "#22c55e" : "#1a1a1a",
        border: `1px solid ${completed ? "#22c55e" : "#2a2a2a"}`,
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        opacity: disabled ? 0.4 : 1,
        transition: "background 0.3s ease, border 0.3s ease",
      }}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => { if (dragging) handleMove(e.clientX); }}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging) handleEnd(); }}
    >
      {/* Progress fill */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${Math.max(0, offsetX + HANDLE + 8)}px`,
          background: `linear-gradient(90deg, ${YELLOW}20, ${YELLOW}40)`,
          borderRadius: "16px",
          transition: dragging ? "none" : "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "15px",
          fontWeight: 700,
          fontFamily: FONT,
          color: completed ? "#fff" : `rgba(255,255,255,${0.5 - progress * 0.4})`,
          letterSpacing: "-0.01em",
          transition: dragging ? "none" : "color 0.3s ease",
          pointerEvents: "none",
        }}
      >
        {completed ? "Delivered!" : label}
      </div>

      {/* Draggable handle */}
      <div
        style={{
          position: "absolute",
          top: "4px",
          left: `${4 + offsetX}px`,
          width: `${HANDLE}px`,
          height: `${HANDLE}px`,
          borderRadius: "14px",
          background: completed ? "#fff" : YELLOW,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 16px ${YELLOW}40`,
          cursor: disabled ? "not-allowed" : "grab",
          transition: dragging ? "none" : "left 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={completed ? "#22c55e" : "#000"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {completed ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DriverOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params.orderId || "");

  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [pickingUp, setPickingUp] = useState(false);

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const postTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const postLocation = useCallback(
    (lat: number, lng: number) =>
      fetch("/api/orders/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, lat, lng }),
      }).catch(() => {}),
    [orderId],
  );

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/driver-order?id=${encodeURIComponent(orderId)}`);
      const j = (await res.json().catch(() => ({}))) as { error?: string; order?: DriverOrder };
      if (!res.ok) throw new Error(j.error || "Could not load order");
      setOrder(j.order || null);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const nStatus = order ? normalizeOrderStatus(order.status) : "";
  const isReady = nStatus === OrderStatus.READY || nStatus === "ready";
  const isOut = nStatus === OrderStatus.OUT_FOR_DELIVERY || nStatus === "out" || nStatus === "out_for_delivery";

  const dropLat = order?.delivery_lat != null ? Number(order.delivery_lat) : null;
  const dropLng = order?.delivery_lng != null ? Number(order.delivery_lng) : null;
  const hasDropPin = dropLat != null && dropLng != null && Number.isFinite(dropLat) && Number.isFinite(dropLng);

  const distanceM = useMemo(() => {
    if (!hasDropPin || geoLat == null || geoLng == null) return null;
    return haversineMeters(geoLat, geoLng, dropLat!, dropLng!);
  }, [hasDropPin, geoLat, geoLng, dropLat, dropLng]);

  const canMarkDelivered =
    !hasDropPin || (distanceM != null && distanceM <= PROXIMITY_UNLOCK_M) || process.env.NODE_ENV === "development";

  // GPS tracking
  useEffect(() => {
    if (!isOut || typeof window === "undefined") return;
    if (!navigator.geolocation) { setGeoErr("Location not supported"); return; }

    const tick = () => {
      const p = lastPos.current;
      if (p) void postLocation(p.lat, p.lng);
    };

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        lastPos.current = { lat, lng };
        setGeoLat(lat);
        setGeoLng(lng);
      },
      (err) => setGeoErr(err.message || "Location error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    postTimer.current = setInterval(tick, LOCATION_POST_MS);
    const once = window.setTimeout(tick, 2000);

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (postTimer.current) clearInterval(postTimer.current);
      window.clearTimeout(once);
    };
  }, [isOut, postLocation]);

  // Mapbox initialization
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || !hasDropPin || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: MAP_STYLE,
        center: [dropLng!, dropLat!],
        zoom: 14,
        attributionControl: false,
        interactive: true,
      });

      // Customer pin (yellow)
      const customerEl = document.createElement("div");
      customerEl.innerHTML = `<div style="width:32px;height:32px;border-radius:10px;background:${YELLOW};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(245,227,45,0.4)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;
      new mapboxgl.Marker({ element: customerEl }).setLngLat([dropLng!, dropLat!]).addTo(map);

      mapRef.current = map;
    })();

    return () => { cancelled = true; };
  }, [hasDropPin, dropLat, dropLng]);

  // Update driver marker on GPS change
  useEffect(() => {
    if (!mapRef.current || geoLat == null || geoLng == null) return;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (!driverMarkerRef.current) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`;
        driverMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([geoLng, geoLat]).addTo(mapRef.current!);
      } else {
        driverMarkerRef.current.setLngLat([geoLng, geoLat]);
      }

      // Fit map to show both pins
      if (hasDropPin) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([dropLng!, dropLat!]);
        bounds.extend([geoLng, geoLat]);
        mapRef.current!.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 });
      }
    })();
  }, [geoLat, geoLng, hasDropPin, dropLat, dropLng]);

  const handlePickup = async () => {
    setPickingUp(true);
    try {
      const res = await fetch("/api/orders/driver/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Pickup failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Pickup failed");
    } finally {
      setPickingUp(false);
    }
  };

  const handleComplete = async () => {
    if (geoLat == null || geoLng == null) {
      alert("Waiting for GPS — enable location and try again.");
      return;
    }
    try {
      const res = await fetch("/api/orders/driver/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, lat: geoLat, lng: geoLng }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not complete");
      router.push("/driver");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not complete");
    }
  };

  const customerName = order?.users?.full_name?.trim() || "Customer";
  const callPhone = order?.users?.phone_number || order?.phone_number || "";
  const items = order?.order_items || [];
  const slotLine = formatSlotLineForCustomer(order?.delivery_slot ?? undefined, order?.delivery_slot_kind ?? undefined);

  const mapsUrl = hasDropPin
    ? `https://www.google.com/maps/dir/?api=1&destination=${dropLat},${dropLng}`
    : order?.delivery_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`
      : "";

  // ── Loading / Error states ──
  if (loadErr) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0d0d0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", gap: "16px", fontFamily: FONT }}>
        <p style={{ color: "#f87171", fontWeight: 600, fontSize: "15px" }}>{loadErr}</p>
        <Link href="/driver" style={{ color: `${YELLOW}90`, fontSize: "14px", textDecoration: "underline" }}>Back to queue</Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0d0d0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", fontFamily: FONT }}>
        <Loader2 size={32} style={{ color: YELLOW, animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#666", fontSize: "14px" }}>Loading order...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", fontFamily: FONT, display: "flex", flexDirection: "column", color: "#fff" }}>
      {/* ── Map Section ── */}
      <div style={{ position: "relative", width: "100%", height: "45dvh", minHeight: "280px", flexShrink: 0 }}>
        {/* Map container */}
        {MAPBOX_TOKEN && hasDropPin ? (
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={48} style={{ color: "#333" }} />
          </div>
        )}

        {/* Overlay: Back button */}
        <Link
          href="/driver"
          style={{
            position: "absolute",
            top: "max(16px, env(safe-area-inset-top, 12px))",
            left: "16px",
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "rgba(13,13,13,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid #2a2a2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            textDecoration: "none",
            zIndex: 10,
          }}
        >
          <ArrowLeft size={20} />
        </Link>

        {/* Overlay: Navigation title */}
        <div style={{
          position: "absolute",
          top: "max(20px, env(safe-area-inset-top, 16px))",
          left: "72px",
          zIndex: 10,
        }}>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.6)", letterSpacing: "-0.02em" }}>Navigation</p>
        </div>

        {/* Distance badge */}
        {distanceM != null && (
          <div style={{
            position: "absolute",
            top: "max(20px, env(safe-area-inset-top, 16px))",
            right: "16px",
            zIndex: 10,
            padding: "6px 14px",
            borderRadius: "10px",
            background: "rgba(13,13,13,0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid #2a2a2a",
          }}>
            <span style={{ fontSize: "14px", fontWeight: 800, color: YELLOW }}>
              {distanceM < 1000 ? `${Math.round(distanceM)}m` : `${(distanceM / 1000).toFixed(1)}km`}
            </span>
          </div>
        )}

        {/* Gradient fade to card */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "80px", background: "linear-gradient(to top, #0d0d0d, transparent)", pointerEvents: "none" }} />
      </div>

      {/* ── Bottom Card ── */}
      <div style={{
        flex: 1,
        marginTop: "-24px",
        borderRadius: "24px 24px 0 0",
        background: "#0d0d0d",
        position: "relative",
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        padding: "0 20px",
        paddingBottom: "max(24px, env(safe-area-inset-bottom, 16px))",
        gap: "16px",
      }}>
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "4px", background: "#333" }} />
        </div>

        {/* Customer info card */}
        <div style={{ background: "#1a1a1a", borderRadius: "16px", border: "1px solid #2a2a2a", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${YELLOW}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={22} style={{ color: YELLOW }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" }}>{toTitleCase(customerName)}</h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#666", fontWeight: 600 }}>Order #{orderId.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            {slotLine && (
              <span style={{ padding: "4px 10px", borderRadius: "8px", background: `${YELLOW}15`, color: YELLOW, fontSize: "11px", fontWeight: 700 }}>
                {slotLine}
              </span>
            )}
          </div>

          {/* Address */}
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <MapPin size={16} style={{ color: YELLOW, flexShrink: 0, marginTop: "2px" }} />
            <p style={{ margin: 0, fontSize: "13px", color: "#999", lineHeight: 1.5 }}>{order.delivery_address || "No address provided"}</p>
          </div>

          {/* Items summary */}
          {items.length > 0 && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Package size={16} style={{ color: YELLOW, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "13px", color: "#999" }}>
                {items.map((it, i) => {
                  const q = Math.max(1, Math.floor(Number(it.quantity) || 1));
                  const name = it.menu_items?.name || "Item";
                  return `${q}× ${toTitleCase(name)}`;
                }).join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons: Call + Navigate */}
        <div style={{ display: "flex", gap: "12px" }}>
          {callPhone && (
            <a
              href={`tel:${callPhone.replace(/\s/g, "")}`}
              style={{
                flex: 1,
                height: "52px",
                borderRadius: "14px",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                color: "#fff",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 700,
                fontFamily: FONT,
              }}
            >
              <Phone size={18} style={{ color: YELLOW }} />
              Call
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                height: "52px",
                borderRadius: "14px",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                color: "#fff",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 700,
                fontFamily: FONT,
              }}
            >
              <Navigation size={18} style={{ color: YELLOW }} />
              Navigate
            </a>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action area */}
        {isReady && (
          <button
            type="button"
            disabled={pickingUp}
            onClick={() => void handlePickup()}
            style={{
              width: "100%",
              height: "56px",
              borderRadius: "14px",
              border: "none",
              background: YELLOW,
              color: "#000",
              fontSize: "16px",
              fontWeight: 800,
              fontFamily: FONT,
              cursor: pickingUp ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: `0 8px 24px ${YELLOW}30`,
            }}
          >
            {pickingUp ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <Package size={20} />}
            {pickingUp ? "Picking up..." : "Picked Up Order"}
          </button>
        )}

        {isOut && (
          <>
            {geoErr && (
              <p style={{ fontSize: "13px", color: `${YELLOW}cc`, margin: 0, padding: "8px 12px", background: `${YELLOW}10`, borderRadius: "10px", border: `1px solid ${YELLOW}20` }}>{geoErr}</p>
            )}
            {!canMarkDelivered && distanceM != null && (
              <p style={{ fontSize: "12px", color: "#666", margin: 0, textAlign: "center" }}>
                ~{Math.round(distanceM)}m away. Move within {PROXIMITY_UNLOCK_M}m to deliver.
              </p>
            )}
            <SwipeToDeliver
              label="Swipe to Deliver"
              disabled={!canMarkDelivered}
              onSwipe={handleComplete}
            />
          </>
        )}

        {!isReady && !isOut && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
              This order is no longer in the driver queue.
            </p>
            <Link href="/driver" style={{ color: `${YELLOW}90`, fontSize: "14px", textDecoration: "underline", marginTop: "8px", display: "inline-block" }}>Back to list</Link>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
