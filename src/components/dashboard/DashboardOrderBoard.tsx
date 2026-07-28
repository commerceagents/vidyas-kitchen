"use client";

import { useMemo, useState, useEffect, useCallback, useRef, type ReactNode, type CSSProperties, type MouseEvent } from "react";
import { PackageOpen, User, Clock, X, Check, ShoppingBag, Phone, Truck, Copy } from "lucide-react";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { computeOrderBreakdownFromItemSubtotal, getOrderDisplayTotal, orderItemsSubtotal } from "@/lib/order-pricing";
import { useToast } from "@/components/dashboard/DashboardToast";
import { DriverRowsSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";
import { supabase } from "@/lib/supabase";
import {
  shortOrderId,
  customerDisplayLabel,
  formatOrderItemDisplay,
  formatExpectedDeliverySlot,
  formatPhoneDisplay,
  mealChipStyle,
  mealTypeLabel,
  tabForOrder,
  type DashboardOrder,
  type DashboardOrderItem,
  type DashboardTab,
} from "@/lib/dashboard/orders";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
/** Desktop card body: 1 item row + gap + “+ N more” row — equal height in grid */
const DESKTOP_ITEM_ROW_H = 72;
const DESKTOP_ITEM_GAP = 10;
const DESKTOP_MORE_ROW_H = 28;
const DESKTOP_ITEMS_MIN_H =
  DESKTOP_ITEM_ROW_H + DESKTOP_ITEM_GAP + DESKTOP_MORE_ROW_H;

const ORDER_BTN_HOVER_CSS = `
  .vk-order-btn {
    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease;
  }
  .vk-order-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  .vk-order-btn:active:not(:disabled) {
    transform: translateY(0);
  }
  .vk-order-btn-reject:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.16) !important;
    border-color: rgba(239, 68, 68, 0.55) !important;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.12);
  }
  .vk-order-btn-accept:hover:not(:disabled) {
    filter: brightness(1.06);
    box-shadow: 0 6px 20px rgba(245, 227, 45, 0.35) !important;
  }
  .vk-order-btn-yellow:hover:not(:disabled) {
    filter: brightness(1.06);
    box-shadow: 0 6px 20px rgba(245, 227, 45, 0.35) !important;
  }
  .vk-order-view-items:hover {
    color: #fff !important;
    background: rgba(245, 227, 45, 0.08);
  }
  .vk-order-card {
    transition: background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  @media (hover: hover) and (min-width: 1024px) {
    .vk-order-card:hover:not(.vk-order-card-highlighted) {
      background: #161616 !important;
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
      border-color: #252525 !important;
    }
    .vk-order-card:hover.vk-order-card-highlighted {
      background: #181818 !important;
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(245, 227, 45, 0.2) !important;
    }
  }
`;

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase());
}

function RupeeAmount({
  amount,
  size = 14,
  weight = 800,
  color = "#fff",
  mobile = false,
  cardTotal = false,
}: {
  amount: number;
  size?: number;
  weight?: number;
  color?: string;
  mobile?: boolean;
  /** Desktop order card footer — scales with sidebar (CSS). */
  cardTotal?: boolean;
}) {
  if (cardTotal && !mobile) {
    return (
      <span className="vk-order-card-total-price" style={{ color, fontWeight: weight }}>
        <span className="vk-order-card-total-sym">₹</span>
        <span className="vk-order-card-total-num">{Math.round(amount).toLocaleString("en-IN")}</span>
      </span>
    );
  }

  const symSize = mobile ? size * 1.06 : size;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        fontFamily: FONT,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: symSize,
          fontWeight: weight,
          color,
          lineHeight: 1,
          fontFamily: FONT,
        }}
      >
        ₹
      </span>
      <span
        style={{
          fontSize: size,
          fontWeight: weight,
          color,
          lineHeight: 1,
          letterSpacing: "-0.3px",
          fontFamily: FONT,
        }}
      >
        {Math.round(amount).toLocaleString("en-IN")}
      </span>
    </span>
  );
}

function PackSizeChip({ size, stacked = false }: { size: string; stacked?: boolean }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "6px",
      background: `${YELLOW}14`,
      border: `1px solid ${YELLOW}35`,
      color: YELLOW,
      fontSize: "11px",
      fontWeight: 800,
      letterSpacing: "0.2px",
      marginLeft: stacked ? 0 : "8px",
      verticalAlign: stacked ? undefined : "middle",
      lineHeight: 1.2,
    }}>
      {size}
    </span>
  );
}

function OrderItemRow({ item, thumbSize = 44, mobile = false }: { item: DashboardOrderItem; thumbSize?: number; mobile?: boolean }) {
  const { name, weight } = formatOrderItemDisplay(item);
  const lineTotal = (item.unit_price || 0) * item.quantity;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "#222",
        borderRadius: 10,
      }}
    >
      <DishThumb src={item.image_url} size={thumbSize} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#fff",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.25,
        }}>
          {name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          {weight ? <PackSizeChip size={weight} stacked /> : null}
          <span style={{ fontSize: 11, fontWeight: 600, color: "#888" }}>
            Qty {item.quantity}
          </span>
        </div>
      </div>
      <span style={{ marginLeft: 8, flexShrink: 0 }}>
        <RupeeAmount amount={lineTotal} size={14} mobile={mobile} />
      </span>
    </div>
  );
}

function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return "";
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "new", label: "New" },
  { id: "preparing", label: "Preparing Food" },
  { id: "awaiting", label: "Ready" },
  { id: "dispatched", label: "Dispatch" },
  { id: "completed", label: "Complete" },
  { id: "cancelled", label: "Cancelled" },
];

type Props = {
  orders: DashboardOrder[];
  loading: boolean;
  highlightOrderId: string | null;
  onActionDone: () => void;
  mobile?: boolean;
  allowedTabs?: DashboardTab[];
  defaultTab?: DashboardTab;
  hideTabs?: boolean;
  simplified?: boolean;
  activeTab?: DashboardTab;
  onTabChange?: (tab: DashboardTab) => void;
};

const MODAL_CLOSE_BTN_CSS = `
  .vk-modal-close-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: #2a2a2a;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease, transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  .vk-modal-close-btn:hover {
    background: #333;
    color: #ddd;
  }
  .vk-modal-close-btn:active {
    transform: scale(0.92);
  }
  .vk-modal-close-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .vk-modal-close-btn:hover .vk-modal-close-icon {
    transform: rotate(90deg);
  }
`;

function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="vk-modal-close-btn" aria-label="Close">
      <span className="vk-modal-close-icon">
        <X size={18} />
      </span>
    </button>
  );
}

// ─── Order Details Modal (Dark Theme) ────────────────────────────────────────
function OrderDetailsModal({
  order,
  onClose,
}: {
  order: DashboardOrder;
  onClose: () => void;
}) {
  const mealType = mealTypeLabel(order.delivery_slot_kind);
  const chipStyle = mealChipStyle(order.delivery_slot_kind);

  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    <>
      <div onClick={handleClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000, animation: closing ? "modalFadeOut 0.25s ease forwards" : "modalFadeIn 0.18s ease" }} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(480px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "20px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          zIndex: 1001,
          fontFamily: FONT,
          animation: closing ? "modalSlideDown 0.25s cubic-bezier(0.4, 0, 1, 1) forwards" : "modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0", marginBottom: "16px", flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
              {`Order ${shortOrderId(order.id, order.order_number)}`}
            </h3>
            {mealType ? (
              <div style={{ marginTop: 6 }}>
                <MealChip label={mealType} style={chipStyle} />
              </div>
            ) : null}
          </div>
          <ModalCloseButton onClick={handleClose} />
        </div>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 20px" }}>
          <OrderDetailContent order={order} mobile={false} />
        </div>
      </div>
      <style>{MODAL_CLOSE_BTN_CSS}{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) scale(0.97); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes modalSlideDown { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) scale(0.97); } }
      `}</style>
    </>
  );
}

// ─── Order Bottom Sheet (Mobile) ─────────────────────────────────────────────
function OrderBottomSheet({
  order,
  onClose,
  busy,
  onAccept,
  onReject,
  onFoodReady,
  onCollected,
  onDelivered,
}: {
  order: DashboardOrder;
  onClose: () => void;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onFoodReady: () => void;
  onCollected: () => void;
  onDelivered: () => void;
}) {
  const status = normalizeOrderStatus(order.status);
  const mealType = mealTypeLabel(order.delivery_slot_kind);
  const chipStyle = mealChipStyle(order.delivery_slot_kind);

  const isPaid = status === OrderStatus.PAID;
  const isPreparing = status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING;
  const isAwaiting = status === OrderStatus.READY;
  const isDispatched = status === OrderStatus.OUT_FOR_DELIVERY;
  const isDelivered = status === OrderStatus.DELIVERED;
  const isCancelled = status === OrderStatus.REJECTED || status === OrderStatus.CANCELLED;
  const showActions = !isDelivered && !isCancelled;

  const [closing, setClosing] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  return (
    <>
      <div onClick={handleClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000, animation: closing ? "bsFadeOut 0.3s ease forwards" : "bsFadeIn 0.25s ease" }} />
      <div
        className="no-scrollbar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1001,
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
          background: "#1a1a1a",
          borderRadius: "20px 20px 0 0",
          border: "1px solid #2a2a2a",
          borderBottom: "none",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
          fontFamily: FONT,
          animation: closing ? "bsSlideDown 0.3s cubic-bezier(0.4, 0, 1, 1) forwards" : "bsSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Drag handle */}
        <div onClick={handleClose} style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0, cursor: "pointer" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "4px", background: "#444" }} />
        </div>

        {/* Scrollable content */}
        <div className="no-scrollbar vk-order-sheet-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#fff" }}>
                {`Order ${shortOrderId(order.id, order.order_number)}`}
              </h3>
              {mealType ? (
                <div style={{ marginTop: 4 }}>
                  <MealChip label={mealType} style={chipStyle} />
                </div>
              ) : null}
            </div>
            <ModalCloseButton onClick={handleClose} />
          </div>

          <OrderDetailContent order={order} mobile />
        </div>

        {showActions && (
          <div style={{ flexShrink: 0, padding: "12px 20px 0", borderTop: "1px solid #2a2a2a", display: "flex", gap: "10px" }}>
            {isPaid && (
              <>
                <button type="button" disabled={busy} onClick={onReject} className="vk-order-btn vk-order-btn-reject" style={{ flex: 1, height: "48px", borderRadius: "12px", border: "1.5px solid rgba(239,68,68,0.3)", background: "transparent", color: "#EF4444", fontSize: "16px", fontWeight: 500, cursor: busy ? "wait" : "pointer", fontFamily: FONT }}>{busy ? "..." : "Reject"}</button>
                <button type="button" disabled={busy} onClick={onAccept} className="vk-order-btn vk-order-btn-accept" style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "16px", fontWeight: 500, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Accepting..." : "Accept"}</button>
              </>
            )}
            {isPreparing && (
              <button type="button" disabled={busy} onClick={onFoodReady} className="vk-order-btn vk-order-btn-yellow" style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "16px", fontWeight: 500, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Working..." : "Food Ready"}</button>
            )}
            {isAwaiting && (
              <button type="button" disabled={busy} onClick={onCollected} className="vk-order-btn vk-order-btn-yellow" style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "16px", fontWeight: 500, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Working..." : "Dispatch"}</button>
            )}
            {isDispatched && (
              <button type="button" disabled={busy} onClick={onDelivered} className="vk-order-btn vk-order-btn-yellow" style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "16px", fontWeight: 500, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Working..." : "Mark Delivered"}</button>
            )}
          </div>
        )}
      </div>
      <style>{MODAL_CLOSE_BTN_CSS}{`
        @keyframes bsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bsFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes bsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes bsSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
      `}</style>
    </>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────
export function DashboardOrderBoard({
  orders,
  loading,
  highlightOrderId,
  onActionDone,
  mobile = false,
  allowedTabs,
  defaultTab,
  hideTabs = false,
  simplified = false,
  activeTab,
  onTabChange,
}: Props) {
  const [localTab, setLocalTab] = useState<DashboardTab>(
    defaultTab || (allowedTabs && allowedTabs.length > 0 ? allowedTabs[0] : "new")
  );
  const tab = activeTab !== undefined ? activeTab : localTab;
  const setTab = onTabChange || setLocalTab;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<DashboardOrder | null>(null);

  const visibleTabs = useMemo(() => {
    if (!allowedTabs) return TABS;
    return allowedTabs
      .map((id) => TABS.find((t) => t.id === id))
      .filter((t): t is typeof TABS[number] => !!t);
  }, [allowedTabs]);

  const grouped = useMemo(() => {
    const g: Record<DashboardTab, DashboardOrder[]> = {
      new: [],
      preparing: [],
      awaiting: [],
      dispatched: [],
      completed: [],
      cancelled: [],
    };
    for (const o of orders) g[tabForOrder(o.status)].push(o);
    return g;
  }, [orders]);

  const list = useMemo(() => {
    if (!hideTabs || activeTab !== undefined) {
      return grouped[tab];
    }
    if (allowedTabs) {
      return orders.filter((o) => allowedTabs.includes(tabForOrder(o.status)));
    }
    return orders;
  }, [hideTabs, allowedTabs, orders, grouped, tab, activeTab]);

  const runAccept = async (orderId: string) => {
    setBusyId(orderId);
    const r1 = await transitionOrderStatus(orderId, OrderStatus.CONFIRMED);
    if (!r1.ok) {
      alert(r1.error);
      setBusyId(null);
      return;
    }
    await transitionOrderStatus(orderId, OrderStatus.PREPARING);
    setBusyId(null);
    onActionDone();
  };

  const runReject = async (orderId: string) => {
    if (!window.confirm("Reject this order? A full refund will be initiated.")) return;
    setBusyId(orderId);
    const r = await transitionOrderStatus(orderId, OrderStatus.REJECTED);
    if (!r.ok) alert(r.error);
    setBusyId(null);
    onActionDone();
  };

  const runFoodReady = async (orderId: string) => {
    setBusyId(orderId);
    const r = await transitionOrderStatus(orderId, OrderStatus.READY);
    if (!r.ok) alert(r.error);
    setBusyId(null);
    onActionDone();
  };

  const [dispatchOrderId, setDispatchOrderId] = useState<string | null>(null);

  const runCollected = (orderId: string) => {
    setDispatchOrderId(orderId);
  };

  const confirmDispatch = async (orderId: string, driverPhone: string) => {
    setBusyId(orderId);
    setDispatchOrderId(null);
    try {
      await fetch("/api/orders/assign-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, driverPhone }),
      });
    } catch (e) {
      console.error("[dispatch] WhatsApp send failed", e);
    }
    const r = await transitionOrderStatus(orderId, OrderStatus.OUT_FOR_DELIVERY);
    if (!r.ok) alert(r.error);
    setBusyId(null);
    onActionDone();
  };

  const runDelivered = async (orderId: string) => {
    setBusyId(orderId);
    const r = await transitionOrderStatus(orderId, OrderStatus.DELIVERED);
    if (!r.ok) alert(r.error);
    setBusyId(null);
    onActionDone();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        fontFamily: FONT,
        padding: mobile ? "12px 16px 0" : "20px",
      }}
    >
      {!hideTabs && (
        <div
          className="no-scrollbar"
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "24px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "4px",
            alignItems: "center",
          }}
        >
          {visibleTabs.map(({ id, label }) => {
            const count = grouped[id].length;
            const active = tab === id;
            const hasItems = count > 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  height: "38px",
                  padding: "0 14px",
                  borderRadius: "10px",
                  background: active ? YELLOW : "#181818",
                  color: active ? "#111" : "#888",
                  fontSize: "13px",
                  fontWeight: 700,
                  fontFamily: FONT,
                  cursor: "pointer",
                  boxShadow: active ? `0 4px 14px ${YELLOW}30` : "none",
                  transition: "all 0.2s ease",
                  border: active ? "none" : "1px solid #252525",
                }}
              >
                {label}
                <span
                  style={{
                    minWidth: "18px",
                    height: "18px",
                    padding: "0 5px",
                    borderRadius: "5px",
                    background: active ? "rgba(0,0,0,0.15)" : hasItems ? "#252525" : "#1e1e1e",
                    color: active ? "#111" : hasItems ? "#aaa" : "#555",
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Grid Scroll Area */}
      <div
        className="no-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          ...(mobile
            ? { paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }
            : {}),
        }}
      >
        {loading ? (
          <DashboardSpinner minHeight="100%" />
        ) : list.length === 0 ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", boxSizing: "border-box" }}>
            <PackageOpen size={56} color="#FACC15" strokeWidth={1.2} style={{ marginBottom: "16px" }} />
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#666" }}>No orders in this stage</p>
          </div>
        ) : (
          <>
            <ul
              className={mobile ? "vk-order-grid-mobile" : "vk-order-grid"}
            >
              {list.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  highlighted={highlightOrderId === order.id}
                  busy={busyId === order.id}
                  onAccept={() => void runAccept(order.id)}
                  onReject={() => void runReject(order.id)}
                  onFoodReady={() => void runFoodReady(order.id)}
                  onCollected={() => void runCollected(order.id)}
                  onDelivered={() => void runDelivered(order.id)}
                  onShowDetails={() => setDetailOrder(order)}
                  mobile={mobile}
                  simplified={simplified}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Details Modal / Bottom Sheet */}
      {detailOrder && (
        mobile ? (
          <OrderBottomSheet
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
            busy={busyId === detailOrder.id}
            onAccept={() => void runAccept(detailOrder.id)}
            onReject={() => void runReject(detailOrder.id)}
            onFoodReady={() => void runFoodReady(detailOrder.id)}
            onCollected={() => void runCollected(detailOrder.id)}
            onDelivered={() => void runDelivered(detailOrder.id)}
          />
        ) : (
          <OrderDetailsModal
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
          />
        )
      )}

      <style>{ORDER_BTN_HOVER_CSS}</style>

      {/* Driver Picker Modal */}
      {dispatchOrderId && (
        <DriverPickerModal
          orderId={dispatchOrderId}
          onClose={() => setDispatchOrderId(null)}
          onConfirm={(driverPhone) => void confirmDispatch(dispatchOrderId, driverPhone)}
        />
      )}
    </div>
  );
}

// ─── Order Card (reference layout) ───────────────────────────────────────────
const MAX_VISIBLE_ITEMS = 1;
const CARD_PAD = "clamp(16px, 2vw, 22px)";

function MealChip({ label, style }: { label: string; style: { bg: string; color: string; border: string } }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 12px",
      borderRadius: "8px",
      background: style.bg,
      border: `1px solid ${style.border}`,
      color: style.color,
      fontSize: "12px",
      fontWeight: 800,
      letterSpacing: "0.2px",
      flexShrink: 0,
      lineHeight: 1,
    }}>
      {label}
    </span>
  );
}

const DETAIL_BOX: CSSProperties = {
  background: "#222",
  borderRadius: "12px",
  padding: "12px 14px",
  border: "1px solid #2a2a2a",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: 0,
};

const DETAIL_TEXT: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const COPY_POPPER_CSS = `
  @keyframes vkCopyTooltipIn {
    from { opacity: 0; transform: translateY(5px) scale(0.8); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes vkCopyTooltipOut {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to { opacity: 0; transform: translateY(-4px) scale(0.88); }
  }
  @keyframes vkCopyPopBurst {
    0% { transform: scale(0.35); opacity: 0.85; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes vkCopyPopBurst2 {
    0% { transform: scale(0.5); opacity: 0.55; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  @keyframes vkCopyTickIn {
    from { transform: scale(0.35); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .vk-copy-tooltip-in {
    animation: vkCopyTooltipIn 0.26s cubic-bezier(0.34, 1.5, 0.64, 1) forwards;
  }
  .vk-copy-tooltip-out {
    animation: vkCopyTooltipOut 0.18s cubic-bezier(0.4, 0, 1, 1) forwards;
  }
  .vk-copy-pop-burst {
    animation: vkCopyPopBurst 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .vk-copy-pop-burst-2 {
    animation: vkCopyPopBurst2 0.45s 0.06s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .vk-copy-tick-in {
    animation: vkCopyTickIn 0.22s cubic-bezier(0.34, 1.5, 0.64, 1) forwards;
  }
`;

function CopyPhoneButton({ phone }: { phone: string | null }) {
  const toast = useToast();
  const [popperPhase, setPopperPhase] = useState<"idle" | "in" | "out">("idle");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const schedule = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  const copyPhone = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const displayed = formatPhoneDisplay(phone);
    if (!phone?.trim() || displayed === "—") return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const toCopy = displayed.replace(/\s/g, "");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(toCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = toCopy;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setPopperPhase("in");
      schedule(() => setPopperPhase("out"), 1200);
      schedule(() => setPopperPhase("idle"), 1400);
    } catch {
      toast.show("Could not copy phone number", "error");
    }
  };

  if (!phone?.trim() || formatPhoneDisplay(phone) === "—") return null;

  const copied = popperPhase !== "idle";

  return (
    <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0, zIndex: copied ? 5 : undefined }}>
      {copied && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span
              aria-hidden
              className="vk-copy-pop-burst"
              style={{
                position: "absolute",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${YELLOW}70 0%, ${YELLOW}20 45%, transparent 70%)`,
                pointerEvents: "none",
              }}
            />
            <span
              aria-hidden
              className="vk-copy-pop-burst-2"
              style={{
                position: "absolute",
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: `2px solid ${YELLOW}`,
                pointerEvents: "none",
              }}
            />
            <div
              role="status"
              aria-live="polite"
              className={popperPhase === "out" ? "vk-copy-tooltip-out" : "vk-copy-tooltip-in"}
              style={{
                position: "relative",
                zIndex: 1,
                padding: "4px 9px",
                borderRadius: "7px",
                background: YELLOW,
                color: "#111",
                fontSize: "10px",
                fontWeight: 900,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                boxShadow: `0 3px 12px rgba(0,0,0,0.4), 0 0 0 1px ${YELLOW}40`,
                fontFamily: FONT,
                lineHeight: 1.1,
              }}
            >
              Copied
            </div>
          </div>
          <span
            aria-hidden
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `5px solid ${YELLOW}`,
              marginTop: "-1px",
            }}
          />
        </div>
      )}
      <button
        type="button"
        onClick={(e) => void copyPhone(e)}
        aria-label={copied ? "Phone number copied" : "Copy phone number"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          borderRadius: "8px",
          border: copied ? `1px solid ${YELLOW}40` : "none",
          background: copied ? `${YELLOW}18` : "rgba(255,255,255,0.05)",
          color: copied ? YELLOW : "#888",
          cursor: "pointer",
          padding: 0,
          transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {copied ? (
          <Check size={15} strokeWidth={2.75} className="vk-copy-tick-in" />
        ) : (
          <Copy size={14} strokeWidth={2} />
        )}
      </button>
      <style>{COPY_POPPER_CSS}</style>
    </div>
  );
}

function CustomerDetailsCard({
  name,
  phone,
  slotLine,
}: {
  name: string;
  phone: string | null;
  slotLine: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", overflow: "visible" }}>
      <div style={{ display: "flex", gap: "8px", width: "100%", overflow: "visible" }}>
        <div style={{ ...DETAIL_BOX, flex: 1 }}>
          <User size={16} color={YELLOW} strokeWidth={2.25} style={{ flexShrink: 0 }} />
          <span style={DETAIL_TEXT}>{name}</span>
        </div>
        <div style={{ ...DETAIL_BOX, flex: 1, position: "relative", overflow: "visible" }}>
          <Phone size={16} color={YELLOW} strokeWidth={2.25} style={{ flexShrink: 0 }} />
          <span style={{ ...DETAIL_TEXT, flex: 1, minWidth: 0 }}>{formatPhoneDisplay(phone)}</span>
          <CopyPhoneButton phone={phone} />
        </div>
      </div>
      {slotLine ? (
        <div style={{
          ...DETAIL_BOX,
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 14px",
          background: `${YELLOW}10`,
          border: `1px solid ${YELLOW}28`,
        }}>
          <Clock size={15} color={YELLOW} strokeWidth={2.25} style={{ flexShrink: 0 }} />
          <span style={DETAIL_TEXT}>{slotLine}</span>
        </div>
      ) : null}
    </div>
  );
}

const BILL_PAPER = "#faf6ed";
const BILL_INK = "#2a2a2a";
const BILL_MUTED = "#6b6b6b";

const SECTION_LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#666",
  letterSpacing: "0.6px",
  textTransform: "uppercase",
  fontFamily: FONT,
  lineHeight: 1,
};

function zigZagSvg(color: string, flip: boolean) {
  const d = flip ? "M0 0 L8 8 L16 0 Z" : "M0 8 L8 0 L16 8 Z";
  return encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8" viewBox="0 0 16 8"><path d="${d}" fill="${color}"/></svg>`,
  );
}

const BILL_ZIGZAG_TOP = `url("data:image/svg+xml,${zigZagSvg(BILL_PAPER, false)}")`;
const BILL_ZIGZAG_BOTTOM = `url("data:image/svg+xml,${zigZagSvg(BILL_PAPER, true)}")`;

const BILL_RECEIPT_CSS = `
  .vk-bill-receipt {
    padding: 8px 0;
    overflow: hidden;
  }
  .vk-bill-paper {
    position: relative;
    background: ${BILL_PAPER};
    padding: 16px 18px 14px;
    color: ${BILL_INK};
  }
  .vk-bill-paper::before,
  .vk-bill-paper::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    background-repeat: repeat-x;
    background-size: 16px 8px;
    pointer-events: none;
  }
  .vk-bill-paper::before {
    top: -8px;
    background-image: ${BILL_ZIGZAG_TOP};
  }
  .vk-bill-paper::after {
    bottom: -8px;
    background-image: ${BILL_ZIGZAG_BOTTOM};
  }
`;

function BillRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      fontSize: bold ? 14 : 13,
      fontWeight: bold ? 800 : 600,
      color: bold ? BILL_INK : BILL_MUTED,
      fontFamily: FONT,
    }}>
      <span>{label}</span>
      <span style={{ color: BILL_INK, fontWeight: bold ? 800 : 700 }}>{value}</span>
    </div>
  );
}

function OrderBillReceipt({ order }: { order: DashboardOrder }) {
  const items = order.items || [];
  const itemsSubtotal = orderItemsSubtotal(items);
  const breakdown = computeOrderBreakdownFromItemSubtotal(itemsSubtotal);
  const totalPaid = getOrderDisplayTotal(order);
  const adjustment = Math.round(totalPaid - breakdown.computedTotal);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ ...SECTION_LABEL, marginBottom: 10 }}>
        Bill
      </div>
      <div className="vk-bill-receipt">
        <div
          className="vk-bill-paper"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <BillRow label="Items subtotal" value={`₹${Math.round(breakdown.itemsSubtotal)}`} />
          <BillRow label="Packaging" value={`₹${breakdown.packaging}`} />
          <BillRow label="Delivery" value={`₹${breakdown.delivery}`} />
          <BillRow label="GST (5%)" value={`₹${breakdown.gst}`} />
          {adjustment !== 0 ? (
            <BillRow label="Adjustments" value={`₹${adjustment}`} />
          ) : null}
          <div style={{ borderTop: `1px dashed ${BILL_MUTED}55`, marginTop: 4, paddingTop: 12 }}>
            <BillRow label="Total paid" value={`₹${totalPaid}`} bold />
          </div>
        </div>
      </div>
      <style>{BILL_RECEIPT_CSS}</style>
    </div>
  );
}

function OrderDetailContent({ order, mobile = false }: { order: DashboardOrder; mobile?: boolean }) {
  const deliveryLine = formatExpectedDeliverySlot(order.delivery_slot) || formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);
  const items = order.items || [];
  const scrollItems = items.length > 2;

  return (
    <>
      <CustomerDetailsCard
        name={customerDisplayLabel(order)}
        phone={order.phone_number}
        slotLine={deliveryLine || ""}
      />
      <div style={{ margin: "18px 0 10px", borderTop: "1px solid #2a2a2a" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={SECTION_LABEL}>Items{items.length > 0 ? ` (${items.length})` : ""}</span>
        <span style={SECTION_LABEL}>Amount</span>
      </div>
      <div
        className={scrollItems ? "no-scrollbar vk-order-items-scroll" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 8,
          ...(scrollItems ? {
            maxHeight: mobile ? "min(240px, 36dvh)" : "min(280px, 42vh)",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            paddingRight: 2,
            marginRight: -2,
          } : {}),
        }}
      >
        {items.length === 0 ? (
          <p style={{ color: "#666", fontSize: 13, margin: 0, textAlign: "center", padding: "12px 0" }}>No items found</p>
        ) : items.map((it, idx) => (
          <OrderItemRow key={idx} item={it} mobile={mobile} />
        ))}
      </div>
      <OrderBillReceipt order={order} />
      {scrollItems ? (
        <style>{`
          .vk-order-items-scroll {
            mask-image: linear-gradient(to bottom, #000 0%, #000 88%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 88%, transparent 100%);
          }
        `}</style>
      ) : null}
    </>
  );
}

function StatusActionButton({
  label,
  color,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  color: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        minWidth: "120px",
        height: "44px",
        padding: "0 14px",
        borderRadius: "10px",
        border: `1.5px solid ${color}40`,
        background: `${color}10`,
        color,
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.4px",
        cursor: disabled ? "wait" : onClick ? "pointer" : "default",
        fontFamily: FONT,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function OrderCard({
  order,
  highlighted,
  busy,
  onAccept,
  onReject,
  onFoodReady,
  onCollected,
  onDelivered,
  onShowDetails,
  mobile,
  simplified = false,
}: {
  order: DashboardOrder;
  highlighted: boolean;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onFoodReady: () => void;
  onCollected: () => void;
  onDelivered: () => void;
  onShowDetails: () => void;
  mobile: boolean;
  simplified?: boolean;
}) {
  const status = normalizeOrderStatus(order.status);
  const isPaid = status === OrderStatus.PAID;
  const isPreparing = status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING;
  const isAwaiting = status === OrderStatus.READY;
  const isDispatched = status === OrderStatus.OUT_FOR_DELIVERY;
  const isDelivered = status === OrderStatus.DELIVERED;
  const isCancelled = status === OrderStatus.REJECTED || status === OrderStatus.CANCELLED;

  const items = order.items || [];
  const hiddenItemCount = Math.max(0, items.length - MAX_VISIBLE_ITEMS);
  const totalAmount = getOrderDisplayTotal(order);
  const showActions = !isDelivered && !isCancelled;

  const mealType = mealTypeLabel(order.delivery_slot_kind);
  const chipStyle = mealChipStyle(order.delivery_slot_kind);
  const orderLabel = `Order ${shortOrderId(order.id, order.order_number)}`;

  const footerActions = (() => {
    if (isDelivered) {
      return (
        <StatusActionButton
          label="DELIVERED"
          color="#34D399"
          icon={<Check size={14} strokeWidth={3} />}
        />
      );
    }
    if (isCancelled) {
      return (
        <StatusActionButton
          label="REJECTED"
          color="#F87171"
          icon={<X size={14} strokeWidth={3} />}
        />
      );
    }
    if (!showActions) return null;

    if (isPaid) {
      return (
        <div className="vk-order-card-actions">
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="vk-order-btn vk-order-btn-reject"
            style={{
              height: "44px",
              borderRadius: "10px",
              border: "1.5px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.08)",
              color: "#EF4444",
              fontSize: "14px",
              fontWeight: 500,
              cursor: busy ? "wait" : "pointer",
              fontFamily: FONT,
              opacity: busy ? 0.6 : 1,
              boxSizing: "border-box",
            }}
          >
            {busy ? "…" : "Reject"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="vk-order-btn vk-order-btn-accept"
            style={{
              height: "44px",
              borderRadius: "10px",
              border: "none",
              background: YELLOW,
              color: "#111",
              fontSize: "14px",
              fontWeight: 500,
              cursor: busy ? "wait" : "pointer",
              fontFamily: FONT,
              boxShadow: `0 4px 14px ${YELLOW}25`,
              opacity: busy ? 0.6 : 1,
              boxSizing: "border-box",
            }}
          >
            {busy ? "…" : "Accept"}
          </button>
        </div>
      );
    }

    const singleAction = isPreparing
      ? { label: busy ? "…" : "Food Ready", onClick: onFoodReady }
      : isAwaiting
        ? { label: busy ? "…" : "Dispatch", onClick: onCollected }
        : isDispatched
          ? { label: busy ? "…" : "Delivered", onClick: onDelivered }
          : null;

    if (!singleAction) return null;

    return (
      <div className="vk-order-card-actions">
        <button
          type="button"
          disabled={busy}
          onClick={singleAction.onClick}
          className="vk-order-btn vk-order-btn-yellow"
          style={{
            height: "44px",
            padding: "0 14px",
            borderRadius: "10px",
            border: "none",
            background: YELLOW,
            color: "#111",
            fontSize: "14px",
            fontWeight: 500,
            cursor: busy ? "wait" : "pointer",
            fontFamily: FONT,
            boxShadow: `0 4px 14px ${YELLOW}25`,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {singleAction.label}
        </button>
      </div>
    );
  })();

  const cardClass = [
    "vk-order-card",
    highlighted ? "vk-order-card-highlighted" : "",
  ].filter(Boolean).join(" ");

  return (
    <li
      id={`order-${order.id}`}
      className={cardClass}
      onClick={onShowDetails}
      style={{
        borderRadius: "18px",
        border: highlighted ? `2px solid ${YELLOW}` : "1px solid #2a2a2a",
        background: "#1a1a1a",
        padding: 0,
        boxShadow: highlighted
          ? `0 8px 32px ${YELLOW}20`
          : "0 4px 20px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        overflow: "visible",
        height: mobile ? undefined : "100%",
        fontFamily: FONT,
      }}
    >
      {/* Card header — order id + meal chip only */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "12px clamp(14px, 2vw, 18px)",
        background: "linear-gradient(180deg, #111 0%, #0d0d0d 100%)",
        borderBottom: "1px solid #2a2a2a",
        borderRadius: "18px 18px 0 0",
      }}>
        <span style={{
          fontSize: "16px",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.3px",
          whiteSpace: "nowrap",
        }}>
          {orderLabel}
        </span>
        {mealType ? <MealChip label={mealType} style={chipStyle} /> : null}
      </div>

      <div style={{
        padding: CARD_PAD,
        paddingTop: "clamp(12px, 1.5vw, 16px)",
        flex: mobile ? undefined : 1,
        display: "flex",
        flexDirection: "column",
      }}>

      {/* Items — first 1 + “+ N more”; spacer keeps equal card heights */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        flex: mobile ? undefined : 1,
        minHeight: !mobile && items.length > 0 ? DESKTOP_ITEMS_MIN_H : undefined,
      }}>
        {items.length === 0 ? (
          <span style={{ fontSize: "13px", color: "#555", fontStyle: "italic", padding: "8px 0" }}>No items</span>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.slice(0, MAX_VISIBLE_ITEMS).map((item, idx) => (
                <OrderItemRow key={idx} item={item} mobile={mobile} />
              ))}
            </div>
            {hiddenItemCount > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails();
                }}
                className="vk-order-view-items"
                style={{
                  marginTop: 8,
                  padding: "6px 0 2px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: YELLOW,
                  fontFamily: FONT,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                + {hiddenItemCount} more
              </button>
            ) : !mobile ? (
              <div style={{ height: DESKTOP_MORE_ROW_H, marginTop: 8, flexShrink: 0 }} aria-hidden />
            ) : null}
          </>
        )}
      </div>

      {/* Footer — totals left, actions right (compact when cards are narrow) */}
      <div
        className="vk-order-card-footer"
        style={{
          marginTop: mobile ? "16px" : "auto",
          paddingTop: "4px",
          flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vk-order-card-footer-total">
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#888", marginBottom: "4px" }}>
            ×{items.length} Item{items.length !== 1 ? "s" : ""}
          </div>
          <div style={{ lineHeight: 1 }}>
            <RupeeAmount amount={totalAmount} size={22} mobile={mobile} cardTotal={!mobile} />
          </div>
        </div>
        {footerActions}
      </div>
      </div>
    </li>
  );
}

// ─── Dish Thumbnail ──────────────────────────────────────────────────────────
function squircleRadius(size: number) {
  return `${Math.round(size * 0.28)}px`;
}

function DishThumb({ src, size = 42, squircle = true }: { src?: string | null; size?: number; squircle?: boolean }) {
  const [broken, setBroken] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setBroken(false);
    setImgLoaded(false);
  }, [src]);

  const show = src && !broken;
  const radius = squircle ? squircleRadius(size) : "10px";

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      overflow: "hidden",
      flexShrink: 0,
      background: "#222",
      border: "1px solid #2a2a2a",
      position: "relative",
    }}>
      {show && !imgLoaded && (
        <div className="vk-dash-skeleton" style={{ position: "absolute", inset: 0, borderRadius: radius }} />
      )}
      {show ? (
        <img
          src={src}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setBroken(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingBag size={Math.round(size * 0.4)} style={{ color: "#444" }} />
        </div>
      )}
    </div>
  );
}

// ─── Driver Picker Modal ──────────────────────────────────────────────────────
function DriverPickerModal({ orderId, onClose, onConfirm }: { orderId: string; onClose: () => void; onConfirm: (phone: string) => void }) {
  const [drivers, setDrivers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    supabase.from("drivers").select("id, name, phone").eq("is_active", true).order("name").then(({ data }: { data: { id: string; name: string; phone: string }[] | null }) => {
      if (data) setDrivers(data);
      setLoading(false);
    });
  }, []);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: "16px", border: "1px solid #2a2a2a", padding: "24px", width: "100%", maxWidth: "380px", fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Truck size={20} style={{ color: YELLOW }} />
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" }}>Select Driver</h3>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "#666", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {loading ? (
          <DriverRowsSkeleton count={3} />
        ) : drivers.length === 0 ? (
          <p style={{ color: "#666", fontSize: "14px" }}>No drivers yet. Add them from the Drivers page.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {drivers.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelected(d.phone)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px", borderRadius: "12px",
                  background: selected === d.phone ? `${YELLOW}15` : "#222",
                  border: selected === d.phone ? `2px solid ${YELLOW}` : "1px solid #333",
                  cursor: "pointer", textAlign: "left", fontFamily: FONT,
                }}
              >
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: selected === d.phone ? YELLOW : "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Truck size={18} style={{ color: selected === d.phone ? "#111" : "#888" }} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{d.name}</div>
                  <div style={{ fontSize: "12px", color: "#888" }}>{d.phone}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={!selected}
          onClick={() => onConfirm(selected)}
          style={{
            width: "100%", height: "44px", borderRadius: "12px", border: "none",
            background: selected ? YELLOW : "#333", color: selected ? "#111" : "#666",
            fontSize: "14px", fontWeight: 800, cursor: selected ? "pointer" : "not-allowed",
            fontFamily: FONT, boxShadow: selected ? `0 4px 14px ${YELLOW}30` : "none",
          }}
        >
          {selected ? "Dispatch & Notify Driver" : "Select a driver"}
        </button>
      </div>
    </div>
  );
}
