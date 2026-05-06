"use client";

import { motion } from "framer-motion";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { SUPPORT_PHONE_E164 } from "@/lib/whatsapp-copy";
import { C, C_ICON, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";
import { computeOrderBreakdownFromItemSubtotal } from "@/lib/order-pricing";

const fontUi = C.mono;

function shortOrderRef(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 6).toLowerCase();
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
  return { title: "Order update", description: "We’re fetching the latest status for you." };
}

function statusIconSvg(kind: "clock" | "flame" | "package" | "bike" | "home") {
  const stroke = C_ICON;
  const common = { width: 22 as const, height: 22 as const, viewBox: "0 0 24 24" as const, fill: "none" as const, stroke, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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

function statusPrimaryIcon(status: string) {
  const n = normalizeTrackStatus(status);
  if (n === "pending_payment" || n === "paid") return statusIconSvg("clock");
  if (n === "preparing") return statusIconSvg("flame");
  if (n === "ready") return statusIconSvg("package");
  if (n === "out_for_delivery") return statusIconSvg("bike");
  if (n === "delivered") return statusIconSvg("home");
  return statusIconSvg("clock");
}

function slotKindGlyph(kind: string | null | undefined) {
  const k = (kind || "").toLowerCase();
  if (k === "breakfast")
    return (
      <span aria-hidden style={{ fontSize: 15 }}>
        ☀️
      </span>
    );
  if (k === "lunch")
    return (
      <span aria-hidden style={{ fontSize: 15 }}>
        ☕
      </span>
    );
  if (k === "dinner")
    return (
      <span aria-hidden style={{ fontSize: 15 }}>
        🌙
      </span>
    );
  return (
    <span aria-hidden style={{ fontSize: 15 }}>
      🍽️
    </span>
  );
}

const STEP_ICONS = [
  (active: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? C.red : C_TEXT_MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  (active: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? C.red : C_TEXT_MUTED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5a3.5 3.5 0 0 0 6 0c0-1.5-1.5-2-1.5-4.5 0-1-1-2-2.5-3.5C8 9.5 7 10.5 7 12c0 .5.2 1 .4 1.4Z" />
    </svg>
  ),
  (active: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? C.red : C_TEXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  (active: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? C.red : C_TEXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M15 5h-3l-2 9h8" />
    </svg>
  ),
  (active: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? C.red : C_TEXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 22V12h6v10" />
    </svg>
  ),
];

const STEP_LABELS = ["PAID", "PREP", "READY", "OUT", "DONE"];

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

export function OrderTrackingPanel({
  trackingOrderId,
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
  const mapToken = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "" : "";
  const stepIdx = trackSnap ? mainTrackStep(trackSnap.status) : -1;
  const n = trackSnap ? normalizeTrackStatus(trackSnap.status) : "";
  const outForDelivery = n === "out_for_delivery";
  const delivered = n === "delivered";
  const canEditAddress =
    !!onEditAddress && !!trackSnap && (normalizeTrackStatus(trackSnap.status) === "paid" || normalizeTrackStatus(trackSnap.status) === "pending_payment");
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
        padding: `12px 16px max(28px, env(safe-area-inset-bottom))`,
        fontFamily: fontUi,
      }}
    >
      {trackBanner ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 14,
            background: C.redFaint,
            border: `1px solid ${C.redBorder}`,
            color: C.white,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          {trackBanner}
        </motion.div>
      ) : null}

      {!trackingOrderId ? (
        <div style={{ paddingTop: 32, textAlign: "center" }}>
          <p style={{ margin: 0, color: C_TEXT_SEC, fontSize: 15, fontFamily: fontUi, lineHeight: 1.6 }}>
            Complete checkout to place an order. After payment, your schedule and updates will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: C_TEXT_MUTED, textTransform: "uppercase" }}>Your order</p>
              <h1
                style={{
                  margin: "6px 0 0",
                  fontSize: 26,
                  fontWeight: 700,
                  color: C.white,
                  fontFamily: fontUi,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                #{shortOrderRef(trackingOrderId)}
              </h1>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              aria-label="Notifications"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: C.glass,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C_ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </motion.button>
          </div>

          {trackErr ? (
            <p style={{ margin: "0 0 16px", color: "#fca5a5", fontSize: 13, fontWeight: 600 }}>{trackErr}</p>
          ) : null}

          {trackSnap ? (
            <>
              {/* Slot pill */}
              {trackSnap.deliverySlot ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    borderRadius: 999,
                    background: C.surfaceDeep,
                    border: `1px solid ${C.border}`,
                    marginBottom: 18,
                  }}
                >
                  {slotKindGlyph(trackSnap.deliverySlotKind)}
                  <span style={{ fontSize: 13, fontWeight: 700, color: C_TEXT_SEC, fontFamily: fontUi }}>
                    {formatSlotLineForCustomer(trackSnap.deliverySlot, trackSnap.deliverySlotKind ?? undefined)}
                  </span>
                </div>
              ) : null}

              {/* Stepper */}
              <div
                style={{
                  background: C.surfaceDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 20,
                  padding: "18px 12px 16px",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0 }}>
                  {STEP_LABELS.map((lbl, i) => {
                    const done = stepIdx > i || (delivered && i < 5);
                    const current = stepIdx === i;
                    const IconFn = STEP_ICONS[i]!;
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
                                marginTop: 13,
                                opacity: 0.85,
                              }}
                            />
                          ) : (
                            <div style={{ flex: 1 }} />
                          )}
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: `2px solid ${done || current ? C.red : C.border}`,
                            background: done ? C.red : current ? C.glass : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            boxShadow: current && !done ? `0 0 0 4px rgba(189,35,32,0.28)` : undefined,
                          }}
                        >
                          {done ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : (
                            IconFn(current)
                          )}
                        </div>
                          {i < STEP_LABELS.length - 1 ? (
                            <div
                              style={{
                                flex: 1,
                                height: 2,
                                background: stepIdx > i || delivered ? C.red : C.border,
                                borderRadius: 1,
                                marginLeft: -2,
                                marginTop: 13,
                                opacity: 0.85,
                              }}
                            />
                          ) : (
                            <div style={{ flex: 1 }} />
                          )}
                        </div>
                        <span
                          style={{
                            marginTop: 8,
                            fontSize: 8,
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            color: current || done ? C.red : C_TEXT_MUTED,
                            textAlign: "center",
                            lineHeight: 1.2,
                          }}
                        >
                          {lbl}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status card */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  background: C.surfaceDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: C.glass,
                    border: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {statusPrimaryIcon(trackSnap.status)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.white, fontFamily: fontUi, lineHeight: 1.3 }}>{statusTitle}</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: C_TEXT_MUTED, lineHeight: 1.55 }}>{statusDesc}</p>
                </div>
              </div>

              {/* Address card */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  background: C.surfaceDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: C.glass,
                    border: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C_ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: C_TEXT_MUTED, textTransform: "uppercase" }}>Deliver to</p>
                  <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 600, color: C_TEXT_SEC, fontFamily: fontUi, lineHeight: 1.45 }}>{addressDisplay}</p>
                </div>
                {canEditAddress ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={onEditAddress}
                    aria-label="Edit delivery address"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.glass,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C_TEXT_SEC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
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
                  <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: C_TEXT_MUTED, textTransform: "uppercase" }}>Your dishes</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {lines.map((l, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 0",
                          borderTop: idx ? `1px solid ${C.border}` : undefined,
                          fontSize: 13,
                          color: C_TEXT_SEC,
                        }}
                      >
                        <span style={{ fontFamily: fontUi, fontWeight: 600, lineHeight: 1.35, flex: 1 }}>
                          {l.quantity}× {l.name}
                        </span>
                        <span style={{ fontFamily: fontUi, fontWeight: 700, color: C.red }}>₹{Math.round(l.quantity * l.unitPrice)}</span>
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
                          paddingTop: 12,
                          marginTop: 4,
                          borderTop: `1px solid ${C.border}`,
                          fontSize: 12,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
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
                          paddingTop: 8,
                          fontSize: 12,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
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
                          paddingTop: 8,
                          fontSize: 12,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
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
                          paddingTop: 8,
                          fontSize: 12,
                          color: C_TEXT_MUTED,
                          fontWeight: 600,
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
                            paddingTop: 8,
                            fontSize: 12,
                            color: C_TEXT_MUTED,
                            fontWeight: 600,
                          }}
                        >
                          <span>Adjustments</span>
                          <span style={{ color: C_TEXT_SEC, fontFamily: fontUi }}>₹{fee.adjustment}</span>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C_TEXT_MUTED, letterSpacing: "0.08em" }}>TOTAL PAID</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: C.red, fontFamily: fontUi }}>₹{total}</span>
                  </div>
                </div>
              ) : null}

              {/* Live pulse + map */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingLeft: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: C.red,
                    boxShadow: `0 0 0 0 rgba(189,35,32,0.4)`,
                    animation: "vk-track-pulse 2s ease-out infinite",
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: C_TEXT_MUTED, letterSpacing: "0.04em" }}>Tracking live · updates every 10s</span>
              </div>
              <style>{`@keyframes vk-track-pulse { 0% { box-shadow: 0 0 0 0 rgba(189,35,32,0.45);} 70% { box-shadow: 0 0 0 10px rgba(189,35,32,0);} 100% { box-shadow: 0 0 0 0 rgba(189,35,32,0);} }`}</style>

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
                  <div style={{ padding: "10px 12px", background: C.glass, fontSize: 11, fontWeight: 600, color: C_TEXT_MUTED }}>
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
                    fontSize: 12,
                    marginBottom: 14,
                    textAlign: "center",
                  }}
                >
                  Map preview needs saved location & Mapbox token.
                </div>
              ) : null}

              {delivered ? (
                <div style={{ background: C.surfaceDeep, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
                  {trackSnap.ratingStars ? (
                    <p style={{ margin: 0, fontSize: 16, fontFamily: fontUi, fontWeight: 700, color: C.red }}>
                      Thank you · {trackSnap.ratingStars}★
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: C.white, fontFamily: fontUi }}>Rate this meal</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <motion.button
                            key={n}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            disabled={ratingSending}
                            onClick={() => submitOrderRating(n)}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 12,
                              border: `1px solid ${C.border}`,
                              background: C.glass,
                              color: C.white,
                              fontSize: 14,
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
                          marginTop: 12,
                          width: "100%",
                          borderRadius: 12,
                          border: `1px solid ${C.border}`,
                          background: C.glass,
                          color: C.white,
                          padding: 10,
                          fontSize: 12,
                          fontFamily: fontUi,
                          resize: "none",
                        }}
                      />
                    </>
                  )}
                </div>
              ) : null}

              {/* Clear from this device */}
              {onDismiss ? (
                <div style={{ marginBottom: 16 }}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={onDismiss}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 16,
                      border: `1px solid ${C.border}`,
                      background: C.glass,
                      color: C_TEXT_SEC,
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: fontUi,
                    }}
                  >
                    Remove from Order tab
                  </motion.button>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 12,
                      color: C_TEXT_MUTED,
                      lineHeight: 1.55,
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    Clears this order from the Order tab on <span style={{ color: C_TEXT_SEC }}>this phone only</span>. Your kitchen
                    schedule is unchanged — we still message you on WhatsApp.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            !trackErr && (
              <p style={{ color: C_TEXT_SEC, fontSize: 14, fontFamily: fontUi }}>Loading your order…</p>
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
              marginTop: 8,
              padding: "14px 16px",
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              background: C.surfaceDeep,
              textDecoration: "none",
              color: C_TEXT_MUTED,
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
              💬
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
              {outForDelivery ? "Driver en route — message us if you need help" : "Need help? Message us on WhatsApp"}
            </span>
          </a>
        </>
      )}
    </div>
  );
}
