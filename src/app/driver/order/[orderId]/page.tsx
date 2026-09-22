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
  BellRing,
  QrCode,
} from "lucide-react";
import QRCode from "react-qr-code";
import { haversineMeters } from "@/lib/geo";
import { normalizeOrderStatus, OrderStatus, PaymentStatus, COD_FAILURE_REASONS, formatOrderRef } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { D, RADIUS } from "../../driver-theme";
import { DriverAuthShell, useSignedInDriver } from "../../driver-auth-gate";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

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
  driver_arrived_at?: string | null;
  total_amount?: number | null;
  users?: UserRef;
  order_items?: ItemRow[] | null;
  collectUpi?: { vpa: string; link: string | null; amount: number } | null;
};

/** Matches the server check in /api/orders/driver/complete. */
const PROXIMITY_UNLOCK_M = 120;
const LOCATION_POST_MS = 12_000;
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
  // A dimmed bar that won't move is the most frustrating thing on this screen,
  // so always be able to say out loud why it isn't moving.
  const deliverBlock: string | null =
    cashOutstanding && collectVia == null
      ? "Mark the money collected first — cash or UPI"
      : !withinRange
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
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
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
          ...(gpsOverride ? { proximityOverride: true } : {}),
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
        // The sheet is taller than the viewport on most phones once the swipe
        // action and warnings are in play, so the page owns the scroll.
        height: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        background: D.bg,
        fontFamily: D.font,
        color: D.text,
      }}
    >
      {/* Header — turn-by-turn lives in Google Maps, so this screen stays a
          one-thumb job card rather than a second map to babysit. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "max(14px, env(safe-area-inset-top, 12px)) 16px 12px",
          background: D.bg,
          borderBottom: `1px solid ${D.border}`,
        }}
      >
        <Link
          href="/driver"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 12,
            background: D.surface,
            border: `1px solid ${D.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: D.text,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={19} strokeWidth={2.2} />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: D.faint }}>
            {isOut ? "ON THE WAY" : isReady ? "READY FOR PICKUP" : "ORDER"}
          </p>
          <p
            style={{
              margin: "1px 0 0",
              fontSize: 14.5,
              fontWeight: 800,
              letterSpacing: "-0.01em",
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
              padding: "10px 13px",
              borderRadius: 12,
              background: D.red,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            <Navigation size={15} strokeWidth={2.3} />
            Navigate
          </a>
        )}
      </div>

      {/* Sheet */}
      <div
        style={{
          background: D.bg,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          padding: "12px 18px 0",
          paddingBottom: "max(22px, env(safe-area-inset-bottom, 16px))",
          gap: 12,
        }}
      >

        {/* Customer */}
        <div style={{ background: D.surface, borderRadius: RADIUS.card, border: `1px solid ${D.border}`, padding: 15, display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>
                {toTitleCase(customerName)}
              </h2>
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
            {slotLine && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  padding: "5px 10px",
                  borderRadius: 9,
                  background: "rgba(0,0,0,0.05)",
                  color: D.text,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
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
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: D.red, letterSpacing: "0.08em" }}>COLLECT — CASH OR UPI</p>
                <p style={{ margin: "1px 0 0", fontSize: 20, fontWeight: 800, color: D.red, letterSpacing: "-0.02em" }}>
                  ₹{amount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          )}

          {isCod && !cashOutstanding && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: D.greenFaint }}>
              <Check size={16} strokeWidth={2.6} style={{ color: D.green }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: D.green }}>Payment already collected</span>
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

        {mapsUrl && (
          <p style={{ margin: "-4px 0 0", fontSize: 11.5, color: D.faint, fontWeight: 600, textAlign: "center" }}>
            {hasDropPin
              ? "Navigate opens Google Maps at the exact pin the customer dropped."
              : "No pin on this order, so Navigate searches Google Maps for the address — check it before you ride."}
          </p>
        )}

        <div style={{ height: 4 }} />

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
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: RADIUS.control, background: D.greenFaint }}>
                <Navigation size={15} strokeWidth={2.3} style={{ color: D.green, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: D.green }}>
                  Sharing your live location — the kitchen and customer can see you moving.
                </span>
              </div>
            ) : (
              <div
                style={{
                  padding: "12px 13px",
                  borderRadius: RADIUS.control,
                  background: D.amberFaint,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <p style={{ fontSize: 12.5, color: D.amber, margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                  {geoErr || "Turn on location so the kitchen and the customer can watch you approach."}
                </p>
                <button
                  type="button"
                  onClick={enableLocation}
                  disabled={geoAsking}
                  style={{
                    width: "100%",
                    height: 44,
                    borderRadius: 11,
                    border: "none",
                    background: D.amber,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    fontFamily: D.font,
                    cursor: geoAsking ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {geoAsking ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <MapPin size={16} strokeWidth={2.3} />}
                  {geoAsking ? "Checking…" : geoBlocked ? "Try location again" : "Turn on location"}
                </button>
              </div>
            )}

            {hasArrived ? (
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 13px", borderRadius: RADIUS.control, background: D.greenFaint }}>
                <BellRing size={17} strokeWidth={2.2} style={{ color: D.green, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: D.green, lineHeight: 1.4 }}>
                  {toTitleCase(customerName)} and the kitchen have been told you&apos;re here.
                </span>
              </div>
            ) : (
              <button
                type="button"
                disabled={arriving}
                onClick={() => void handleArrived()}
                style={{
                  width: "100%",
                  minHeight: 56,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${D.borderStrong}`,
                  background: D.surface,
                  color: D.text,
                  fontSize: 15.5,
                  fontWeight: 800,
                  fontFamily: D.font,
                  cursor: arriving ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  padding: "10px 14px",
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
                  borderRadius: RADIUS.control,
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 11,
                }}
              >
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: D.text, lineHeight: 1.4 }}>
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
                      border: `1.5px solid ${collectVia === "cash" ? "rgba(18,131,63,0.45)" : D.border}`,
                      background: collectVia === "cash" ? D.greenFaint : D.bg,
                      color: collectVia === "cash" ? D.green : D.text,
                      fontSize: 13.5,
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
                      border: `1.5px solid ${collectVia === "upi" ? "rgba(18,131,63,0.45)" : D.border}`,
                      background: collectVia === "upi" ? D.greenFaint : D.bg,
                      color: collectVia === "upi" ? D.green : D.text,
                      fontSize: 13.5,
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
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: D.green, textAlign: "center" }}>
                    ₹{amount.toLocaleString("en-IN")} marked as collected by {collectVia === "cash" ? "cash" : "UPI"}. Swipe below to finish.
                  </p>
                )}
              </div>
            )}

            {deliverBlock && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: 12.5, color: D.muted, margin: 0, textAlign: "center", fontWeight: 700, lineHeight: 1.45 }}>
                  {deliverBlock}
                </p>
                {!withinRange && (
                  <button
                    type="button"
                    onClick={() => setGpsOverride(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: D.red,
                      fontSize: 12.5,
                      fontWeight: 800,
                      fontFamily: D.font,
                      padding: "2px 0",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    GPS is wrong — I&apos;m at the door
                  </button>
                )}
              </div>
            )}

            <SwipeAction
              label={deliverBlock ? "Swipe blocked — see above" : "Swipe to mark delivered"}
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

      {upiOpen && amount != null && (
        <UpiSheet
          amount={amount}
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
      )}

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

/** Door-step UPI: a QR the customer scans, plus the ID they can type instead. */
function UpiSheet({
  amount,
  vpa,
  link,
  copied,
  onCopy,
  onConfirm,
  onClose,
}: {
  amount: number;
  vpa: string | null;
  link: string | null;
  copied: boolean;
  onCopy: (value: string) => void | Promise<void>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.45)",
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
          maxHeight: "92dvh",
          overflowY: "auto",
          background: D.surface,
          borderRadius: "22px 22px 0 0",
          padding: "18px 18px max(22px, env(safe-area-inset-bottom, 16px))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 13,
        }}
      >
        <div style={{ width: 34, height: 4, borderRadius: 4, background: "rgba(0,0,0,0.14)" }} />

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
    </div>
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
