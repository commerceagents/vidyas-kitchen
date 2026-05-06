"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DELIVERY_SLOT_DEFS, DELIVERY_SLOT_TIMEZONE, isValidSlotKind } from "@/lib/delivery-slots";
import { SUPPORT_PHONE_E164 } from "@/lib/whatsapp-copy";
import { C, C_ICON, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";
import { computeOrderBreakdownFromItemSubtotal } from "@/lib/order-pricing";

/** Green slot icon tile — matches “Highly reordered” accent. */
const HIGHLY_REORDERED_GREEN = "#4ade80";
const SLOT_ICON_BOX_BG = "rgba(74,222,128,0.2)";
const SLOT_ICON_BOX_BORDER = "rgba(74,222,128,0.38)";

/** Status + address cards — match home location pin tile. */
const ORDER_CARD_ICON_BOX = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: "rgba(189,35,32,0.12)",
  border: "1px solid rgba(189,35,32,0.25)",
} as const;

const fontUi = C.mono;

/** Matches Home / Account: eyebrows, titles, body (readable on OLED). */
const TYPO = {
  eyebrow: {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.04em",
    color: "rgba(255,255,255,0.4)",
    fontFamily: fontUi,
  },
  heroId: {
    margin: "8px 0 0",
    fontSize: 30,
    fontWeight: 800,
    color: C.white,
    fontFamily: fontUi,
    letterSpacing: "-0.02em",
    lineHeight: 1.12,
  },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: C.white, fontFamily: fontUi, lineHeight: 1.35 },
  body: { fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.45)", lineHeight: 1.55, fontFamily: fontUi },
} as const;

function shortOrderRef(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 6).toLowerCase();
}

/** Title-case dish lines from API (e.g. "EGG CURRY" → "Egg Curry"). */
function toTitleCaseLine(str: string) {
  return str.toLowerCase().replace(/(?:^|\s|\(|\/)\w/g, (m) => m.toUpperCase());
}

export type OrderTrackSnap = {
  status: string;
  deliveryAddress?: string | null;
  deliverySlot?: string | null;
  deliverySlotKind?: string | null;
  ratingStars?: number | null;
  ratingComment?: string | null;
  totalAmount?: number | null;
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
  if (x === "confirmed" || x === "prepping") return "preparing";
  if (x === "out") return "out_for_delivery";
  return x;
}

function mainTrackStep(status: string): number {
  const n = normalizeTrackStatus(status);
  switch (n) {
    case "cancelled":
      return -1;
    case "pending_payment":
      return -1;
    case "paid":
      return 0;
    case "preparing":
      return 1;
    case "ready":
      return 2;
    case "out_for_delivery":
      return 3;
    case "delivered":
      return 4;
    default:
      return -1;
  }
}

function statusCopy(status: string): { title: string; description: string } {
  const s = normalizeTrackStatus(status);
  if (s === "pending_payment")
    return { title: "Waiting for payment", description: "Complete checkout to send your order to the kitchen." };
  if (s === "paid")
    return { title: "Kitchen will accept soon", description: "Payment is in — we’re lining up your meal with the next prep wave." };
  if (s === "preparing")
    return { title: "Your meal is being prepared", description: "Fresh ingredients, no rush — we’re cooking your order with care." };
  if (s === "ready")
    return { title: "Packed and ready for pickup", description: "Your boxes are sealed; the rider will collect them shortly." };
  if (s === "out_for_delivery")
    return { title: "Driver is on the way", description: "Watch for the door — your meal should arrive in the chosen window." };
  if (s === "delivered") return { title: "Enjoy your meal", description: "Thank you for choosing Vidya’s Kitchen today." };
  if (s === "cancelled")
    return {
      title: "Order cancelled",
      description: "We’ve updated our systems and sent you WhatsApp so everything stays in sync.",
    };
  return { title: "Order update", description: "We’re fetching the latest status for you." };
}

function statusIconSvg(kind: "clock" | "flame" | "package" | "bike" | "home", strokeColor?: string) {
  const stroke = strokeColor ?? C_ICON;
  const common = { width: 24 as const, height: 24 as const, viewBox: "0 0 24 24" as const, fill: "none" as const, stroke, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M8.5 16.5a4.5 4.5 0 0 0 7 0c0-2-2-3-2-6 0-1.5-1-3-3.5-5.5C7 10.5 6 12 6 14c0 1 .5 1.8 1 2.5Z" />
        </svg>
      );
    case "package":
      return (
        <svg {...common}>
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "bike":
      return (
        <svg {...common}>
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="18.5" cy="17.5" r="3.5" />
          <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3 2-3.5 7.5L9 9" />
          <path d="m9 18 2.5-4.5L15 18" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
  }
}

function statusPrimaryIcon(status: string, strokeColor?: string) {
  const n = normalizeTrackStatus(status);
  if (n === "cancelled") {
    const stroke = strokeColor ?? C_TEXT_MUTED;
    return (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={2} />
        <path d="m15 9-6 6M9 9l6 6" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  if (n === "pending_payment" || n === "paid") return statusIconSvg("clock", strokeColor);
  if (n === "preparing") return statusIconSvg("flame", strokeColor);
  if (n === "ready") return statusIconSvg("package", strokeColor);
  if (n === "out_for_delivery") return statusIconSvg("bike", strokeColor);
  if (n === "delivered") return statusIconSvg("home", strokeColor);
  return statusIconSvg("clock", strokeColor);
}

function canCustomerCancelStatus(status: string): boolean {
  const s = normalizeTrackStatus(status);
  return ["pending_payment", "paid", "preparing", "ready", "out_for_delivery"].includes(s);
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

function SlotKindIcon({ kind, size = 20 }: { kind: string | null | undefined; size?: number }) {
  const g = HIGHLY_REORDERED_GREEN;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24" as const,
    fill: "none" as const,
    stroke: g,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const k = (kind || "").toLowerCase();
  if (k === "breakfast")
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  if (k === "lunch")
    return (
      <svg {...common} aria-hidden>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" />
        <path d="M6 1v3" />
        <path d="M10 1v3" />
        <path d="M14 1v3" />
      </svg>
    );
  if (k === "dinner")
    return (
      <svg {...common} aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Parsed slot for tracking card (readable date + time, avoids cramped single-line chip). */
function formatTrackSlotDisplay(slotStartIso: string, kind?: string | null) {
  const d = new Date(slotStartIso);
  if (Number.isNaN(d.getTime())) return null;
  const kindLabel = kind && isValidSlotKind(kind) ? DELIVERY_SLOT_DEFS[kind].label : "Delivery";
  const datePart = d.toLocaleDateString("en-IN", {
    timeZone: DELIVERY_SLOT_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timePart = d.toLocaleTimeString("en-IN", {
    timeZone: DELIVERY_SLOT_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { kindLabel, datePart, timePart };
}

/** Full-width delivery slot — same shell as address / status cards. */
function OrderSlotCard({
  deliverySlot,
  deliverySlotKind,
}: {
  deliverySlot: string;
  deliverySlotKind: string | null | undefined;
}) {
  const parsed = formatTrackSlotDisplay(deliverySlot, deliverySlotKind);
  if (!parsed) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: C.surfaceDeep,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: SLOT_ICON_BOX_BG,
          border: `1px solid ${SLOT_ICON_BOX_BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <SlotKindIcon kind={deliverySlotKind} size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...TYPO.eyebrow, margin: 0 }}>Delivery slot</p>
        <p style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 800, color: C.white, fontFamily: fontUi, lineHeight: 1.3 }}>
          {parsed.kindLabel}
        </p>
        <p
          style={{
            margin: "5px 0 0",
            fontSize: 15,
            fontWeight: 600,
            color: C_TEXT_SEC,
            fontFamily: fontUi,
            lineHeight: 1.45,
          }}
        >
          {parsed.datePart}
          <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 0.35em" }}>·</span>
          {parsed.timePart}
          <span style={{ color: C_TEXT_MUTED, fontWeight: 700, fontSize: 13, marginLeft: 6 }}>IST</span>
        </p>
      </div>
    </div>
  );
}

const STEP_ICON_PX = 18;

/** Compact stroke icons (24×24 viewBox) — readable at small sizes in the stepper. */
const STEP_ICONS = [
  (active: boolean) => {
    const s = active ? C.red : C_TEXT_MUTED;
    return (
      <svg width={STEP_ICON_PX} height={STEP_ICON_PX} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M20 6 9 17l-5-5" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
  /* PREP — cooking / pot (clearer than tiny flame path) */
  (active: boolean) => {
    const s = active ? C.red : C_TEXT_MUTED;
    return (
      <svg width={STEP_ICON_PX} height={STEP_ICON_PX} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10.5c0 5 4 8.5 8 8.5s8-3.5 8-8.5"
          stroke={s}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M4 10.5V9c0-1.1.9-2 2-2h2" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 10.5V9c0-1.1-.9-2-2-2h-2" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 7V5a2 2 0 1 1 4 0v2" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
  /* READY — package (Lucide-aligned strokes) */
  (active: boolean) => {
    const s = active ? C.red : C_TEXT_MUTED;
    return (
      <svg width={STEP_ICON_PX} height={STEP_ICON_PX} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 22v-10" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
          stroke={s}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m3.3 7 8.7 4.98 8.7-4.98" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="m7.5 4.21 9 5.14" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
  /* OUT — delivery truck */
  (active: boolean) => {
    const s = active ? C.red : C_TEXT_MUTED;
    return (
      <svg width={STEP_ICON_PX} height={STEP_ICON_PX} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M14 18V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a1 1 0 0 0 1 1h1.5"
          stroke={s}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15 18h2" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M17 18h2.5a1 1 0 0 0 1-1v-3.42a1 1 0 0 0-.26-.68l-2.89-3.22A1 1 0 0 0 16.76 9H15"
          stroke={s}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="18" r="2.5" stroke={s} strokeWidth={2} />
        <circle cx="17.5" cy="18" r="2.5" stroke={s} strokeWidth={2} />
      </svg>
    );
  },
  /* DONE — home delivered */
  (active: boolean) => {
    const s = active ? C.red : C_TEXT_MUTED;
    return (
      <svg width={STEP_ICON_PX} height={STEP_ICON_PX} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 22V12h6v10" stroke={s} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
];

const STEP_LABELS = ["Paid", "Prep", "Ready", "Out", "Done"];

/** Subtle pulse ring for the active tracking step (not for completed checkmarks). */
const STEP_ACTIVE_RING_COLOR = "rgba(189,35,32,0.42)";

function mapStaticUrl(userLat: number, userLng: number, token: string): string {
  const dLng = 0.01;
  const dLat = 0.008;
  const rLng = userLng + dLng;
  const rLat = userLat + dLat;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+BD2320(${userLng},${userLat}),pin-s+FFFFFF(${rLng},${rLat})/auto/640x240@2x?padding=60&access_token=${encodeURIComponent(token)}`;
}

function waHelpUrl(orderId: string) {
  const digits = SUPPORT_PHONE_E164.replace(/\D/g, "");
  const text = encodeURIComponent(`Hi — question about order #${shortOrderRef(orderId)}…`);
  return `https://wa.me/${digits}?text=${text}`;
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
  ratingCommentDraft: string;
  setRatingCommentDraft: (v: string) => void;
  ratingSending: boolean;
  submitOrderRating: (n: number) => void;
}) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  const mapToken = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "" : "";
  const stepIdx = trackSnap ? mainTrackStep(trackSnap.status) : -1;
  const n = trackSnap ? normalizeTrackStatus(trackSnap.status) : "";
  const cancelled = n === "cancelled";
  const outForDelivery = n === "out_for_delivery";
  const delivered = n === "delivered";
  const canEditAddress =
    !!onEditAddress && !!trackSnap && (normalizeTrackStatus(trackSnap.status) === "paid" || normalizeTrackStatus(trackSnap.status) === "pending_payment");
  const canCancelOrder =
    !!onDismiss &&
    !!trackingOrderId &&
    !!trackSnap &&
    customerPhone.trim().replace(/\D/g, "").length >= 10 &&
    canCustomerCancelStatus(trackSnap.status);

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
      tryNotifyOrderCancelled(shortOrderRef(trackingOrderId));
      setCancelModalOpen(false);
      onDismiss?.();
    } catch (e) {
      setCancelErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCancelSubmitting(false);
    }
  };
  const addressDisplay =
    trackSnap?.deliveryAddress?.trim() ||
    location?.label?.trim() ||
    "We’ll confirm the delivery address from your checkout.";
  const { title: statusTitle, description: statusDesc } = trackSnap ? statusCopy(trackSnap.status) : { title: "…", description: "Loading…" };
  const lines = trackSnap?.lines?.length ? trackSnap.lines : [];
  const total =
    trackSnap?.totalAmount != null && Number.isFinite(Number(trackSnap.totalAmount))
      ? Math.round(Number(trackSnap.totalAmount))
      : lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
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
        minHeight: "72vh",
        background: C.bg,
        padding: `14px 18px max(32px, env(safe-area-inset-bottom))`,
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
            color: C.white,
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.55,
          }}
        >
          {trackBanner}
        </motion.div>
      ) : null}

      {!trackingOrderId ? (
        <div style={{ paddingTop: 32, textAlign: "center" }}>
          <p style={{ margin: 0, color: C_TEXT_SEC, fontSize: 16, fontFamily: fontUi, fontWeight: 600, lineHeight: 1.6 }}>
            Complete checkout to place an order. After payment, your schedule and updates will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Header — order id */}
          <div style={{ marginBottom: trackSnap?.deliverySlot ? 12 : 16 }}>
            <p style={TYPO.eyebrow}>Order ID</p>
            <h1 style={TYPO.heroId}>#{shortOrderRef(trackingOrderId)}</h1>
          </div>
          {trackSnap?.deliverySlot ? (
            <OrderSlotCard deliverySlot={trackSnap.deliverySlot} deliverySlotKind={trackSnap.deliverySlotKind} />
          ) : null}

          {trackErr ? (
            <p style={{ margin: "0 0 18px", color: "#fca5a5", fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{trackErr}</p>
          ) : null}

          {trackSnap ? (
            <>
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
                    You’ll see the same update on WhatsApp. Reply there if you need help with a refund.
                  </p>
                </div>
              ) : (
              <div
                style={{
                  background: C.surfaceDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 20,
                  padding: "20px 14px 18px",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0 }}>
                  {STEP_LABELS.map((lbl, i) => {
                    const done = stepIdx > i || (delivered && i < 5);
                    const current = stepIdx === i;
                    const IconFn = STEP_ICONS[i]!;
                    const node = 34;
                    const barOffset = node / 2 - 1;
                    return (
                      <div key={lbl} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                          {i > 0 ? (
                            <div
                              style={{
                                flex: 1,
                                height: 2,
                                background: stepIdx >= i || delivered ? C.red : C.border,
                                borderRadius: 1,
                                marginRight: -2,
                                marginTop: barOffset,
                                opacity: 0.85,
                              }}
                            />
                          ) : (
                            <div style={{ flex: 1 }} />
                          )}
                        <div
                          style={{
                            position: "relative",
                            width: node,
                            height: node,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {current && !done
                            ? [0, 1].map((ring) => (
                                <motion.div
                                  key={ring}
                                  aria-hidden
                                  animate={{
                                    scale: [1, 1.38],
                                    opacity: [0.28, 0],
                                  }}
                                  transition={{
                                    duration: 2.5,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                    delay: ring * 0.72,
                                  }}
                                  style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    width: node,
                                    height: node,
                                    marginLeft: -node / 2,
                                    marginTop: -node / 2,
                                    borderRadius: "50%",
                                    border: `1.5px solid ${STEP_ACTIVE_RING_COLOR}`,
                                    pointerEvents: "none",
                                    boxSizing: "border-box",
                                  }}
                                />
                              ))
                            : null}
                          <div
                            style={{
                              position: "relative",
                              zIndex: 1,
                              width: node,
                              height: node,
                              borderRadius: "50%",
                              border: `2px solid ${done || current ? C.red : C.border}`,
                              background: done ? C.red : current ? C.glass : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {done ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            ) : (
                              IconFn(current)
                            )}
                          </div>
                        </div>
                          {i < STEP_LABELS.length - 1 ? (
                            <div
                              style={{
                                flex: 1,
                                height: 2,
                                background: stepIdx > i || delivered ? C.red : C.border,
                                borderRadius: 1,
                                marginLeft: -2,
                                marginTop: barOffset,
                                opacity: 0.85,
                              }}
                            />
                          ) : (
                            <div style={{ flex: 1 }} />
                          )}
                        </div>
                        <span
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: "0.05em",
                            color: current || done ? C.red : C_TEXT_MUTED,
                            textAlign: "center",
                            lineHeight: 1.25,
                            fontFamily: fontUi,
                          }}
                        >
                          {lbl}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Status card */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  background: C.surfaceDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 14,
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
                  {statusPrimaryIcon(trackSnap.status, cancelled ? C_TEXT_MUTED : C.red)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={TYPO.cardTitle}>{statusTitle}</p>
                  <p style={{ margin: "10px 0 0", ...TYPO.body }}>{statusDesc}</p>
                </div>
              </div>

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
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={C.red}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    style={{ display: "block" }}
                  >
                    <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
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
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={C_TEXT_SEC}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        style={{ display: "block", transform: "translate(-0.5px, -1px)" }}
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </span>
                  </motion.button>
                ) : null}
              </div>

              {/* Items summary */}
              {lines.length > 0 ? (
                <div
                  style={{
                    background: C.surfaceDeep,
                    border: `1px solid ${C.border}`,
                    borderRadius: 18,
                    padding: 16,
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
                        <span style={{ fontFamily: fontUi, fontWeight: 700, lineHeight: 1.4, flex: 1, fontSize: 16, color: C.white }}>
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

              {/* Map */}
              {outForDelivery && location && mapToken ? (
                <div
                  style={{
                    borderRadius: 18,
                    overflow: "hidden",
                    border: `1px solid ${C.border}`,
                    marginBottom: 14,
                  }}
                >
                  <img
                    src={mapStaticUrl(location.lat, location.lng, mapToken)}
                    alt="Delivery map"
                    style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ padding: "12px 14px", background: C.glass, fontSize: 14, fontWeight: 600, color: C_TEXT_MUTED, fontFamily: fontUi, lineHeight: 1.45 }}>
                    Red pin: your address · White pin: driver (approx.) · Live GPS next
                  </div>
                </div>
              ) : outForDelivery ? (
                <div
                  style={{
                    borderRadius: 18,
                    padding: 20,
                    background: C.glass,
                    border: `1px dashed ${C.border}`,
                    color: C_TEXT_MUTED,
                    fontSize: 15,
                    marginBottom: 14,
                    textAlign: "center",
                    fontWeight: 600,
                    fontFamily: fontUi,
                    lineHeight: 1.5,
                  }}
                >
                  Map preview needs saved location & Mapbox token.
                </div>
              ) : null}

              {delivered ? (
                <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
                  {trackSnap.ratingStars ? (
                    <p style={{ margin: 0, fontSize: 18, fontFamily: fontUi, fontWeight: 800, color: C.red, lineHeight: 1.35 }}>
                      Thank you · {trackSnap.ratingStars}★
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: C.white, fontFamily: fontUi, lineHeight: 1.35 }}>Rate this meal</p>
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
                              color: C.white,
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
                          color: C.white,
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

              {/* Cancel order */}
              {canCancelOrder ? (
                <div style={{ marginBottom: 16 }}>
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
                      border: `1px solid ${C.border}`,
                      background: C.glass,
                      color: C_TEXT_SEC,
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: fontUi,
                    }}
                  >
                    Cancel order
                  </motion.button>
                </div>
              ) : null}
            </>
          ) : (
            !trackErr && (
              <div
                role="status"
                aria-live="polite"
                aria-label="Loading order"
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 55,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    border: `4px solid rgba(189,35,32,0.2)`,
                    borderTopColor: C.red,
                    borderRightColor: C.red,
                    animation: "vk-order-loader-spin 0.85s linear infinite",
                    boxSizing: "border-box",
                  }}
                />
                <style>{`@keyframes vk-order-loader-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )
          )}

          {/* Footer help or map-era: out delivery uses map above; keep WhatsApp secondary */}
          <a
            href={waHelpUrl(trackingOrderId)}
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
              {outForDelivery ? "Driver en route — message us if you need help" : "Need help? Message us on WhatsApp"}
            </span>
          </a>
        </>
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
              background: "rgba(0,0,0,0.88)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
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
                maxWidth: 360,
                borderRadius: 20,
                padding: "26px 22px",
                background: C.surfaceDeep,
                border: `1px solid ${C.border}`,
                boxShadow: "0 24px 48px rgba(0,0,0,0.65)",
              }}
            >
              <h2
                id="vk-cancel-title"
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: C.white,
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
                Are you sure you want to cancel the order? We’ll notify the kitchen and send you the same update on WhatsApp.
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
