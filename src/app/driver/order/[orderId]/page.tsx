"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { haversineMeters } from "@/lib/geo";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";

const YELLOW = "#F5C518";

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

function primaryLine(items: ItemRow[] | null | undefined): { title: string; subtitle: string; image: string | null } {
  const list = Array.isArray(items) ? items : [];
  const first = list[0];
  const nm = first?.menu_items?.name ? String(first.menu_items.name) : "Order items";
  const q = Math.max(1, Math.floor(Number(first?.quantity) || 1));
  const img = first?.menu_items?.image_url ? String(first.menu_items.image_url) : null;
  if (list.length <= 1) {
    return { title: nm, subtitle: `${q} serving${q > 1 ? "s" : ""}`, image: img };
  }
  const totalQty = list.reduce((s, r) => s + Math.max(1, Math.floor(Number(r.quantity) || 1)), 0);
  return {
    title: nm,
    subtitle: `+${list.length - 1} more dish${list.length > 2 ? "es" : ""} · ${totalQty} items total`,
    image: img,
  };
}

export default function DriverOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params.orderId || "");

  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [pickingUp, setPickingUp] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeErr, setCompleteErr] = useState<string | null>(null);

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const postTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

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
  const isOut =
    nStatus === OrderStatus.OUT_FOR_DELIVERY || nStatus === "out" || nStatus === "out_for_delivery";

  const dropLat = order?.delivery_lat != null ? Number(order.delivery_lat) : null;
  const dropLng = order?.delivery_lng != null ? Number(order.delivery_lng) : null;
  const hasDropPin = dropLat != null && dropLng != null && Number.isFinite(dropLat) && Number.isFinite(dropLng);

  const distanceM = useMemo(() => {
    if (!hasDropPin || geoLat == null || geoLng == null) return null;
    return haversineMeters(geoLat, geoLng, dropLat!, dropLng!);
  }, [hasDropPin, geoLat, geoLng, dropLat, dropLng]);

  const canMarkDelivered =
    !hasDropPin || (distanceM != null && distanceM <= PROXIMITY_UNLOCK_M) || process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (!isOut || typeof window === "undefined") return;

    if (!navigator.geolocation) {
      setGeoErr("Location not supported on this device.");
      return;
    }

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
      setCompleteErr("Waiting for GPS — enable location and try again.");
      return;
    }
    setCompleting(true);
    setCompleteErr(null);
    try {
      const res = await fetch("/api/orders/driver/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, lat: geoLat, lng: geoLng }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not complete");
      setCompleteOpen(false);
      router.push("/driver");
    } catch (e) {
      setCompleteErr(e instanceof Error ? e.message : "Could not complete");
    } finally {
      setCompleting(false);
    }
  };

  const customerName = order?.users?.full_name?.trim() || "Customer";
  const callPhone = order?.users?.phone_number || order?.phone_number || "";
  const { title: dishTitle, subtitle: dishSub, image: dishImage } = primaryLine(order?.order_items);

  const mapsUrl = order?.delivery_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`
    : "";

  if (loadErr) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center p-6 gap-4" style={{ background: "#000" }}>
        <p className="text-red-400 font-medium">{loadErr}</p>
        <Link href="/driver" className="text-sm underline" style={{ color: "rgba(245,197,24,0.7)" }}>
          Back to queue
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center gap-3" style={{ background: "#000" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: YELLOW }} />
        <p className="text-white/40 text-sm">Loading order…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pb-28" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245,197,24,0.06), transparent 55%), #000" }}>
      <header
        className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <Link
          href="/driver"
          className="p-2 rounded-xl border text-white/80 hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Delivery</p>
          <p className="font-mono text-sm truncate text-white/90">#{order.id.slice(0, 8)}</p>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {/* Hero card */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <div className="aspect-[16/10] bg-zinc-800 relative">
            {dishImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dishImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="w-16 h-16 text-white/15" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h1 className="text-lg font-bold leading-snug text-white">{dishTitle}</h1>
              <p className="text-sm text-white/50 mt-1">{dishSub}</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/35">Customer</p>
              <p className="text-base font-semibold mt-0.5">{customerName}</p>
            </div>
            <div className="flex gap-2 items-start">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: YELLOW }} />
              <p className="text-sm text-white/70 leading-relaxed">{order.delivery_address || "—"}</p>
            </div>
            <p className="text-sm text-white/45">
              Slot:{" "}
              <span className="text-white/75 font-medium">
                {formatSlotLineForCustomer(order.delivery_slot ?? undefined, order.delivery_slot_kind ?? undefined) || "—"}
              </span>
            </p>
          </div>
        </div>

        {isReady && (
          <motion.button
            type="button"
            whileTap={{ scale: pickingUp ? 1 : 0.98 }}
            disabled={pickingUp}
            onClick={() => void handlePickup()}
            className="w-full py-4 rounded-2xl text-black font-bold text-base shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: YELLOW, boxShadow: "0 8px 24px rgba(245,197,24,0.25)" }}
          >
            {pickingUp ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            I&apos;ve picked up the order
          </motion.button>
        )}

        {isOut && (
          <>
            {geoErr && (
              <p className="text-sm px-1" style={{ color: "rgba(245,197,24,0.9)" }}>{geoErr}</p>
            )}
            {!hasDropPin && (
              <p className="text-sm px-1 rounded-xl p-3 border" style={{ color: "rgba(245,197,24,0.8)", background: "rgba(245,197,24,0.06)", borderColor: "rgba(245,197,24,0.15)" }}>
                No saved drop-off pin for this order — you can still complete delivery; the kitchen used a legacy address.
              </p>
            )}
            {hasDropPin && distanceM != null && (
              <p className="text-sm text-white/45 px-1">
                ~{Math.round(distanceM)}m from customer pin
                {canMarkDelivered ? (
                  <span className="text-emerald-400 font-semibold"> · In range</span>
                ) : (
                  <span className="text-white/35"> · Within {PROXIMITY_UNLOCK_M}m to unlock delivery</span>
                )}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border rounded-xl py-3.5 text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                >
                  <Navigation className="w-4 h-4" />
                  Google Maps
                </a>
              ) : (
                <div />
              )}
              {callPhone ? (
                <a
                  href={`tel:${callPhone.replace(/\s/g, "")}`}
                  className="flex items-center justify-center gap-2 border rounded-xl py-3.5 text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
                >
                  <Phone className="w-4 h-4" />
                  Call
                </a>
              ) : (
                <div />
              )}
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: canMarkDelivered ? 0.98 : 1 }}
              disabled={!canMarkDelivered}
              onClick={() => {
                setCompleteErr(null);
                setCompleteOpen(true);
              }}
              className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 border ${
                canMarkDelivered
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20"
                  : "border-white/10 text-white/35 cursor-not-allowed"
              }`}
              style={canMarkDelivered ? {} : { background: "rgba(255,255,255,0.05)" }}
            >
              <CheckCircle2 className="w-5 h-5" />
              Food delivered
            </motion.button>
          </>
        )}

        {!isReady && !isOut && (
          <p className="text-center text-white/45 text-sm py-8">
            This order is no longer in the driver queue.{" "}
            <Link href="/driver" className="underline" style={{ color: "rgba(245,197,24,0.7)" }}>
              Back to list
            </Link>
          </p>
        )}
      </main>

      <AnimatePresence>
        {completeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-4"
            onClick={() => !completing && setCompleteOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
              style={{ background: "#111", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <p className="text-lg font-bold text-white">Confirm delivery?</p>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">
                Only tap yes after you&apos;ve handed the food to the customer.
              </p>
              {completeErr && <p className="text-red-400 text-sm mt-3">{completeErr}</p>}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  disabled={completing}
                  onClick={() => setCompleteOpen(false)}
                  className="flex-1 py-3 rounded-xl border font-semibold text-sm"
                  style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", background: "transparent" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={completing}
                  onClick={() => void handleComplete()}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Yes, delivered
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
