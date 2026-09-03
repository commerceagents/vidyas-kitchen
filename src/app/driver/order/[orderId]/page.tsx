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
  Check,
  X,
  Banknote,
} from "lucide-react";
import { haversineMeters } from "@/lib/geo";
import { normalizeOrderStatus, OrderStatus, PaymentStatus, COD_FAILURE_REASONS, formatOrderRef } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { D, RADIUS } from "../../driver-theme";
import { DriverAuthShell, useSignedInDriver } from "../../driver-auth-gate";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

type MenuRef = { name?: string | null; image_url?: string | null } | null;
type ItemRow = { quantity?: number | null; menu_items?: MenuRef };
type UserRef = { full_name?: string | null; phone_number?: string | null } | null;

type DriverOrder = {
  id: string;
  order_number?: number | null;
  status: string;
  delivery_address?: string | null;
  delivery_slot?: string | null;
  delivery_slot_kind?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  phone_number?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  cod_collected_at?: string | null;
  total_amount?: number | null;
  users?: UserRef;
  order_items?: ItemRow[] | null;
};

const PROXIMITY_UNLOCK_M = 100;
const LOCATION_POST_MS = 12_000;

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase());
}

// ─── Swipe to confirm ────────────────────────────────────────────────────────
function SwipeAction({
  onSwipe,
  disabled,
  label,
  doneLabel,
}: {
  onSwipe: () => Promise<void>;
  disabled?: boolean;
  label: string;
  doneLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [completed, setCompleted] = useState(false);
  // Ref rather than state: guards against a second swipe landing while the
  // async action is in-flight, without triggering an extra render.
  const inFlightRef = useRef(false);
  const startXRef = useRef(0);
  const HANDLE = 52;

  const getMaxOffset = () => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - HANDLE - 8;
  };

  const handleStart = (clientX: number) => {
    if (disabled || completed || inFlightRef.current) return;
    setDragging(true);
    startXRef.current = clientX - offsetX;
  };

  const handleMove = (clientX: number) => {
    if (!dragging) return;
    setOffsetX(Math.max(0, Math.min(clientX - startXRef.current, getMaxOffset())));
  };

  const handleEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const max = getMaxOffset();
    if (offsetX > max * 0.85) {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setCompleted(true);
      setOffsetX(max);
      if (navigator.vibrate) navigator.vibrate(60);
      // Brief pause so the "done" animation is visible before the network call.
      setTimeout(() => {
        void (async () => {
          try {
            await onSwipe();
            // On success the page navigates away; nothing to reset.
          } catch {
            // The action failed — reset so the driver can swipe again.
            setCompleted(false);
            setOffsetX(0);
            inFlightRef.current = false;
          }
        })();
      }, 180);
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
        height: 60,
        borderRadius: RADIUS.control,
        background: completed ? D.green : "rgba(0,0,0,0.05)",
        border: `1px solid ${completed ? D.green : D.border}`,
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        opacity: disabled ? 0.45 : 1,
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: 800,
          fontFamily: D.font,
          color: completed ? "#fff" : D.muted,
          opacity: completed ? 1 : 1 - progress * 0.8,
          letterSpacing: "-0.01em",
          pointerEvents: "none",
        }}
      >
        {completed ? doneLabel : label}
      </div>

      <div
        style={{
          position: "absolute",
          top: 4,
          left: 4 + offsetX,
          width: HANDLE,
          height: HANDLE,
          borderRadius: 12,
          background: completed ? "#fff" : D.red,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          cursor: disabled ? "not-allowed" : "grab",
          transition: dragging ? "none" : "left 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke={completed ? D.green : "#fff"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {completed ? <polyline points="20 6 9 17 4 12" /> : <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>}
        </svg>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function DriverOrderDetailPage() {
  return (
    <DriverAuthShell>
      <DriverOrderDetailInner />
    </DriverAuthShell>
  );
}

function DriverOrderDetailInner() {
  const params = useParams();
  const router = useRouter();
  const { logout } = useSignedInDriver();
  const orderId = String(params.orderId || "");

  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [pickingUp, setPickingUp] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [failing, setFailing] = useState(false);

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
      if (res.status === 401) {
        await logout();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string; order?: DriverOrder };
      if (!res.ok) throw new Error(j.error || "Could not load order");
      setOrder(j.order || null);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [orderId, logout]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const nStatus = order ? normalizeOrderStatus(order.status) : "";
  const isReady = nStatus === OrderStatus.READY;
  const isOut = nStatus === OrderStatus.OUT_FOR_DELIVERY;

  const dropLat = order?.delivery_lat != null ? Number(order.delivery_lat) : null;
  const dropLng = order?.delivery_lng != null ? Number(order.delivery_lng) : null;
  const hasDropPin = dropLat != null && dropLng != null && Number.isFinite(dropLat) && Number.isFinite(dropLng);

  const distanceM = useMemo(() => {
    if (!hasDropPin || geoLat == null || geoLng == null) return null;
    return haversineMeters(geoLat, geoLng, dropLat!, dropLng!);
  }, [hasDropPin, geoLat, geoLng, dropLat, dropLng]);

  // Proximity is a sanity check, not a lock. If we have a fix, hold the driver
  // to it; if GPS is denied, timed out or unavailable there is no fix to check
  // against, and refusing to complete the delivery would strand a driver who is
  // standing at the door with the food.
  const hasFix = geoLat != null && geoLng != null;
  const withinRange =
    !hasDropPin ||
    !hasFix ||
    (distanceM != null && distanceM <= PROXIMITY_UNLOCK_M) ||
    process.env.NODE_ENV === "development";

  const isCod = (order?.payment_method || "").toLowerCase() === "cod";
  const cashOutstanding = isCod && String(order?.payment_status || PaymentStatus.PENDING) !== PaymentStatus.PAID;
  const canMarkDelivered = withinRange && (!cashOutstanding || cashConfirmed);

  // GPS tracking while en route
  useEffect(() => {
    if (!isOut || typeof window === "undefined") return;
    if (!navigator.geolocation) { setGeoErr("Location not supported on this device"); return; }

    const tick = () => {
      const p = lastPos.current;
      if (p) void postLocation(p.lat, p.lng);
    };

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        lastPos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        setGeoLat(p.coords.latitude);
        setGeoLng(p.coords.longitude);
        setGeoErr(null);
      },
      // Browsers word these differently ("Timeout expired", "User denied
      // Geolocation"); a driver needs to know what to do, not what the spec
      // calls it.
      (err) =>
        setGeoErr(
          err.code === err.PERMISSION_DENIED
            ? "Location is off — turn it on so the kitchen can see your progress. You can still complete the delivery."
            : err.code === err.TIMEOUT
              ? "Can't get a GPS fix right now. Delivery still works; tracking will resume on its own."
              : "Location unavailable — delivery still works, but the kitchen can't track you.",
        ),
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

      const customerEl = document.createElement("div");
      customerEl.innerHTML = `<div style="width:30px;height:30px;border-radius:50%;background:${D.red};border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;
      new mapboxgl.Marker({ element: customerEl }).setLngLat([dropLng!, dropLat!]).addTo(map);

      mapRef.current = map;
    })();

    return () => { cancelled = true; };
  }, [hasDropPin, dropLat, dropLng]);

  useEffect(() => {
    if (!mapRef.current || geoLat == null || geoLng == null) return;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (!driverMarkerRef.current) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:${D.green};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25)"></div>`;
        driverMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([geoLng, geoLat]).addTo(mapRef.current!);
      } else {
        driverMarkerRef.current.setLngLat([geoLng, geoLat]);
      }

      if (hasDropPin) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([dropLng!, dropLat!]);
        bounds.extend([geoLng, geoLat]);
        mapRef.current!.fitBounds(bounds, { padding: 64, maxZoom: 16, duration: 900 });
      }
    })();
  }, [geoLat, geoLng, hasDropPin, dropLat, dropLng]);

  const handlePickup = async () => {
    setPickingUp(true);
    setActionErr(null);
    try {
      const res = await fetch("/api/orders/driver/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Pickup failed");
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Pickup failed");
    } finally {
      setPickingUp(false);
    }
  };

  const handleComplete = async () => {
    setActionErr(null);
    try {
      const res = await fetch("/api/orders/driver/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The drop coordinates are a nice-to-have audit trail. Withholding
        // completion until GPS cooperates would leave a delivered order stuck
        // open, so send what we have and let the server treat them as optional.
        body: JSON.stringify({
          orderId,
          ...(geoLat != null && geoLng != null ? { lat: geoLat, lng: geoLng } : {}),
          codCollected: cashOutstanding ? true : undefined,
        }),
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not complete");
      router.push("/driver");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not complete";
      setActionErr(msg);
      // Re-throw so SwipeAction can reset itself and let the driver retry.
      throw e;
    }
  };

  const handleFailed = async (reason: string) => {
    setFailing(true);
    setActionErr(null);
    try {
      const res = await fetch("/api/orders/driver/undelivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason }),
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not update order");
      router.push("/driver");
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Could not update order");
      setFailOpen(false);
    } finally {
      setFailing(false);
    }
  };

  const orderedByName = order?.users?.full_name?.trim() || "Customer";
  const hasRecipient = Boolean(order?.recipient_name?.trim() || order?.recipient_phone?.trim());
  const customerName = order?.recipient_name?.trim() || orderedByName;
  const callPhone = order?.recipient_phone?.trim() || order?.users?.phone_number || order?.phone_number || "";
  const items = order?.order_items || [];
  const slotLine = formatSlotLineForCustomer(order?.delivery_slot ?? undefined, order?.delivery_slot_kind ?? undefined);
  const amount = order?.total_amount != null ? Math.round(Number(order.total_amount)) : null;

  const mapsUrl = hasDropPin
    ? `https://www.google.com/maps/dir/?api=1&destination=${dropLat},${dropLng}`
    : order?.delivery_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`
      : "";

  if (loadErr) {
    return (
      <Shell>
        <p style={{ color: D.red, fontWeight: 700, fontSize: 15, margin: 0 }}>{loadErr}</p>
        <Link href="/driver" style={{ color: D.muted, fontSize: 14, textDecoration: "underline" }}>Back to queue</Link>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <Loader2 size={26} style={{ color: D.faint, animation: "spin 1s linear infinite" }} />
        <p style={{ color: D.muted, fontSize: 14, margin: 0, fontWeight: 600 }}>Loading order…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Shell>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: D.bg, fontFamily: D.font, display: "flex", flexDirection: "column", color: D.text }}>
      {/* Map */}
      <div style={{ position: "relative", width: "100%", height: "40dvh", minHeight: 250, flexShrink: 0 }}>
        {MAPBOX_TOKEN && hasDropPin ? (
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={38} strokeWidth={1.4} style={{ color: D.faint }} />
          </div>
        )}

        <Link
          href="/driver"
          style={{
            position: "absolute",
            top: "max(14px, env(safe-area-inset-top, 12px))",
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 12,
            background: D.surface,
            border: `1px solid ${D.border}`,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: D.text,
            textDecoration: "none",
            zIndex: 10,
          }}
        >
          <ArrowLeft size={19} strokeWidth={2.2} />
        </Link>

        {distanceM != null && (
          <div
            style={{
              position: "absolute",
              top: "max(14px, env(safe-area-inset-top, 12px))",
              right: 16,
              zIndex: 10,
              padding: "9px 14px",
              borderRadius: 12,
              background: D.surface,
              border: `1px solid ${D.border}`,
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.01em" }}>
              {distanceM < 1000 ? `${Math.round(distanceM)} m away` : `${(distanceM / 1000).toFixed(1)} km away`}
            </span>
          </div>
        )}
      </div>

      {/* Sheet */}
      <div
        style={{
          flex: 1,
          marginTop: -20,
          borderRadius: "22px 22px 0 0",
          background: D.bg,
          position: "relative",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          padding: "0 18px",
          paddingBottom: "max(22px, env(safe-area-inset-bottom, 16px))",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "9px 0 5px" }}>
          <div style={{ width: 34, height: 4, borderRadius: 4, background: "rgba(0,0,0,0.14)" }} />
        </div>

        {/* Customer */}
        <div style={{ background: D.surface, borderRadius: RADIUS.card, border: `1px solid ${D.border}`, padding: 15, display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>{toTitleCase(customerName)}</h2>
                {hasRecipient && (
                  <span style={{ padding: "2px 7px", borderRadius: 6, background: "rgba(0,0,0,0.05)", color: D.muted, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em" }}>
                    RECIPIENT
                  </span>
                )}
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: D.muted, fontWeight: 600 }}>
                {hasRecipient ? `Ordered by ${toTitleCase(orderedByName)} · ` : ""}
                {formatOrderRef(order.order_number, orderId)}
              </p>
            </div>
            {slotLine && (
              <span style={{ padding: "5px 10px", borderRadius: 9, background: "rgba(0,0,0,0.05)", color: D.text, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                {slotLine}
              </span>
            )}
          </div>

          {cashOutstanding && amount != null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "13px 14px",
                borderRadius: 12,
                background: D.redFaint,
                border: `1px solid rgba(189,35,32,0.2)`,
              }}
            >
              <Banknote size={22} strokeWidth={1.9} style={{ color: D.red, flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: D.red, letterSpacing: "0.08em" }}>COLLECT CASH</p>
                <p style={{ margin: "1px 0 0", fontSize: 20, fontWeight: 800, color: D.red, letterSpacing: "-0.02em" }}>
                  ₹{amount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          )}

          {isCod && !cashOutstanding && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: D.greenFaint }}>
              <Check size={16} strokeWidth={2.6} style={{ color: D.green }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: D.green }}>Cash already collected</span>
            </div>
          )}

          <Row icon={<MapPin size={15} strokeWidth={2} style={{ color: D.faint }} />}>
            {order.delivery_address || "No address provided"}
          </Row>

          {items.length > 0 && (
            <Row icon={<Package size={15} strokeWidth={2} style={{ color: D.faint }} />}>
              {items
                .map((it) => `${Math.max(1, Math.floor(Number(it.quantity) || 1))}× ${toTitleCase(it.menu_items?.name || "Item")}`)
                .join(", ")}
            </Row>
          )}
        </div>

        {/* Call / Navigate */}
        <div style={{ display: "flex", gap: 10 }}>
          {callPhone && (
            <SecondaryLink href={`tel:${callPhone.replace(/\s/g, "")}`} icon={<Phone size={17} strokeWidth={2.1} />}>
              Call
            </SecondaryLink>
          )}
          {mapsUrl && (
            <SecondaryLink href={mapsUrl} external icon={<Navigation size={17} strokeWidth={2.1} />}>
              Navigate
            </SecondaryLink>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 12 }} />

        {actionErr && (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: D.red, background: D.redFaint, padding: "10px 12px", borderRadius: 11 }}>
            {actionErr}
          </p>
        )}

        {isReady && (
          <button
            type="button"
            disabled={pickingUp}
            onClick={() => void handlePickup()}
            style={{
              width: "100%",
              height: 56,
              borderRadius: RADIUS.control,
              border: "none",
              background: D.red,
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
              fontFamily: D.font,
              cursor: pickingUp ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
            }}
          >
            {pickingUp ? <Loader2 size={19} style={{ animation: "spin 1s linear infinite" }} /> : <Package size={19} strokeWidth={2.1} />}
            {pickingUp ? "Picking up…" : "Picked up order"}
          </button>
        )}

        {isOut && (
          <>
            {geoErr && (
              <p style={{ fontSize: 12.5, color: D.amber, margin: 0, padding: "9px 12px", background: D.amberFaint, borderRadius: 11, fontWeight: 600 }}>
                {geoErr}
              </p>
            )}

            {cashOutstanding && amount != null && (
              <button
                type="button"
                onClick={() => setCashConfirmed((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  width: "100%",
                  padding: "13px 14px",
                  borderRadius: RADIUS.control,
                  background: cashConfirmed ? D.greenFaint : D.surface,
                  border: `1px solid ${cashConfirmed ? "rgba(18,131,63,0.35)" : D.border}`,
                  cursor: "pointer",
                  fontFamily: D.font,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: cashConfirmed ? D.green : "transparent",
                    border: `2px solid ${cashConfirmed ? D.green : D.borderStrong}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cashConfirmed && <Check size={14} strokeWidth={3.2} style={{ color: "#fff" }} />}
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: cashConfirmed ? D.green : D.text }}>
                  I collected ₹{amount.toLocaleString("en-IN")} in cash
                </span>
              </button>
            )}

            {!withinRange && distanceM != null && (
              <p style={{ fontSize: 12, color: D.muted, margin: 0, textAlign: "center", fontWeight: 600 }}>
                {Math.round(distanceM)} m away — move within {PROXIMITY_UNLOCK_M} m to deliver.
              </p>
            )}

            <SwipeAction
              label={cashOutstanding && !cashConfirmed ? "Confirm cash first" : "Swipe to mark delivered"}
              doneLabel="Delivered"
              disabled={!canMarkDelivered}
              onSwipe={handleComplete}
            />

            <button
              type="button"
              onClick={() => setFailOpen(true)}
              style={{
                background: "none",
                border: "none",
                color: D.muted,
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: D.font,
                padding: "6px 0",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Couldn&apos;t deliver this order
            </button>
          </>
        )}

        {!isReady && !isOut && (
          <div style={{ textAlign: "center", padding: "22px 0" }}>
            <p style={{ color: D.muted, fontSize: 14, margin: 0, fontWeight: 600 }}>This order is no longer in your queue.</p>
            <Link href="/driver" style={{ color: D.red, fontSize: 14, fontWeight: 700, textDecoration: "underline", marginTop: 8, display: "inline-block" }}>
              Back to list
            </Link>
          </div>
        )}
      </div>

      {failOpen && (
        <FailSheet
          busy={failing}
          isCod={isCod}
          onClose={() => setFailOpen(false)}
          onPick={(reason) => void handleFailed(reason)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: D.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 14,
        fontFamily: D.font,
      }}
    >
      {children}
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <p style={{ margin: 0, fontSize: 13.5, color: D.muted, lineHeight: 1.45, fontWeight: 600 }}>{children}</p>
    </div>
  );
}

function SecondaryLink({
  href,
  icon,
  children,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      style={{
        flex: 1,
        height: 50,
        borderRadius: RADIUS.control,
        background: D.surface,
        border: `1px solid ${D.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: D.text,
        textDecoration: "none",
        fontSize: 14.5,
        fontWeight: 700,
        fontFamily: D.font,
      }}
    >
      {icon}
      {children}
    </a>
  );
}

function FailSheet({
  busy,
  isCod,
  onClose,
  onPick,
}: {
  busy: boolean;
  isCod: boolean;
  onClose: () => void;
  onPick: (reason: string) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-end",
        fontFamily: D.font,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: D.surface,
          borderRadius: "22px 22px 0 0",
          padding: "18px 18px max(22px, env(safe-area-inset-bottom, 16px))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>What went wrong?</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: D.muted, fontWeight: 600, lineHeight: 1.45 }}>
              {isCod
                ? "The kitchen will follow up, and this number won't be able to use cash on delivery again."
                : "The kitchen will be notified to follow up with the customer."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "none",
              background: "rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} strokeWidth={2.4} style={{ color: D.muted }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(COD_FAILURE_REASONS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => onPick(key)}
              style={{
                width: "100%",
                padding: "15px 16px",
                borderRadius: RADIUS.control,
                border: `1px solid ${D.border}`,
                background: D.bg,
                color: D.text,
                fontSize: 14.5,
                fontWeight: 700,
                fontFamily: D.font,
                textAlign: "left",
                cursor: busy ? "wait" : "pointer",
                opacity: busy ? 0.5 : 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
