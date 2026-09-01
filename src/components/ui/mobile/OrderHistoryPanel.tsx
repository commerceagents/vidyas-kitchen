"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowClockwise, CaretRight, Receipt } from "@phosphor-icons/react";
import { C, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";
import { DELIVERY_SLOT_TIMEZONE } from "@/lib/delivery-slots";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { parseRecipeTag } from "@/lib/dish-name";

export type HistoryOrder = {
  orderId: string;
  orderNumber: number | null;
  status: string;
  createdAt: string | null;
  totalAmount: number | null;
  deliverySlot: string | null;
  deliverySlotKind: string | null;
  deliveryAddress: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  ratingStars: number | null;
  items: { name: string; imageUrl: string | null; quantity: number }[];
};

const fontUi = C.mono;

/** Colour + wording for the pill on each history row. */
function statusPill(status: string): { label: string; fg: string; bg: string } {
  switch (normalizeOrderStatus(status)) {
    case OrderStatus.DELIVERED:
      return { label: "Delivered", fg: "#12833F", bg: "rgba(18,131,63,0.10)" };
    case OrderStatus.CANCELLED:
      return { label: "Cancelled", fg: C_TEXT_MUTED, bg: "rgba(0,0,0,0.05)" };
    case OrderStatus.UNDELIVERED:
      return { label: "Not delivered", fg: C.red, bg: C.redFaint };
    case OrderStatus.PENDING_PAYMENT:
      return { label: "Payment pending", fg: "#A96A00", bg: "rgba(169,106,0,0.10)" };
    case OrderStatus.OUT_FOR_DELIVERY:
      return { label: "On the way", fg: C.red, bg: C.redFaint };
    default:
      return { label: "In progress", fg: C.red, bg: C.redFaint };
  }
}

/** Live orders keep a "Track" affordance; finished ones don't. */
function isLiveOrder(status: string): boolean {
  const s = normalizeOrderStatus(status);
  return (
    s !== OrderStatus.DELIVERED && s !== OrderStatus.CANCELLED && s !== OrderStatus.UNDELIVERED
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    timeZone: DELIVERY_SLOT_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function summariseItems(items: HistoryOrder["items"]): string {
  if (!items.length) return "Order details unavailable";
  const count = items.reduce((a, i) => a + i.quantity, 0);
  const first = parseRecipeTag(items[0].name).cleanName;
  if (items.length === 1) return `${first}${count > 1 ? ` ×${count}` : ""}`;
  return `${first} + ${items.length - 1} more`;
}

/**
 * "My Orders" — every order this phone number has placed. Live orders open the
 * tracking panel; finished ones are a receipt at a glance.
 */
export function OrderHistoryPanel({
  customerPhone,
  activeOrderId,
  onTrackOrder,
}: {
  customerPhone: string;
  activeOrderId: string | null;
  onTrackOrder: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState<HistoryOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const phone = customerPhone.trim();
  const signedIn = phone.replace(/\D/g, "").length >= 10;

  const load = useCallback(async () => {
    if (!signedIn) return;
    setError(null);
    try {
      const res = await fetch(`/api/orders/history?phone=${encodeURIComponent(phone)}`);
      const data = (await res.json().catch(() => ({}))) as {
        orders?: HistoryOrder[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not load your orders");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your orders");
      setOrders([]);
    }
  }, [phone, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!signedIn) {
    return (
      <Empty
        title="Sign in to see your orders"
        body="Your past orders are tied to the phone number you order with."
      />
    );
  }

  if (orders === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "56px 0" }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2.5px solid rgba(0,0,0,0.08)",
            borderTopColor: C.red,
            animation: "vk-spin 0.7s linear infinite",
          }}
        />
        <style>{"@keyframes vk-spin{to{transform:rotate(360deg)}}"}</style>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Empty
        title={error ?? "No orders yet"}
        body={
          error
            ? "Pull down or tap retry in a moment."
            : "Once you place your first order it'll show up here with its full receipt."
        }
        onRetry={error ? load : undefined}
      />
    );
  }

  return (
    <div style={{ padding: "4px 0 8px", fontFamily: fontUi }}>
      {orders.map((o) => {
        const pill = statusPill(o.status);
        const live = isLiveOrder(o.status);
        const isActive = o.orderId === activeOrderId;
        const codOutstanding =
          (o.paymentMethod || "").toLowerCase() === "cod" && (o.paymentStatus || "pending") !== "paid";

        return (
          <motion.button
            key={o.orderId}
            type="button"
            whileTap={{ scale: 0.99 }}
            onClick={() => onTrackOrder(o.orderId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: 14,
              marginBottom: 10,
              borderRadius: 18,
              background: C.surfaceDeep,
              border: `1px solid ${isActive ? C.redBorder : C.border}`,
              cursor: "pointer",
              fontFamily: fontUi,
            }}
          >
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                flexShrink: 0,
                overflow: "hidden",
                background: C.redFaint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden
            >
              {o.items[0]?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote menu photo, no loader configured
                <img
                  src={o.items[0].imageUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Receipt size={22} weight="regular" color={C.red} />
              )}
            </span>

            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                  #{o.orderNumber ?? o.orderId.slice(0, 6).toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.03em",
                    padding: "3px 8px",
                    borderRadius: 999,
                    color: pill.fg,
                    background: pill.bg,
                  }}
                >
                  {pill.label}
                </span>
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 5,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: C_TEXT_SEC,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {summariseItems(o.items)}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C_TEXT_MUTED,
                }}
              >
                {formatWhen(o.createdAt)}
                {o.totalAmount != null ? ` · ₹${Math.round(o.totalAmount).toLocaleString("en-IN")}` : ""}
                {codOutstanding ? " · Cash on delivery" : ""}
              </span>
            </span>

            <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
              {live ? (
                <span style={{ fontSize: 12, fontWeight: 800, color: C.red }}>Track</span>
              ) : null}
              <CaretRight size={15} weight="bold" color="rgba(0,0,0,0.25)" />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Empty({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", fontFamily: fontUi }}>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>{title}</p>
      <p style={{ margin: "10px 0 0", fontSize: 14.5, fontWeight: 600, color: C_TEXT_MUTED, lineHeight: 1.55 }}>
        {body}
      </p>
      {onRetry ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onRetry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 18,
            padding: "11px 18px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.surfaceDeep,
            color: C.text,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: fontUi,
          }}
        >
          <ArrowClockwise size={16} weight="bold" />
          Retry
        </motion.button>
      ) : null}
    </div>
  );
}
