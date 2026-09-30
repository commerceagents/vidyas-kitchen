"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
  BellRing,
  QrCode,
} from "lucide-react";
import QRCode from "react-qr-code";
import { haversineMeters } from "@/lib/geo";
import { resolveOrderItemImageUrl } from "@/lib/menu/item-image";
import { normalizeOrderStatus, OrderStatus, PaymentStatus, COD_FAILURE_REASONS, formatOrderRef } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { D, RADIUS } from "../../driver-theme";
import { DriverAuthShell, useSignedInDriver } from "../../driver-auth-gate";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type MenuRef = { name?: string | null; image_url?: string | null } | null;
type ItemRow = { quantity?: number | null; menu_item_id?: string | null; menu_items?: MenuRef };
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
  driver_arrived_at?: string | null;
  total_amount?: number | null;
  users?: UserRef;
  order_items?: ItemRow[] | null;
  collectUpi?: { vpa: string; link: string | null; amount: number } | null;
};

/** Matches the server check in /api/orders/driver/complete. */
const PROXIMITY_UNLOCK_M = 120;
const LOCATION_POST_MS = 4_000;
/** Re-request the driving ETA only after the driver has actually moved this far. */
const ROUTE_REFRESH_M = 150;

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
        background: completed ? D.green : disabled ? "#2C2C2E" : "#E8492D",
        border: "none",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        opacity: 1,
        transition: "background 0.3s ease",
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
          color: completed || !disabled ? "#fff" : "#8E8E93",
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
          background: completed ? "#fff" : disabled ? "#3A3A3C" : "#fff",
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
          stroke={completed ? D.green : disabled ? "#8E8E93" : "#E8492D"}
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
  const [collectVia, setCollectVia] = useState<"cash" | "upi" | null>(null);
  const [upiOpen, setUpiOpen] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  // GPS can read hundreds of metres off between close buildings. The driver is
  // standing at the door holding the food; let them say so.
  const [gpsOverride, setGpsOverride] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [failing, setFailing] = useState(false);

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [geoAsking, setGeoAsking] = useState(false);
  // Bumped by "Turn on location" so the watch below restarts after the driver
  // grants permission — the browser only re-runs a watch that is re-created.
  const [geoNonce, setGeoNonce] = useState(0);
  const watchId = useRef<number | null>(null);
  const postTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const routeFromRef = useRef<{ lat: number; lng: number } | null>(null);
  const [route, setRoute] = useState<{ distanceM: number; durationS: number } | null>(null);

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
    gpsOverride ||
    (distanceM != null && distanceM <= PROXIMITY_UNLOCK_M) ||
    process.env.NODE_ENV === "development";

  const hasArrived = Boolean(order?.driver_arrived_at);
  const isCod = (order?.payment_method || "").toLowerCase() === "cod";
  const cashOutstanding = isCod && String(order?.payment_status || PaymentStatus.PENDING) !== PaymentStatus.PAID;
  const moneyMarked = !cashOutstanding || collectVia != null;
  // Cash or UPI is the unlock on a pay-at-the-door order. A GPS reading that
  // still says "too far" must not keep the swipe gray once the money is in
  // hand — phones in Sivakasi often sit hundreds of metres off between buildings.
  const deliverBlock: string | null = !moneyMarked
    ? "Mark the money collected first — cash or UPI"
    : !withinRange && !cashOutstanding
      ? `You're ${distanceM != null ? `${Math.round(distanceM)} m` : "too far"} from the drop — move within ${PROXIMITY_UNLOCK_M} m`
      : null;
  const canMarkDelivered = deliverBlock == null;

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
      (err) => {
        setGeoBlocked(err.code === err.PERMISSION_DENIED);
        setGeoErr(
          err.code === err.PERMISSION_DENIED
            ? "Location is off, so the kitchen and the customer can't see you moving. You can still complete the delivery."
            : err.code === err.TIMEOUT
              ? "Can't get a GPS fix right now. Delivery still works; tracking will resume on its own."
              : "Location unavailable — delivery still works, but nobody can track you.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    postTimer.current = setInterval(tick, LOCATION_POST_MS);
    const once = window.setTimeout(tick, 2000);

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (postTimer.current) clearInterval(postTimer.current);
      window.clearTimeout(once);
    };
  }, [isOut, postLocation, geoNonce]);

  const enableLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoErr("Location not supported on this device");
      return;
    }
    setGeoAsking(true);
    // getCurrentPosition is what actually surfaces the browser permission
    // prompt; watchPosition alone stays silent once it has been refused.
    navigator.geolocation.getCurrentPosition(
      (p) => {
        lastPos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        setGeoLat(p.coords.latitude);
        setGeoLng(p.coords.longitude);
        setGeoErr(null);
        setGeoBlocked(false);
        setGeoAsking(false);
        setGeoNonce((n) => n + 1);
        void postLocation(p.coords.latitude, p.coords.longitude);
      },
      (err) => {
        setGeoAsking(false);
        setGeoBlocked(err.code === err.PERMISSION_DENIED);
        setGeoErr(
          err.code === err.PERMISSION_DENIED
            ? "Your browser is blocking location for this site. Open the padlock in the address bar (or app settings) and allow Location, then tap again."
            : "Still can't get a fix. Step outside or check that phone location is switched on.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [postLocation]);

  // A locked screen suspends the GPS watch, which is why a customer used to see
  // nothing until the rider showed up and reopened the app. Hold a wake lock
  // while out for delivery, and push a fresh fix the moment the driver comes
  // back from Google Maps so their map catches up instead of staying frozen.
  useEffect(() => {
    if (!isOut || typeof document === "undefined") return;

    type WakeLockSentinelLike = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async () => {
      if (!nav.wakeLock) return;
      try {
        sentinel = await nav.wakeLock.request("screen");
      } catch {
        // Denied on some browsers / low battery. Tracking still works while
        // the driver keeps the screen on themselves.
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void acquire();
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (p) => {
          lastPos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
          setGeoLat(p.coords.latitude);
          setGeoLng(p.coords.longitude);
          void postLocation(p.coords.latitude, p.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [isOut, postLocation]);

  // Distance and ETA to the door. The driver navigates in Google Maps, so this
  // is only here to answer "how far am I?" without leaving the app — and it is
  // re-requested only after real movement, because the GPS watch fires every
  // few seconds and the Directions API is metered.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !hasDropPin || geoLat == null || geoLng == null) return;

    const from = routeFromRef.current;
    if (from && haversineMeters(from.lat, from.lng, geoLat, geoLng) < ROUTE_REFRESH_M) return;
    routeFromRef.current = { lat: geoLat, lng: geoLng };

    const ctrl = new AbortController();
    (async () => {
      try {
        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving/${geoLng},${geoLat};${dropLng},${dropLat}` +
          `?geometries=geojson&overview=false&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const j = (await res.json()) as { routes?: { distance?: number; duration?: number }[] };
        const best = j.routes?.[0];
        if (!best) throw new Error("no route");
        setRoute({ distanceM: Number(best.distance) || 0, durationS: Number(best.duration) || 0 });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        // The straight-line distance below still covers it, and Navigate is one
        // tap away. Clear the throttle so the next fix retries.
        routeFromRef.current = null;
      }
    })();

    return () => ctrl.abort();
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

  const handleArrived = async () => {
    setArriving(true);
    setActionErr(null);
    try {
      const res = await fetch("/api/orders/driver/arrived", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.status === 401) {
        await logout();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not mark arrival");
      if (navigator.vibrate) navigator.vibrate(40);
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Could not mark arrival");
    } finally {
      setArriving(false);
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
          // Sent so the server logs the real distance rather than the driver
          // simply withholding their position to slip past the check.
          ...((gpsOverride || (cashOutstanding && !withinRange)) ? { proximityOverride: true } : {}),
          codCollected: cashOutstanding ? true : undefined,
          codVia: cashOutstanding ? collectVia || "cash" : undefined,
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

  // A phone number is a worse heading than a name but a far better one than
  // the word "Customer" — the driver can read it back at the door.
  const orderedByName =
    order?.users?.full_name?.trim() ||
    (order?.users?.phone_number || order?.phone_number || "").trim() ||
    "Customer";
  const hasRecipient = Boolean(order?.recipient_name?.trim() || order?.recipient_phone?.trim());
  const customerName = order?.recipient_name?.trim() || orderedByName;
  const callPhone = order?.recipient_phone?.trim() || order?.users?.phone_number || order?.phone_number || "";
  const items = order?.order_items || [];
  const slotLine = formatSlotLineForCustomer(order?.delivery_slot ?? undefined, order?.delivery_slot_kind ?? undefined);
  const amount = order?.total_amount != null ? Math.round(Number(order.total_amount)) : null;

  // Driving time beats crow-flies distance for deciding whether to park now,
  // but the straight line is all we have until the first route comes back.
  const tripLabel = route
    ? `${Math.max(1, Math.round(route.durationS / 60))} min · ${(route.distanceM / 1000).toFixed(1)} km`
    : distanceM == null
      ? null
      : distanceM < 1000
        ? `${Math.round(distanceM)} m away`
        : `${(distanceM / 1000).toFixed(1)} km away`;

  // The pinned drop beats the typed address every time — it is the exact spot
  // the customer (or the gift recipient) dropped on the map at checkout, so
  // Google Maps routes to the door rather than to a street name.
  const mapsUrl = hasDropPin
    ? `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${dropLat},${dropLng}`
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
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#121212",
        fontFamily: D.font,
        color: D.text,
      }}
    >
      {/* Header — the one saturated red on this screen is the Navigate pill. */}
      <div
        style={{
          flexShrink: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "max(12px, env(safe-area-inset-top, 10px)) 14px 12px",
          background: "linear-gradient(180deg, #9B2A1C 0%, #6E1A12 100%)",
        }}
      >
        <Link
          href="/driver"
          aria-label="Back to queue"
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={20} strokeWidth={2.4} />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.72)" }}>
            {isOut ? "ON THE WAY" : isReady ? "READY FOR PICKUP" : "ORDER"}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tripLabel || formatOrderRef(order.order_number, orderId)}
          </p>
        </div>

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
              padding: "10px 14px",
              borderRadius: 999,
              background: "#E8492D",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
            }}
          >
            <Navigation size={15} strokeWidth={2.4} />
            Navigate
          </a>
        )}
      </div>

      <div
        className="no-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          display: "flex",
          flexDirection: "column",
          padding: "14px 16px 18px",
          gap: 12,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{ background: "#1C1C1E", borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", overflowWrap: "anywhere" }}>
                  {toTitleCase(customerName)}
                </h2>
                {hasRecipient && (
                  <span style={{ background: "rgba(255,255,255,0.08)", color: "#E5E5EA", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", borderRadius: 999, padding: "4px 8px" }}>
                    RECIPIENT
                  </span>
                )}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#AEAEB2", fontWeight: 600 }}>
                {formatOrderRef(order.order_number, orderId)}
                {hasRecipient ? ` · Ordered by ${toTitleCase(orderedByName)}` : ""}
              </p>
              {slotLine && (
                <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 800, color: "#fff" }}>
                  {slotLine}
                </p>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it, i) => {
                const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
                const name = toTitleCase(it.menu_items?.name || "Item");
                const img = resolveOrderItemImageUrl({
                  name: it.menu_items?.name || "Item",
                  imageUrl: it.menu_items?.image_url,
                  menuItemId: it.menu_item_id,
                });
                return (
                  <div key={`${name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, background: "#121212", borderRadius: 14, padding: 8 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "#2A2A2C" }}>
                      {img ? (
                        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Package size={18} strokeWidth={1.7} style={{ color: "#8E8E93" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "#AEAEB2" }}>{qty}×</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <MapPin size={16} strokeWidth={2.2} style={{ color: "#8E8E93", marginTop: 2, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.45, fontWeight: 600, color: "#E5E5EA" }}>
              {order.delivery_address || "No address provided"}
            </p>
          </div>
        </motion.div>

        {cashOutstanding && amount != null && (
          <div style={{ background: "rgba(245,166,35,0.12)", borderRadius: 16, padding: "14px 16px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#F5A623", letterSpacing: "0.08em" }}>COLLECT — CASH OR UPI</p>
            <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
              ₹{amount.toLocaleString("en-IN")}
            </p>
          </div>
        )}

        {isCod && !cashOutstanding && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 14, background: "#1C1C1E" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: D.green, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#8E8E93" }}>Payment already collected</span>
          </div>
        )}

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
            {hasFix && !geoErr ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 14, background: "#1C1C1E" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: D.green, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#8E8E93", lineHeight: 1.35 }}>
                  Sharing location{hasArrived ? ` · ${toTitleCase(customerName)} notified` : ""}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={enableLocation}
                disabled={geoAsking}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "none",
                  background: "rgba(245,166,35,0.12)",
                  color: "#F5A623",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: D.font,
                  textAlign: "left",
                  cursor: geoAsking ? "wait" : "pointer",
                }}
              >
                <span style={{ lineHeight: 1.4 }}>
                  {geoErr || "Location is off. The kitchen can’t see you moving."}
                </span>
                <span style={{ flexShrink: 0, fontWeight: 800 }}>
                  {geoAsking ? "…" : geoBlocked ? "Retry" : "Turn on"}
                </span>
              </button>
            )}

            {!hasArrived && (
              <button
                type="button"
                disabled={arriving}
                onClick={() => void handleArrived()}
                style={{
                  width: "100%",
                  minHeight: 50,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: D.font,
                  cursor: arriving ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {arriving ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <BellRing size={18} strokeWidth={2.1} />}
                {arriving ? "Telling them…" : "I've reached the customer"}
              </button>
            )}

            {cashOutstanding && amount != null && (
              <div
                style={{
                  padding: "14px",
                  borderRadius: 16,
                  background: "#1C1C1E",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>
                  Collect ₹{amount.toLocaleString("en-IN")} — cash, or let them scan UPI if they have no change.
                </p>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCollectVia("cash")}
                    style={{
                      flex: 1,
                      padding: "13px 10px",
                      borderRadius: 12,
                      border: `1px solid ${collectVia === "cash" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)"}`,
                      background: "transparent",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      fontFamily: D.font,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                    }}
                  >
                    {collectVia === "cash" ? <Check size={15} strokeWidth={2.8} /> : <Banknote size={16} strokeWidth={2} />}
                    Got cash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUpiCopied(false);
                      setUpiOpen(true);
                    }}
                    style={{
                      flex: 1,
                      padding: "13px 10px",
                      borderRadius: 12,
                      border: `1px solid ${collectVia === "upi" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)"}`,
                      background: "transparent",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      fontFamily: D.font,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                    }}
                  >
                    {collectVia === "upi" ? <Check size={15} strokeWidth={2.8} /> : <QrCode size={16} strokeWidth={2} />}
                    {collectVia === "upi" ? "UPI paid" : "Pay by UPI"}
                  </button>
                </div>

                {collectVia && (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#8E8E93", textAlign: "center" }}>
                    ₹{amount.toLocaleString("en-IN")} marked as {collectVia === "cash" ? "cash" : "UPI"}. Swipe below to finish.
                  </p>
                )}
              </div>
            )}

            {deliverBlock && (
              <p style={{ fontSize: 13, color: "#8E8E93", margin: 0, textAlign: "center", fontWeight: 600, lineHeight: 1.45 }}>
                {deliverBlock}
              </p>
            )}

            {!withinRange && !canMarkDelivered && (
              <button
                type="button"
                onClick={() => setGpsOverride(true)}
                style={{
                  width: "100%",
                  minHeight: 48,
                  borderRadius: 14,
                  border: "1.5px solid #E8492D",
                  background: "transparent",
                  color: "#E8492D",
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: D.font,
                  cursor: "pointer",
                }}
              >
                GPS is wrong — I&apos;m at the door
              </button>
            )}

            <button
              type="button"
              onClick={() => setFailOpen(true)}
              style={{
                background: "none",
                border: "none",
                color: "#E8492D",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: D.font,
                padding: "4px 0 2px",
                cursor: "pointer",
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

      {isOut && (
        <div
          style={{
            flexShrink: 0,
            padding: "10px 16px max(14px, env(safe-area-inset-bottom, 12px))",
            background: "#121212",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <SwipeAction
            label={deliverBlock ? "Swipe blocked — see above" : "Swipe to mark delivered"}
            doneLabel="Delivered"
            disabled={!canMarkDelivered}
            onSwipe={handleComplete}
          />
        </div>
      )}

      <UpiSheet
          open={upiOpen && amount != null}
          amount={amount ?? 0}
          vpa={order.collectUpi?.vpa || null}
          link={order.collectUpi?.link || null}
          copied={upiCopied}
          onCopy={async (value) => {
            try {
              await navigator.clipboard.writeText(value);
              setUpiCopied(true);
            } catch {
              // Clipboard is blocked in some in-app browsers; the ID is on
              // screen to read out loud either way.
              setUpiCopied(false);
            }
          }}
          onConfirm={() => {
            setCollectVia("upi");
            setUpiOpen(false);
          }}
          onClose={() => setUpiOpen(false)}
        />

      <FailSheet
          open={failOpen}
          busy={failing}
          isCod={isCod}
          onClose={() => setFailOpen(false)}
          onPick={(reason) => void handleFailed(reason)}
        />

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

function SpringDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="driver-drawer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "flex-end",
            fontFamily: D.font,
          }}
        >
          <motion.div
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.82 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxHeight: "92dvh",
              overflowY: "auto",
              background: "#1C1C1E",
              borderRadius: "22px 22px 0 0",
              padding: "14px 18px max(22px, env(safe-area-inset-bottom, 16px))",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.22)", margin: "0 auto 14px" }} />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
        borderRadius: 14,
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.18)",
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

/** Door-step UPI: a QR the customer scans, plus the ID they can type instead. */
function UpiSheet({
  open,
  amount,
  vpa,
  link,
  copied,
  onCopy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  amount: number;
  vpa: string | null;
  link: string | null;
  copied: boolean;
  onCopy: (value: string) => void | Promise<void>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <SpringDrawer open={open} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 13 }}>
        <div style={{ textAlign: "center" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Ask them to scan</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: D.muted, fontWeight: 600 }}>
            Paying Vidya&apos;s Kitchen · ₹{amount.toLocaleString("en-IN")}
          </p>
        </div>

        {link ? (
          <>
            <div style={{ background: "#fff", padding: 14, borderRadius: 18, border: `1px solid ${D.border}` }}>
              <QRCode value={link} size={212} fgColor="#1A1A1A" bgColor="#FFFFFF" level="M" />
            </div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: D.muted, textAlign: "center", lineHeight: 1.45 }}>
              The amount is already filled in — GPay, PhonePe, Paytm and any bank app will read this.
            </p>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              padding: "13px 14px",
              borderRadius: 12,
              background: D.amberFaint,
            }}
          >
            <QrCode size={18} strokeWidth={2} style={{ color: D.amber, flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: D.amber, lineHeight: 1.45 }}>
              No UPI ID is set up yet. Show your printed QR and ask them to pay ₹{amount.toLocaleString("en-IN")} to
              Vidya&apos;s Kitchen.
            </p>
          </div>
        )}

        {vpa && (
          <button
            type="button"
            onClick={() => void onCopy(vpa)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${D.border}`,
              background: D.bg,
              cursor: "pointer",
              fontFamily: D.font,
            }}
          >
            <span style={{ textAlign: "left", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", color: D.faint }}>
                UPI ID
              </span>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: D.text, overflowWrap: "anywhere" }}>
                {vpa}
              </span>
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: copied ? D.green : D.red, flexShrink: 0 }}>
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: "100%",
            minHeight: 52,
            borderRadius: RADIUS.control,
            border: "none",
            background: D.green,
            color: "#fff",
            fontSize: 15.5,
            fontWeight: 800,
            fontFamily: D.font,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Check size={18} strokeWidth={2.8} />
          Payment received
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: D.muted,
            fontSize: 13.5,
            fontWeight: 700,
            fontFamily: D.font,
            padding: "2px 0 4px",
            cursor: "pointer",
          }}
        >
          Not yet
        </button>
      </div>
    </SpringDrawer>
  );
}

function FailSheet({
  open,
  busy,
  isCod,
  onClose,
  onPick,
}: {
  open: boolean;
  busy: boolean;
  isCod: boolean;
  onClose: () => void;
  onPick: (reason: string) => void;
}) {
  return (
    <SpringDrawer open={open} onClose={busy ? () => {} : onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              background: "rgba(255,255,255,0.08)",
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
    </SpringDrawer>
  );
}
