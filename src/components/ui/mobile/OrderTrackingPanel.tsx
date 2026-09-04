"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DELIVERY_SLOT_TIMEZONE } from "@/lib/delivery-slots";
import { whatsappBotLink } from "@/lib/whatsapp-copy";
import { codFailureLabel, formatOrderRef } from "@/lib/order-status";
import { Motorcycle, Money, MapPin, PencilSimple, CookingPot, CheckCircle, Package } from "@phosphor-icons/react";
import { CenterSpinner, EmptyState, EMPTY_ICON_COLOR } from "@/components/ui/mobile/EmptyState";
import { C, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";
import { TYPO as TypeScale } from "@/components/ui/mobile/mobile-typography";
import { computeOrderBreakdownFromItemSubtotal } from "@/lib/order-pricing";
import { GraffitiSpotlight } from "@/components/ui/mobile/GraffitiChip";

/** Status + address cards — match home location pin tile. */
const ORDER_CARD_ICON_BOX = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: "rgba(189,35,32,0.12)",
  border: "1px solid rgba(189,35,32,0.25)",
} as const;

const fontUi = C.mono;

const TYPO = {
  eyebrow: { ...TypeScale.bodyMedium, margin: 0, fontWeight: 800, letterSpacing: "0.04em", color: "rgba(0,0,0,0.38)", fontFamily: fontUi },
  heroId: { ...TypeScale.hero, margin: "8px 0 0", fontFamily: fontUi },
  cardTitle: { ...TypeScale.cardTitle, margin: 0, fontWeight: 800, fontFamily: fontUi },
  body: { ...TypeScale.bodyMedium, fontFamily: fontUi, color: "rgba(0,0,0,0.42)" },
} as const;

/** Title-case dish lines from API (e.g. "EGG CURRY" → "Egg Curry"). */
function toTitleCaseLine(str: string) {
  return str.toLowerCase().replace(/(?:^|\s|\(|\/)\w/g, (m) => m.toUpperCase());
}

export type OrderTrackSnap = {
  status: string;
  orderNumber?: number | null;
  deliveryAddress?: string | null;
  deliverySlot?: string | null;
  deliverySlotKind?: string | null;
  ratingStars?: number | null;
  ratingComment?: string | null;
  totalAmount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  codFailureReason?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  driverLastLat?: number | null;
  driverLastLng?: number | null;
  driverLocationAt?: string | null;
  cancellationDeadline?: string | null;
  paymentLinkId?: string | null;
  lines?: { name: string; quantity: number; unitPrice: number }[];
  breakdown?: {
    itemsSubtotal: number;
    packaging: number;
    delivery: number;
    gst: number;
    computedTotal: number;
    adjustment: number;
  } | null;
};

type Loc = { label: string; lat: number; lng: number } | null;

function normalizeTrackStatus(s: string): string {
  const x = (s || "").toLowerCase();
  if (x === "prepping") return "preparing";
  if (x === "out") return "out_for_delivery";
  return x;
}

function canCustomerCancelStatus(status: string): boolean {
  const s = normalizeTrackStatus(status);
  // pending_payment is included: no money has been taken and the kitchen
  // hasn't seen the order, so there is nothing to protect with a deadline.
  return ["pending_payment", "paid", "confirmed"].includes(s);
}

/** "2 days 4 hrs 12 min 8 sec", tightening as the window runs down. */
function formatRemaining(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (days > 0) return `${unit(days, "day")} ${unit(hours, "hr")} ${unit(mins, "min")} ${unit(secs, "sec")}`;
  if (hours > 0) return `${unit(hours, "hr")} ${unit(mins, "min")} ${unit(secs, "sec")}`;
  if (mins > 0) return `${unit(mins, "min")} ${unit(secs, "sec")}`;
  return unit(secs, "sec");
}

/**
 * How long the customer still has to call the order off.
 *
 * The deadline is 12 hours before the delivery slot, which is invisible unless
 * we say so — without it "Cancel order" looks permanent right up until the
 * moment it silently disappears.
 */
function CancelCountdown({ deadline }: { deadline: string | null | undefined }) {
  const target = deadline ? new Date(deadline).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (!Number.isFinite(target)) return null;
  const left = target - now;
  if (left <= 0) return null;

  const urgent = left < 60 * 60 * 1000;

  return (
    <p
      style={{
        margin: "10px 2px 0",
        fontSize: 12.5,
        fontWeight: 700,
        lineHeight: 1.5,
        textAlign: "center",
        color: urgent ? C.red : C_TEXT_MUTED,
        fontFamily: fontUi,
      }}
    >
      {`You have ${formatRemaining(left)} left to cancel`}
    </p>
  );
}

function tryNotifyOrderCancelled(orderRef: string) {
  const title = "Order cancelled";
  const body = `Order #${orderRef} — we’ve notified the kitchen. Check WhatsApp for the same update.`;
  try {
    if (typeof Notification === "undefined") return;
    const show = () => new Notification(title, { body, tag: "vk-order-cancel" });
    if (Notification.permission === "granted") show();
    else if (Notification.permission === "default") void Notification.requestPermission().then((p) => p === "granted" && show());
  } catch {
    /* ignore */
  }
}

/** Four stages the customer actually cares about. */
const TRACK_STAGES = ["Order", "Preparing", "On the way", "Delivered"] as const;

/** Index into TRACK_STAGES; -1 when the order is cancelled or not yet placed. */
function trackStage(status: string): number {
  switch (normalizeTrackStatus(status)) {
    case "paid":
    case "confirmed":
      return 0;
    case "preparing":
    case "ready":
      return 1;
    case "out_for_delivery":
      return 2;
    case "delivered":
      return 3;
    default:
      return -1;
  }
}

/**
 * A driver fix older than this is treated as no fix at all — a pin frozen ten
 * minutes ago next to the words "updating live" is worse than no pin.
 */
const DRIVER_FIX_MAX_AGE_MS = 3 * 60 * 1000;

function isFreshDriverFix(at: string | null | undefined): boolean {
  if (!at) return false;
  const t = new Date(at).getTime();
  return Number.isFinite(t) && Date.now() - t < DRIVER_FIX_MAX_AGE_MS;
}

function mapStaticUrl(
  userLat: number,
  userLng: number,
  token: string,
  driverLat?: number | null,
  driverLng?: number | null,
): string {
  const pins: string[] = [`pin-s+BD2320(${userLng},${userLat})`];
  // Only pin the driver when we genuinely have their GPS — a synthetic pin here
  // told customers their food was a kilometre away when we had no idea.
  if (
    driverLat != null &&
    driverLng != null &&
    Number.isFinite(driverLat) &&
    Number.isFinite(driverLng)
  ) {
    pins.push(`pin-s+1A1A1A(${driverLng},${driverLat})`);
  }
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pins.join(",")}/auto/640x420@2x?padding=70&access_token=${encodeURIComponent(token)}`;
}

/** Headline + supporting line for the hero card. */
function heroCopy(status: string): { headline: string; sub: string } {
  switch (normalizeTrackStatus(status)) {
    case "pending_payment":
      return { headline: "Awaiting payment", sub: "Finish checkout to send this to the kitchen" };
    case "paid":
      return { headline: "Order placed", sub: "The kitchen will accept it shortly" };
    case "confirmed":
      return { headline: "Order confirmed", sub: "We'll start cooking closer to your slot" };
    case "preparing":
      return { headline: "Preparing your food", sub: "Cooked fresh, right now" };
    case "ready":
      return { headline: "Packed and ready", sub: "Waiting for your driver to collect it" };
    case "out_for_delivery":
      return { headline: "On the way", sub: "Your driver is heading to you" };
    case "delivered":
      return { headline: "Delivered", sub: "Enjoy your meal" };
    case "undelivered":
      return { headline: "Delivery unsuccessful", sub: "Our team will reach out to you" };
    case "cancelled":
      return { headline: "Order cancelled", sub: "Nothing more to do here" };
    default:
      return { headline: "Order update", sub: "Fetching the latest status" };
  }
}

/** "Sat, 16 Aug" + "1:30 PM" from the delivery slot, in IST. */
function etaParts(slotIso: string | null | undefined): { date: string; time: string } | null {
  if (!slotIso) return null;
  const d = new Date(slotIso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString("en-IN", {
      timeZone: DELIVERY_SLOT_TIMEZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    time: d.toLocaleTimeString("en-IN", {
      timeZone: DELIVERY_SLOT_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

const PANEL_DARK = "#151515";

/**
 * Status mascot in the dark card. The icon matches the stage and keeps moving
 * a little so the screen doesn't look frozen while they wait.
 */
function StatusMascot({ stage }: { stage: number }) {
  const wrap = {
    width: 46,
    height: 46,
    borderRadius: 14,
    flexShrink: 0 as const,
    background: "rgba(189,35,32,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" as const,
  };

  if (stage <= 0) {
    return (
      <span style={wrap} aria-hidden>
        <motion.span
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ display: "flex" }}
        >
          <Package size={24} weight="fill" color={C.red} />
        </motion.span>
      </span>
    );
  }
  if (stage === 1) {
    return (
      <span style={{ ...wrap, overflow: "visible", position: "relative" }} aria-hidden>
        <motion.span
          animate={{ rotate: [-8, 8, -8], y: [0, -2, 0] }}
          transition={{ duration: 0.65, repeat: Infinity, ease: "easeInOut" }}
          style={{ display: "flex" }}
        >
          <CookingPot size={24} weight="fill" color={C.red} />
        </motion.span>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [6, -16], opacity: [0, 0.85, 0], scale: [0.35, 1.05] }}
            transition={{ duration: 1.05, repeat: Infinity, delay: i * 0.22, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: 14 + i * 6,
              top: 4,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.8)",
              pointerEvents: "none",
            }}
          />
        ))}
      </span>
    );
  }
  if (stage === 2) {
    return (
      <span style={wrap} aria-hidden>
        <motion.span
          animate={{ x: [-7, 7, -7], y: [1, -2, 1], rotate: [-8, 6, -8] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
          style={{ display: "flex" }}
        >
          <Motorcycle size={24} weight="fill" color={C.red} />
        </motion.span>
      </span>
    );
  }
  return (
    <span style={wrap} aria-hidden>
      <motion.span
        animate={{ scale: [0.92, 1.08, 0.92] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "flex" }}
      >
        <CheckCircle size={24} weight="fill" color={C.red} />
      </motion.span>
    </span>
  );
}

const STAGE_BURST_LABEL = ["", "Preparing", "On the way", "Delivered"] as const;

/** Graffiti chip on the time card — once, when the kitchen moves the stage on. */
function StageChangeBurst({ orderId, stage }: { orderId: string; stage: number }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const key = `vk_stage_burst_${orderId}`;
    let seen = -1;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) seen = Number(raw);
    } catch {
      /* private mode */
    }
    const nextLabel = stage >= 1 && stage <= 3 ? STAGE_BURST_LABEL[stage] : null;
    if (nextLabel && stage > seen && seen >= 0) {
      setLabel(nextLabel);
      const t = window.setTimeout(() => setLabel(null), 2200);
      try {
        sessionStorage.setItem(key, String(stage));
      } catch {
        /* ignore */
      }
      return () => window.clearTimeout(t);
    }
    try {
      sessionStorage.setItem(key, String(Math.max(seen, stage, 0)));
    } catch {
      /* ignore */
    }
    return undefined;
  }, [orderId, stage]);

  return (
    <GraffitiSpotlight show={!!label} chipKey={`stage-${orderId}-${label ?? ""}`} tone="info">
      {label}
    </GraffitiSpotlight>
  );
}

/** Slow heat wash behind the arrival time. The numbers themselves stay still. */
function WarmWash() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(165deg, #FFF6F3 0%, #FFFFFF 46%, #FFECE8 100%)",
        }}
      />
      {reduce ? null : (
        <motion.div
          aria-hidden
          animate={{ x: ["-10%", "16%", "-10%"], y: ["-8%", "12%", "-8%"], scale: [1, 1.14, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            width: "78%",
            height: "90%",
            top: "-24%",
            left: "8%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(189,35,32,0.18) 0%, rgba(189,35,32,0.05) 44%, transparent 72%)",
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}

/** Same burst chip as the location-screen tips — plays once when an order lands. */
function PlacedBurstChip({ orderId }: { orderId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `vk_placed_burst_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — still show once this mount */
    }
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 2200);
    return () => window.clearTimeout(t);
  }, [orderId]);

  return (
    <GraffitiSpotlight show={show} chipKey={`placed-${orderId}`} tone="success">
      Order placed
    </GraffitiSpotlight>
  );
}

/** Horizontal 4-dot progress rail on the dark status panel. */
function StageRail({ stage }: { stage: number }) {
  const filled = Math.max(0, stage);
  const pct = TRACK_STAGES.length > 1 ? (filled / (TRACK_STAGES.length - 1)) * 100 : 0;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ position: "relative", height: 22, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 9, right: 9, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.14)", zIndex: 0 }} />
        <motion.div
          initial={false}
          animate={{ width: `calc(${pct}% - ${(pct / 100) * 18}px)` }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
          style={{ position: "absolute", left: 9, height: 6, borderRadius: 3, background: C.red, zIndex: 1 }}
        />
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", width: "100%" }}>
          {TRACK_STAGES.map((label, i) => {
            const done = i <= stage && stage >= 0;
            const current = i === stage;
            return (
              <span
                key={label}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  // Opaque fill — the rail sits behind and must not show through.
                  background: done ? C.red : "#3d3d3d",
                  border: `2px solid ${done ? C.red : "#3d3d3d"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                }}
              >
                {done && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#fff",
                      opacity: current ? 1 : 0.75,
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        {TRACK_STAGES.map((label, i) => (
          <span
            key={label}
            style={{
              flex: 1,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: fontUi,
              textAlign: i === 0 ? "left" : i === TRACK_STAGES.length - 1 ? "right" : "center",
              color: i === stage ? C.red : "rgba(255,255,255,0.42)",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function waHelpUrl(orderId: string, orderNumber?: number | null) {
  return whatsappBotLink(`Hi — I need help with order ${formatOrderRef(orderNumber, orderId)}.`);
}

function WhatsAppBrandIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#25D366"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.43 1.32 4.93L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.12l-.3-.18-3.12.82.84-3.04-.2-.31a8.182 8.182 0 01-1.27-4.4c-.01-4.54 3.7-8.24 8.23-8.24m-3.52 2.66c-.16 0-.43.06-.66.23-.23.17-.87.85-.87 2.06 0 1.22.89 2.39 1 2.56.12.17 1.76 2.68 4.22 3.78 2.46 1.1 2.46.73 2.9.69.45-.04 1.45-.59 1.66-1.16.21-.57.21-1.07.15-1.18-.06-.1-.23-.16-.47-.28-.24-.13-1.45-.71-1.67-.79-.22-.08-.38-.12-.54.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.13-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.54-1.3-.74-1.78-.2-.48-.41-.42-.54-.43-.14-.01-.29-.01-.44-.01z"
      />
    </svg>
  );
}

export function OrderTrackingPanel({
  trackingOrderId,
  customerPhone,
  trackSnap,
  trackErr,
  trackBanner,
  location,
  onDismiss,
  onEditAddress,
  ratingCommentDraft,
  setRatingCommentDraft,
  ratingSending,
  addressSaveError = null,
  submitOrderRating,
}: {
  trackingOrderId: string | null;
  customerPhone: string;
  trackSnap: OrderTrackSnap | null;
  trackErr: string | null;
  trackBanner: string | null;
  location: Loc;
  onDismiss?: () => void;
  onEditAddress?: () => void;
  /** Surfaced when saving a new address for a placed order failed. */
  addressSaveError?: string | null;
  ratingCommentDraft: string;
  setRatingCommentDraft: (v: string) => void;
  ratingSending: boolean;
  submitOrderRating: (n: number) => void;
}) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [resumeFetching, setResumeFetching] = useState(false);
  const [resumeErr, setResumeErr] = useState<string | null>(null);

  const mapToken = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "" : "";
  const stage = trackSnap ? trackStage(trackSnap.status) : -1;
  const n = trackSnap ? normalizeTrackStatus(trackSnap.status) : "";
  const cancelled = n === "cancelled";
  const outForDelivery = n === "out_for_delivery";
  const delivered = n === "delivered";
  const hero = heroCopy(trackSnap?.status ?? "");
  const eta = etaParts(trackSnap?.deliverySlot);
  const undelivered = n === "undelivered";
  // Prefer the address the order was actually placed against; the `location`
  // prop is just this device's current session pin, which drifts if the
  // customer changes their address after checkout (or is ordering for someone
  // else entirely).
  const pinLat = trackSnap?.deliveryLat ?? location?.lat ?? null;
  const pinLng = trackSnap?.deliveryLng ?? location?.lng ?? null;
  const driverFixFresh = isFreshDriverFix(trackSnap?.driverLocationAt);
  const driverLat = driverFixFresh ? trackSnap?.driverLastLat ?? null : null;
  const driverLng = driverFixFresh ? trackSnap?.driverLastLng ?? null : null;
  const showLiveMap = outForDelivery && pinLat != null && pinLng != null && !!mapToken;
  const codPending =
    (trackSnap?.paymentMethod || "").toLowerCase() === "cod" &&
    (trackSnap?.paymentStatus || "pending") !== "paid" &&
    !cancelled &&
    !undelivered;
  const canEditAddress =
    !!onEditAddress && !!trackSnap && (normalizeTrackStatus(trackSnap.status) === "paid" || normalizeTrackStatus(trackSnap.status) === "pending_payment");
  const canCancelOrder =
    !!trackingOrderId &&
    !!trackSnap &&
    customerPhone.trim().replace(/\D/g, "").length >= 10 &&
    canCustomerCancelStatus(trackSnap.status) &&
    (!trackSnap.cancellationDeadline || Date.now() < new Date(trackSnap.cancellationDeadline).getTime());

  const cancellationWindowClosed =
    !!trackSnap &&
    canCustomerCancelStatus(trackSnap.status) &&
    normalizeTrackStatus(trackSnap.status) !== "pending_payment" &&
    !!trackSnap.cancellationDeadline &&
    Date.now() >= new Date(trackSnap.cancellationDeadline).getTime();

  const isPendingPayment = n === "pending_payment";

  const handleResumePayment = async () => {
    if (!trackingOrderId || resumeFetching) return;
    setResumeErr(null);
    setResumeFetching(true);
    try {
      const phone = customerPhone.trim();
      const res = await fetch(
        `/api/payments/resume?orderId=${encodeURIComponent(trackingOrderId)}&phone=${encodeURIComponent(phone)}`,
      );
      const data = (await res.json().catch(() => ({}))) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        throw new Error(data.error || "Could not retrieve payment link");
      }
      window.location.href = data.paymentUrl;
    } catch (e) {
      setResumeErr(e instanceof Error ? e.message : "Could not open payment page");
      setResumeFetching(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!trackingOrderId) return;
    const phone = customerPhone.trim();
    setCancelErr(null);
    setCancelSubmitting(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: trackingOrderId, phone }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not cancel order");
      tryNotifyOrderCancelled(formatOrderRef(trackSnap?.orderNumber, trackingOrderId).replace(/^#/, ""));
      setCancelModalOpen(false);
      onDismiss?.();
    } catch (e) {
      setCancelErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCancelSubmitting(false);
    }
  };
  // What actually happened to the money on a cancelled order. A COD order never
  // took any, and a refund we failed to push through shouldn't be described as
  // "on its way".
  const refundCopy = (() => {
    const amt = trackSnap?.refundAmount != null ? `₹${Math.round(trackSnap.refundAmount).toLocaleString("en-IN")}` : null;
    switch (String(trackSnap?.refundStatus || "").toLowerCase()) {
      case "refunded":
        return `${amt ?? "Your refund"} has been sent back to your original payment method. Banks usually take 5–7 working days to show it.`;
      case "initiated":
        return `${amt ?? "Your refund"} is being processed back to your original payment method.`;
      case "refund_failed":
        return "We couldn't push your refund through automatically. Message us on WhatsApp and we'll sort it out today.";
      default:
        return (trackSnap?.paymentMethod || "").toLowerCase() === "cod"
          ? "You hadn't paid for this order yet, so there's nothing to refund."
          : "You'll see the same update on WhatsApp. Reply there if you need help with a refund.";
    }
  })();
  const addressDisplay =
    trackSnap?.deliveryAddress?.trim() ||
    location?.label?.trim() ||
    "We’ll confirm the delivery address from your checkout.";
  const lines = trackSnap?.lines?.length ? trackSnap.lines : [];
  const total =
    trackSnap?.totalAmount != null && Number.isFinite(Number(trackSnap.totalAmount))
      ? Math.round(Number(trackSnap.totalAmount))
      : lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const cancelConfirmBody = isPendingPayment
    ? "This checkout will be dropped. Nothing has been charged."
    : (trackSnap?.paymentMethod || "").toLowerCase() === "cod" ||
        (trackSnap?.paymentStatus || "").toLowerCase() !== "paid"
      ? "We'll notify the kitchen on WhatsApp. You haven't paid yet, so there's nothing to refund."
      : `We'll notify the kitchen, and ₹${total.toLocaleString("en-IN")} will be refunded to your original payment method. Banks usually take 5–7 working days.`;
  const itemsSubtotal = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const apiBreakdown = trackSnap?.breakdown;
  const computedFees =
    lines.length > 0 ? computeOrderBreakdownFromItemSubtotal(itemsSubtotal) : null;
  const fee = apiBreakdown
    ? {
        itemsSubtotal: apiBreakdown.itemsSubtotal,
        packaging: apiBreakdown.packaging,
        delivery: apiBreakdown.delivery,
        gst: apiBreakdown.gst,
        computedTotal: apiBreakdown.computedTotal,
        adjustment: apiBreakdown.adjustment || 0,
      }
    : computedFees
      ? {
          ...computedFees,
          adjustment:
            total != null && Number.isFinite(total)
              ? Math.round((total - computedFees.computedTotal) * 100) / 100
              : 0,
        }
      : null;

  return (
    <div
      style={{
        // A column that fills the tab, so the empty and loading states can sit
        // in the middle of the space rather than under the header.
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: trackingOrderId && trackSnap ? undefined : "72vh",
        background: C.bg,
        // Parent scroll already clears the nav (~180px). Extra padding here
        // was leaving a blank half-screen under the bill.
        padding: "14px 18px 8px",
        fontFamily: fontUi,
      }}
    >
      {trackBanner ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 14,
            padding: "14px 16px",
            borderRadius: 14,
            background: C.redFaint,
            border: `1px solid ${C.redBorder}`,
            color: C.text,
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.55,
          }}
        >
          {trackBanner}
        </motion.div>
      ) : null}

      {!trackingOrderId ? (
        <EmptyState
          fill
          icon={<CookingPot size={32} weight="thin" color={EMPTY_ICON_COLOR} />}
          text="No live order right now. Once you check out, your schedule and updates appear here."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {trackErr ? (
            <p style={{ margin: "0 0 18px", color: "#fca5a5", fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{trackErr}</p>
          ) : null}

          {trackSnap ? (
            <>
              {(n === "paid" || n === "confirmed") && trackingOrderId ? (
                <PlacedBurstChip orderId={trackingOrderId} />
              ) : null}
              {/* Hero — map backdrop + floating ETA card */}
              <div style={{ position: "relative", marginBottom: 14 }}>
                <div
                  style={{
                    borderRadius: 22,
                    overflow: "hidden",
                    border: `1px solid ${C.border}`,
                    height: showLiveMap ? 232 : 150,
                    background: showLiveMap
                      ? undefined
                      : "linear-gradient(140deg, rgba(189,35,32,0.10) 0%, rgba(189,35,32,0.03) 60%, rgba(0,0,0,0.02) 100%)",
                  }}
                >
                  {showLiveMap && pinLat != null && pinLng != null ? (
                    <img
                      src={mapStaticUrl(pinLat, pinLng, mapToken, driverLat, driverLng)}
                      alt={driverLat != null ? "Delivery map with driver position" : "Delivery map"}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </div>

                <div
                  style={{
                    position: "relative",
                    marginTop: showLiveMap ? -74 : -108,
                    marginLeft: 16,
                    marginRight: 16,
                    background: C.white,
                    borderRadius: 20,
                    border: `1px solid ${C.redBorder}`,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    padding: "18px 18px 16px",
                    textAlign: "center",
                    overflow: "visible",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      overflow: "hidden",
                      borderRadius: 20,
                      pointerEvents: "none",
                    }}
                  >
                    <WarmWash />
                  </div>
                  {trackingOrderId ? <StageChangeBurst orderId={trackingOrderId} stage={stage} /> : null}
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text, fontFamily: fontUi, letterSpacing: "-0.01em" }}>
                      {hero.headline}
                    </p>
                    {eta ? (
                      <>
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 10,
                            padding: "5px 12px",
                            borderRadius: 999,
                            background: "transparent",
                            border: `1.5px solid ${C.red}`,
                            color: C.red,
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: fontUi,
                            letterSpacing: "0.01em",
                          }}
                        >
                          {eta.date}
                        </span>
                        <p style={{ margin: "10px 0 0", fontSize: 34, fontWeight: 800, color: C.text, fontFamily: fontUi, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                          {eta.time}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: C_TEXT_MUTED, fontFamily: fontUi }}>
                          {delivered ? "Delivered" : "Estimated arrival"}
                        </p>
                      </>
                    ) : (
                      <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600, color: C_TEXT_MUTED, fontFamily: fontUi, lineHeight: 1.5 }}>
                        {hero.sub}
                      </p>
                    )}
                    <p style={{ margin: "12px 0 0", fontSize: 11.5, fontWeight: 700, color: "rgba(0,0,0,0.32)", fontFamily: fontUi, letterSpacing: "0.06em" }}>
                      ORDER {formatOrderRef(trackSnap?.orderNumber, trackingOrderId)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery status — dark panel */}
              {!cancelled && (
                <div
                  style={{
                    background: PANEL_DARK,
                    borderRadius: 22,
                    padding: "18px 18px 16px",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#fff", fontFamily: fontUi, letterSpacing: "-0.01em" }}>
                        Delivery status
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.45)", fontFamily: fontUi, lineHeight: 1.45 }}>
                        {hero.sub}
                      </p>
                    </div>
                    <StatusMascot stage={stage} />
                  </div>

                  {undelivered ? (
                    <div
                      style={{
                        marginTop: 18,
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: "rgba(189,35,32,0.16)",
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.9)",
                        fontFamily: fontUi,
                        lineHeight: 1.5,
                      }}
                    >
                      We couldn’t hand this order over
                      {trackSnap.codFailureReason ? ` — ${codFailureLabel(trackSnap.codFailureReason).toLowerCase()}` : ""}.
                      Our team will call you to sort it out.
                    </div>
                  ) : (
                    <StageRail stage={stage} />
                  )}

                  {codPending && (
                    <div
                      style={{
                        marginTop: 18,
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.06)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Money size={20} weight="regular" color="rgba(255,255,255,0.7)" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", fontFamily: fontUi, lineHeight: 1.45 }}>
                        {delivered
                          ? `₹${total.toLocaleString("en-IN")} cash is still outstanding`
                          : `Keep ₹${total.toLocaleString("en-IN")} in cash ready for the driver`}
                      </span>
                    </div>
                  )}

                  <a
                    href={waHelpUrl(trackingOrderId, trackSnap?.orderNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      marginTop: 18,
                      padding: "13px 16px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.18)",
                      textAlign: "center",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 800,
                      fontFamily: fontUi,
                      color: "#fff",
                    }}
                  >
                    Need help? Chat with us
                  </a>
                </div>
              )}

              {canCancelOrder ? (
                <div style={{ marginBottom: 14 }}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setCancelErr(null);
                      if (typeof Notification !== "undefined" && Notification.permission === "default") {
                        void Notification.requestPermission();
                      }
                      setCancelModalOpen(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "16px 18px",
                      borderRadius: 16,
                      border: isPendingPayment ? `1px solid ${C.border}` : "none",
                      background: isPendingPayment
                        ? C.surfaceDeep
                        : `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                      color: isPendingPayment ? C_TEXT_MUTED : C.white,
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: fontUi,
                    }}
                  >
                    {isPendingPayment ? "Cancel this checkout" : "Cancel order"}
                  </motion.button>
                  {!isPendingPayment && <CancelCountdown deadline={trackSnap.cancellationDeadline} />}
                </div>
              ) : cancellationWindowClosed ? (
                <div style={{
                  marginBottom: 14, padding: "14px 18px", borderRadius: 16,
                  background: "rgba(189,35,32,0.06)", border: `1px dashed ${C.border}`,
                  textAlign: "center",
                }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "rgba(0,0,0,0.42)", fontFamily: fontUi }}>
                    Cancellation window has closed
                  </p>
                </div>
              ) : null}

              {cancelled ? (
                <div
                  style={{
                    background: C.surfaceDeep,
                    border: `1px solid ${C.border}`,
                    borderRadius: 20,
                    padding: "22px 18px",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C_TEXT_SEC, fontFamily: fontUi, lineHeight: 1.35 }}>
                    This order has been cancelled
                  </p>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: C_TEXT_MUTED,
                      fontFamily: fontUi,
                      lineHeight: 1.55,
                    }}
                  >
                    {refundCopy}
                  </p>
                </div>
              ) : null}

              {/* Address card */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  background: C.surfaceDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    ...ORDER_CARD_ICON_BOX,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={22} weight="regular" color={C.red} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={TYPO.eyebrow}>Deliver to</p>
                  <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 700, color: C_TEXT_SEC, fontFamily: fontUi, lineHeight: 1.45 }}>{addressDisplay}</p>
                </div>
                {canEditAddress ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={onEditAddress}
                    aria-label="Edit delivery address"
                    style={{
                      width: ORDER_CARD_ICON_BOX.width,
                      height: ORDER_CARD_ICON_BOX.height,
                      borderRadius: ORDER_CARD_ICON_BOX.borderRadius,
                      border: `1px solid ${C.border}`,
                      background: C.glass,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 0,
                      padding: 0,
                      cursor: "pointer",
                      flexShrink: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                        lineHeight: 0,
                      }}
                    >
                      <PencilSimple size={18} weight="bold" color={C_TEXT_SEC} />
                    </span>
                  </motion.button>
                ) : null}
              </div>

              {addressSaveError ? (
                <p
                  role="alert"
                  style={{
                    margin: "-4px 2px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.5,
                    color: C.red,
                    fontFamily: fontUi,
                  }}
                >
                  {addressSaveError}
                </p>
              ) : null}

              {/* Items summary */}
              {lines.length > 0 ? (
                <div
                  style={{
                    background: C.surfaceDeep,
                    border: `1px solid ${C.border}`,
                    borderRadius: 18,
                    padding: "18px 16px 20px",
                    marginBottom: 12,
                  }}
                >
                  <p style={{ ...TYPO.eyebrow, margin: "0 0 14px" }}>Your dishes</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {lines.map((l, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "12px 0",
                          borderTop: idx ? `1px solid ${C.border}` : undefined,
                          color: C_TEXT_SEC,
                        }}
                      >
                        <span style={{ fontFamily: fontUi, fontWeight: 700, lineHeight: 1.4, flex: 1, fontSize: 16, color: C.text }}>
                          {l.quantity}× {toTitleCaseLine(l.name)}
                        </span>
                        <span style={{ fontFamily: fontUi, fontWeight: 800, color: C.red, fontSize: 16 }}>₹{Math.round(l.quantity * l.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  {fee ? (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          paddingTop: 14,
                          marginTop: 6,
                          borderTop: `1px solid ${C.border}`,
                          fontSize: 14,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
                          fontFamily: fontUi,
                        }}
                      >
                        <span>Subtotal</span>
                        <span style={{ color: C_TEXT_SEC, fontFamily: fontUi }}>₹{Math.round(fee.itemsSubtotal)}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          paddingTop: 10,
                          fontSize: 14,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
                          fontFamily: fontUi,
                        }}
                      >
                        <span>Packaging</span>
                        <span style={{ color: C_TEXT_SEC, fontFamily: fontUi }}>₹{fee.packaging}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          paddingTop: 10,
                          fontSize: 14,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
                          fontFamily: fontUi,
                        }}
                      >
                        <span>Delivery</span>
                        <span style={{ color: C_TEXT_SEC, fontFamily: fontUi }}>₹{fee.delivery}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          paddingTop: 10,
                          fontSize: 14,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
                          fontFamily: fontUi,
                        }}
                      >
                        <span>GST (5%)</span>
                        <span style={{ color: C_TEXT_SEC, fontFamily: fontUi }}>₹{fee.gst}</span>
                      </div>
                      {fee.adjustment !== 0 ? (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            paddingTop: 10,
                            fontSize: 14,
                            color: C_TEXT_MUTED,
                            fontWeight: 600,
                            fontFamily: fontUi,
                          }}
                        >
                          <span>Adjustments</span>
                          <span style={{ color: C_TEXT_SEC, fontFamily: fontUi }}>₹{fee.adjustment}</span>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C_TEXT_MUTED, letterSpacing: "0.02em", fontFamily: fontUi }}>Total paid</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: C.red, fontFamily: fontUi }}>₹{total}</span>
                  </div>
                </div>
              ) : null}

              {showLiveMap ? (
                <p
                  style={{
                    margin: "-4px 0 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: C_TEXT_MUTED,
                    fontFamily: fontUi,
                    textAlign: "center",
                  }}
                >
                  {driverLat != null
                    ? "Red pin is your address, dark pin is your driver — updating live."
                    : "Your driver's location will appear on the map once they share it."}
                </p>
              ) : null}

              {delivered ? (
                <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
                  {trackSnap.ratingStars ? (
                    <p style={{ margin: 0, fontSize: 18, fontFamily: fontUi, fontWeight: 800, color: C.red, lineHeight: 1.35 }}>
                      Thank you · {trackSnap.ratingStars}★
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: C.text, fontFamily: fontUi, lineHeight: 1.35 }}>Rate this meal</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <motion.button
                            key={n}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            disabled={ratingSending}
                            onClick={() => submitOrderRating(n)}
                            style={{
                              padding: "12px 16px",
                              borderRadius: 12,
                              border: `1px solid ${C.border}`,
                              background: C.glass,
                              color: C.text,
                              fontSize: 16,
                              fontWeight: 800,
                              cursor: ratingSending ? "wait" : "pointer",
                              fontFamily: fontUi,
                            }}
                          >
                            {n}★
                          </motion.button>
                        ))}
                      </div>
                      <textarea
                        value={ratingCommentDraft}
                        onChange={(e) => setRatingCommentDraft(e.target.value)}
                        placeholder="Optional note (saved with your next star)"
                        rows={2}
                        style={{
                          marginTop: 14,
                          width: "100%",
                          borderRadius: 12,
                          border: `1px solid ${C.border}`,
                          background: C.glass,
                          color: C.text,
                          padding: 12,
                          fontSize: 15,
                          fontFamily: fontUi,
                          resize: "none",
                          lineHeight: 1.45,
                        }}
                      />
                    </>
                  )}
                </div>
              ) : null}

              {/* Pending-payment actions: Pay now + dismiss */}
              {isPendingPayment && trackSnap.paymentLinkId && (
                <div style={{ marginBottom: 12 }}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={resumeFetching}
                    onClick={() => void handleResumePayment()}
                    style={{
                      width: "100%",
                      padding: "16px 18px",
                      borderRadius: 16,
                      border: "none",
                      background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                      color: C.white,
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: resumeFetching ? "wait" : "pointer",
                      fontFamily: fontUi,
                      opacity: resumeFetching ? 0.7 : 1,
                    }}
                  >
                    {resumeFetching ? "Opening payment…" : "Complete payment"}
                  </motion.button>
                  {resumeErr ? (
                    <p
                      role="alert"
                      style={{
                        margin: "8px 2px 0",
                        fontSize: 13,
                        fontWeight: 700,
                        color: C.red,
                        fontFamily: fontUi,
                        lineHeight: 1.5,
                      }}
                    >
                      {resumeErr}
                    </p>
                  ) : null}
                </div>
              )}

            </>
          ) : (
            !trackErr && <CenterSpinner fill label="Loading your order" />
          )}

          {/* Cancelled orders lose the dark panel, so keep a way to reach us. */}
          {cancelled ? (
            <a
              href={waHelpUrl(trackingOrderId, trackSnap?.orderNumber)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 10,
                padding: "16px 18px",
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                background: C.surfaceDeep,
                textDecoration: "none",
                color: C_TEXT_MUTED,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(37, 211, 102, 0.12)",
                  border: "1px solid rgba(37, 211, 102, 0.28)",
                }}
                aria-hidden
              >
                <WhatsAppBrandIcon size={22} />
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, fontFamily: fontUi, color: C_TEXT_SEC }}>
                Need help? Message us on WhatsApp
              </span>
            </a>
          ) : null}
        </div>
      )}

      <AnimatePresence>
        {cancelModalOpen ? (
          <motion.div
            key="vk-cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vk-cancel-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(12,12,12,0.48)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
            onClick={() => {
              if (!cancelSubmitting) setCancelModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 340,
                borderRadius: 24,
                padding: "28px 22px 20px",
                background: C.white,
                boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
              }}
            >
              <h2
                id="vk-cancel-title"
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: C.text,
                  fontFamily: fontUi,
                  lineHeight: 1.3,
                  textAlign: "center",
                }}
              >
                Cancel this order?
              </h2>
              <p
                style={{
                  margin: "14px 0 0",
                  fontSize: 15,
                  fontWeight: 600,
                  color: C_TEXT_MUTED,
                  fontFamily: fontUi,
                  lineHeight: 1.55,
                  textAlign: "center",
                }}
              >
                {cancelConfirmBody}
              </p>
              {cancelErr ? (
                <p style={{ margin: "12px 0 0", fontSize: 14, fontWeight: 700, color: "#fca5a5", fontFamily: fontUi, textAlign: "center", lineHeight: 1.45 }}>
                  {cancelErr}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={cancelSubmitting}
                  onClick={() => setCancelModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: "14px 12px",
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    background: C.glass,
                    color: C_TEXT_SEC,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: cancelSubmitting ? "wait" : "pointer",
                    fontFamily: fontUi,
                  }}
                >
                  Keep order
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={cancelSubmitting}
                  onClick={handleConfirmCancel}
                  style={{
                    flex: 1,
                    padding: "14px 12px",
                    borderRadius: 14,
                    border: `1px solid ${C.redBorder}`,
                    background: C.redFaint,
                    color: C.red,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: cancelSubmitting ? "wait" : "pointer",
                    fontFamily: fontUi,
                  }}
                >
                  {cancelSubmitting ? "Cancelling…" : "Yes, cancel"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
