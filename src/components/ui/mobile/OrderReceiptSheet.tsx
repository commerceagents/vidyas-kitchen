"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CookingPot, MapPin, X } from "@phosphor-icons/react";
import { C, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";
import { CenterSpinner } from "@/components/ui/mobile/EmptyState";
import { DELIVERY_SLOT_TIMEZONE } from "@/lib/delivery-slots";
import { parseRecipeTag } from "@/lib/dish-name";
import { formatOrderRef, normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { whatsappBotLink } from "@/lib/whatsapp-copy";
import { resolveOrderItemImageUrl } from "@/lib/menu/item-image";

const fontUi = C.mono;

type Receipt = {
  orderNumber: number | null;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  deliveryAddress: string | null;
  deliverySlot: string | null;
  totalAmount: number | null;
  refundStatus: string | null;
  refundAmount: number | null;
  lines: { name: string; quantity: number; unitPrice: number; imageUrl?: string | null }[];
  breakdown: {
    itemsSubtotal: number;
    packaging: number;
    delivery: number;
    gst: number;
    adjustment: number;
  } | null;
};

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function statusLine(status: string, paymentMethod: string | null, paymentStatus: string | null): string {
  switch (normalizeOrderStatus(status)) {
    case OrderStatus.DELIVERED:
      return "Delivered";
    case OrderStatus.CANCELLED:
      return "Cancelled";
    case OrderStatus.REJECTED:
      return "Rejected by the kitchen";
    case OrderStatus.UNDELIVERED:
      return "Could not be delivered";
    default:
      return (paymentMethod || "").toLowerCase() === "cod" && paymentStatus !== "paid"
        ? "In progress · Cash on delivery"
        : "In progress";
  }
}

function formatSlot(slot: string | null): string {
  if (!slot) return "";
  const d = new Date(slot);
  if (Number.isNaN(d.getTime())) return slot;
  return d.toLocaleString("en-IN", {
    timeZone: DELIVERY_SLOT_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A finished order, as a receipt rather than a tracking screen — what was
 * ordered, what it cost, where it went, and a way to raise a problem with it.
 */
export function OrderReceiptSheet({
  orderId,
  customerPhone,
  onClose,
}: {
  orderId: string;
  customerPhone: string;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/orders/status?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(customerPhone)}`,
        );
        const data = (await res.json().catch(() => ({}))) as Receipt & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Could not load this order");
        setReceipt(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this order");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerPhone, orderId]);

  const ref = formatOrderRef(receipt?.orderNumber ?? null, orderId);
  if (!portalReady) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 420,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        fontFamily: fontUi,
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vk-receipt-title"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "88dvh",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: C.bg,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 18px 14px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              id="vk-receipt-title"
              style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}
            >
              Order {ref}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                fontWeight: 700,
                color:
                  receipt &&
                  (normalizeOrderStatus(receipt.status) === OrderStatus.REJECTED ||
                    normalizeOrderStatus(receipt.status) === OrderStatus.CANCELLED)
                    ? C.red
                    : C_TEXT_MUTED,
              }}
            >
              {receipt ? statusLine(receipt.status, receipt.paymentMethod, receipt.paymentStatus) : "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={17} weight="bold" color={C.text} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "16px 18px 20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {error ? (
            <p style={{ margin: "20px 0", fontSize: 14.5, fontWeight: 700, color: C.red, lineHeight: 1.5 }}>{error}</p>
          ) : !receipt ? (
            <CenterSpinner minHeight={200} label="Loading your receipt" />
          ) : (
            <>
              {receipt.deliverySlot ? (
                <Row label="Delivery" value={formatSlot(receipt.deliverySlot)} />
              ) : null}
              {receipt.deliveryAddress ? (
                <div style={{ display: "flex", gap: 10, padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                  <MapPin size={17} weight="regular" color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C_TEXT_SEC, lineHeight: 1.5 }}>
                    {receipt.deliveryAddress}
                  </p>
                </div>
              ) : null}

              <p
                style={{
                  margin: "18px 0 6px",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  color: C_TEXT_MUTED,
                }}
              >
                Items
              </p>
              {receipt.lines.map((line, i) => {
                const thumb = line.imageUrl || resolveOrderItemImageUrl({ name: line.name });
                return (
                <div
                  key={`${line.name}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      flexShrink: 0,
                      overflow: "hidden",
                      background: C.redFaint,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- menu photo from public/menu-images
                      <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <CookingPot size={20} weight="regular" color={C.red} />
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
                    {parseRecipeTag(line.name).cleanName}
                    {line.quantity > 1 ? (
                      <span style={{ color: C_TEXT_MUTED, fontWeight: 700 }}> ×{line.quantity}</span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.text, flexShrink: 0 }}>
                    {money(line.unitPrice * line.quantity)}
                  </span>
                </div>
                );
              })}

              {receipt.breakdown ? (
                <div style={{ marginTop: 14 }}>
                  <Row label="Item total" value={money(receipt.breakdown.itemsSubtotal)} subtle />
                  <Row label="Packaging" value={money(receipt.breakdown.packaging)} subtle />
                  <Row label="Delivery" value={money(receipt.breakdown.delivery)} subtle />
                  <Row label="Taxes" value={money(receipt.breakdown.gst)} subtle />
                  {receipt.breakdown.adjustment ? (
                    <Row label="Adjustment" value={money(receipt.breakdown.adjustment)} subtle />
                  ) : null}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 12,
                  paddingTop: 14,
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Total paid</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.red }}>
                  {receipt.totalAmount != null ? money(receipt.totalAmount) : "—"}
                </span>
              </div>

              {receipt.refundStatus ? (
                <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 700, color: C_TEXT_MUTED, lineHeight: 1.5 }}>
                  {receipt.refundStatus === "refunded"
                    ? `Refunded ${receipt.refundAmount != null ? money(receipt.refundAmount) : ""} to your original payment method.`
                    : "Refund in progress — it lands back on your original payment method."}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div style={{ padding: `12px 18px max(18px, env(safe-area-inset-bottom, 0px))` }}>
          <motion.a
            whileTap={{ scale: 0.98 }}
            href={whatsappBotLink(`Hi — I need help with order ${ref}.`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              boxSizing: "border-box",
              padding: "15px 20px",
              borderRadius: 16,
              border: `1px solid ${C.redBorder}`,
              background: C.redFaint,
              color: C.red,
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
              fontFamily: fontUi,
            }}
          >
            Need help with this order
          </motion.a>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function Row({ label, value, subtle = false }: { label: string; value: string; subtle?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: subtle ? "5px 0" : "12px 0",
        borderBottom: subtle ? "none" : `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 600, color: C_TEXT_MUTED }}>{label}</span>
      <span
        style={{
          fontSize: subtle ? 13.5 : 14,
          fontWeight: subtle ? 700 : 800,
          color: subtle ? C_TEXT_SEC : C.text,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}
