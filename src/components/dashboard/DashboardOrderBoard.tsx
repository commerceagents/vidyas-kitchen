"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { PackageOpen, MapPin, User, Clock, X, ShoppingBag, Phone, Truck } from "lucide-react";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { useToast } from "@/components/dashboard/DashboardToast";
import { supabase } from "@/lib/supabase";
import {
  shortOrderId,
  tabForOrder,
  type DashboardOrder,
  type DashboardTab,
} from "@/lib/dashboard/orders";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const TIMER_MINUTES = 30;
const TIMER_WARN_MINUTES = 5;

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase());
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

function useCountdown(createdAt: string, enabled: boolean) {
  const [remaining, setRemaining] = useState(() => {
    if (!enabled) return -1;
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
    return Math.max(0, TIMER_MINUTES * 60 - elapsed);
  });

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
      setRemaining(Math.max(0, TIMER_MINUTES * 60 - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt, enabled]);

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const fraction = remaining / (TIMER_MINUTES * 60);
  const isLow = remaining > 0 && remaining <= TIMER_WARN_MINUTES * 60;
  const isExpired = remaining <= 0;

  return { remaining, minutes, seconds, fraction, isLow, isExpired };
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

// ─── Order Details Modal (Dark Theme) ────────────────────────────────────────
function OrderDetailsModal({
  order,
  onClose,
}: {
  order: DashboardOrder;
  onClose: () => void;
}) {
  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);
  const status = normalizeOrderStatus(order.status);
  const { statusText, statusColor } = getStatusMeta(status);

  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  return (
    <>
      <div onClick={handleClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000, animation: closing ? "modalFadeOut 0.25s ease forwards" : "modalFadeIn 0.18s ease" }} />
      <div className="no-scrollbar" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(480px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflowY: "auto", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "20px", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", zIndex: 1001, fontFamily: FONT, animation: closing ? "modalSlideDown 0.25s cubic-bezier(0.4, 0, 1, 1) forwards" : "modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>Order {shortOrderId(order.id)}</h3>
            <span style={{ display: "inline-block", marginTop: "6px", padding: "3px 10px", borderRadius: "8px", background: `${statusColor}15`, color: statusColor, fontSize: "11px", fontWeight: 800 }}>{statusText}</span>
          </div>
          <button type="button" onClick={handleClose} style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", background: "#2a2a2a", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={18} /></button>
        </div>
        <div style={{ margin: "0 20px 16px", padding: "14px", background: "#222", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {order.customer_name && <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}><User size={14} style={{ color: YELLOW, flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#fff" }}>{toTitleCase(order.customer_name)}</span></div>}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}><Phone size={14} style={{ color: YELLOW, flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#ccc" }}>{order.phone_number || "—"}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}><Clock size={14} style={{ color: YELLOW, flexShrink: 0 }} /><span style={{ color: "#999" }}>{slotLine || "Immediate"}</span></div>
        </div>
        <hr style={{ border: "none", borderTop: "1px solid #2a2a2a", margin: "0 20px 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 20px", marginBottom: "10px", fontSize: "11px", fontWeight: 800, color: "#666", letterSpacing: "0.6px" }}><span>Item</span><span>Amount</span></div>
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          {(order.items || []).length === 0 ? (
            <p style={{ color: "#666", fontSize: "13px", margin: 0, textAlign: "center", padding: "12px 0" }}>No items found</p>
          ) : (order.items || []).map((it, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#222", borderRadius: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <DishThumb src={it.image_url} size={38} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{toTitleCase(it.name)}</div>
                  <div style={{ fontSize: "11px", color: "#888", fontWeight: 600, marginTop: "1px" }}>Qty {it.quantity} × ₹{(it.unit_price || 0).toFixed(0)}</div>
                </div>
              </div>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>₹{((it.unit_price || 0) * it.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 20px 20px", padding: "14px 0", borderTop: "1px solid #2a2a2a" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#888" }}>Total Amount</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "#fff" }}>₹{(order.total_amount || 0).toFixed(0)}</span>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) scale(0.97); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes modalSlideDown { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) scale(0.97); } }
      `}</style>
    </>
  );
}

function getStatusMeta(status: string) {
  if (status === OrderStatus.PAID) return { statusText: "Pending", statusColor: "#F5A623" };
  if (status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING) return { statusText: "Preparing", statusColor: "#A78BFA" };
  if (status === OrderStatus.READY) return { statusText: "Ready", statusColor: "#34D399" };
  if (status === OrderStatus.OUT_FOR_DELIVERY) return { statusText: "Dispatched", statusColor: "#FB923C" };
  if (status === OrderStatus.DELIVERED) return { statusText: "Delivered", statusColor: "#38BDF8" };
  if (status === OrderStatus.REJECTED || status === OrderStatus.CANCELLED) return { statusText: "Cancelled", statusColor: "#F87171" };
  return { statusText: "Unknown", statusColor: "#888" };
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
  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);
  const status = normalizeOrderStatus(order.status);
  const { statusText, statusColor } = getStatusMeta(status);

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
        <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#fff" }}>Order {shortOrderId(order.id)}</h3>
              <span style={{ display: "inline-block", marginTop: "4px", padding: "3px 10px", borderRadius: "8px", background: `${statusColor}15`, color: statusColor, fontSize: "11px", fontWeight: 800 }}>{statusText}</span>
            </div>
            <button type="button" onClick={handleClose} style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", background: "#2a2a2a", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={18} /></button>
          </div>

          {/* Customer */}
          <div style={{ padding: "12px", background: "#222", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            {order.customer_name && <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}><User size={14} style={{ color: YELLOW, flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#fff" }}>{toTitleCase(order.customer_name)}</span></div>}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}><Phone size={14} style={{ color: YELLOW, flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#ccc" }}>{order.phone_number || "—"}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}><Clock size={14} style={{ color: YELLOW, flexShrink: 0 }} /><span style={{ color: "#999" }}>{slotLine || "Immediate"}</span></div>
          </div>

          {/* Items */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "11px", fontWeight: 800, color: "#666", letterSpacing: "0.6px" }}><span>Item</span><span>Amount</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            {(order.items || []).length === 0 ? (
              <p style={{ color: "#666", fontSize: "13px", margin: 0, textAlign: "center", padding: "12px 0" }}>No items found</p>
            ) : (order.items || []).map((it, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#222", borderRadius: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <DishThumb src={it.image_url} size={38} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{toTitleCase(it.name)}</div>
                    <div style={{ fontSize: "11px", color: "#888", fontWeight: 600, marginTop: "1px" }}>Qty {it.quantity} × ₹{(it.unit_price || 0).toFixed(0)}</div>
                  </div>
                </div>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>₹{((it.unit_price || 0) * it.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #2a2a2a" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#888" }}>Total Amount</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#fff" }}>₹{(order.total_amount || 0).toFixed(0)}</span>
          </div>
        </div>

        {/* Pinned action buttons */}
        {showActions && (
          <div style={{ flexShrink: 0, padding: "12px 20px 0", borderTop: "1px solid #2a2a2a", display: "flex", gap: "10px" }}>
            {isPaid && (
              <>
                <button type="button" disabled={busy} onClick={onReject} style={{ flex: 1, height: "48px", borderRadius: "12px", border: "1.5px solid rgba(239,68,68,0.3)", background: "transparent", color: "#EF4444", fontSize: "15px", fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT }}>{busy ? "..." : "Reject"}</button>
                <button type="button" disabled={busy} onClick={onAccept} style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "15px", fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Accepting..." : "Accept"}</button>
              </>
            )}
            {isPreparing && (
              <button type="button" disabled={busy} onClick={onFoodReady} style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "15px", fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Working..." : "Food Ready"}</button>
            )}
            {isAwaiting && (
              <button type="button" disabled={busy} onClick={onCollected} style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "15px", fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Working..." : "Dispatch"}</button>
            )}
            {isDispatched && (
              <button type="button" disabled={busy} onClick={onDelivered} style={{ flex: 1, height: "48px", borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: "15px", fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30` }}>{busy ? "Working..." : "Mark Delivered"}</button>
            )}
          </div>
        )}
      </div>
      <style>{`
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
        padding: mobile ? "12px 16px 90px" : "20px",
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
                  height: "40px",
                  padding: "0 16px",
                  borderRadius: "12px",
                  background: active ? "#ffffff" : "#1e1e1e",
                  color: active ? "#111111" : "#888888",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: FONT,
                  cursor: "pointer",
                  boxShadow: active ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                  transition: "all 0.2s ease",
                  border: active ? "1px solid transparent" : "1px solid #2a2a2a",
                }}
              >
                {label}
                <span
                  style={{
                    minWidth: "20px",
                    height: "20px",
                    padding: "0 6px",
                    borderRadius: "6px",
                    background: active ? "rgba(255,255,255,0.15)" : "#2a2a2a",
                    color: active ? "#111111" : "#666666",
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
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#666", padding: "40px 0" }}>Loading orders…</p>
        ) : list.length === 0 ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", boxSizing: "border-box" }}>
            <PackageOpen size={56} color="#FACC15" strokeWidth={1.2} style={{ marginBottom: "16px" }} />
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#666" }}>No orders in this stage</p>
          </div>
        ) : (
          <>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: "0 0 24px 0",
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(${mobile ? "100%" : "clamp(300px, 28vw, 380px)"}, 1fr))`,
                gap: "clamp(12px, 1.2vw, 16px)",
              }}
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

// ─── Order Card (compact) ─────────────────────────────────────────────────────
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

  const { statusText, statusColor } = getStatusMeta(status);
  const { minutes, seconds, fraction, isLow, isExpired } = useCountdown(order.created_at || "", isPaid);
  const toast = useToast();
  const warnedRef = useRef(false);

  useEffect(() => {
    if (isLow && !warnedRef.current) {
      warnedRef.current = true;
      toast.show(`Order ${shortOrderId(order.id)} — less than 5 min to accept!`, "warning");
    }
  }, [isLow, order.id, toast]);

  const items = order.items || [];
  const firstItem = items[0];
  const extraCount = items.length - 1;
  const totalAmount = order.total_amount || 0;

  const deliveryDateLabel = (() => {
    if (!order.delivery_slot) return "";
    const d = new Date(order.delivery_slot);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  })();

  const P = "clamp(10px, 1.4vw, 16px)";
  const BTN_H = "clamp(36px, 5vh, 44px)";
  const FS = (min: number, vh: number, max: number) => `clamp(${min}px, ${vh}vh, ${max}px)`;

  return (
    <li
      id={`order-${order.id}`}
      onClick={onShowDetails}
      style={{
        borderRadius: "16px",
        border: highlighted ? `2px solid ${YELLOW}` : isLow ? "2px solid #EF4444" : "1px solid #2a2a2a",
        background: "#1a1a1a",
        padding: 0,
        boxShadow: highlighted ? `0 8px 30px ${YELLOW}25` : isLow ? "0 4px 20px rgba(239,68,68,0.15)" : "0 2px 8px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.25s ease",
        cursor: "pointer",
        overflow: "hidden",
        animation: isLow ? "cardPulse 2s ease-in-out infinite" : undefined,
        fontFamily: FONT,
      }}
    >
      {/* ─── Header: Order ID + Status + Date ─── */}
      <div style={{ padding: `clamp(10px, 1.6vh, 16px) ${P} 0` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 1vw, 12px)" }}>
            <span style={{ fontSize: FS(15, 1.8, 17), fontWeight: 800, color: "#fff" }}>{shortOrderId(order.id)}</span>
            <span style={{ padding: "3px 10px", borderRadius: "6px", background: `${statusColor}15`, color: statusColor, fontSize: FS(11, 1.3, 12), fontWeight: 800 }}>{statusText}</span>
            {isPaid && !isExpired && (
              <CountdownRing fraction={fraction} minutes={minutes} seconds={seconds} isLow={isLow} />
            )}
          </div>
          {deliveryDateLabel && (
            <span style={{ fontSize: FS(10, 1.2, 12), color: "#888", fontWeight: 600, flexShrink: 0 }}>{deliveryDateLabel}</span>
          )}
        </div>
        {/* Customer row directly below */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "clamp(6px, 1vh, 10px)" }}>
          <span style={{ fontSize: FS(13, 1.6, 15), fontWeight: 700, color: "#ddd" }}>
            {toTitleCase(order.customer_name || "Customer")}
          </span>
          <span style={{ fontSize: FS(11, 1.3, 13), color: "#777", fontWeight: 600 }}>
            {order.phone_number || "—"}
          </span>
        </div>
      </div>

      {/* ─── Items: dark inset card ─── */}
      <div style={{ padding: `0 ${P}` }}>
        <div style={{ background: "#222", borderRadius: "12px", padding: `clamp(8px, 1.2vh, 12px) clamp(10px, 1.2vw, 14px)`, display: "flex", flexDirection: "column", gap: "clamp(6px, 1vh, 10px)" }}>
          {firstItem ? (
            <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 1vw, 12px)" }}>
              <DishThumb src={firstItem.image_url} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: FS(12, 1.5, 14), color: "#ccc", fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {firstItem.quantity}× {toTitleCase(firstItem.name)}
                </span>
              </div>
              <span style={{ fontSize: FS(12, 1.5, 14), color: "#999", fontWeight: 700, flexShrink: 0 }}>
                ₹{((firstItem.unit_price || 0) * firstItem.quantity).toFixed(0)}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: "13px", color: "#555" }}>No items</span>
          )}
          {extraCount > 0 && (
            <span style={{ fontSize: FS(10, 1.2, 12), color: YELLOW, fontWeight: 700 }}>+{extraCount} more item{extraCount > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* ─── Total row ─── */}
      <div style={{ padding: `clamp(8px, 1.2vh, 12px) ${P} 0`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: FS(12, 1.4, 14), color: "#666", fontWeight: 600 }}>Total</span>
        <span style={{ fontSize: FS(16, 2, 20), fontWeight: 800, color: "#fff" }}>₹{totalAmount.toFixed(0)}</span>
      </div>

      {/* ─── Actions ─── */}
      {!isDelivered && !isCancelled && (
        <div style={{ padding: `0 ${P} clamp(10px, 1.4vh, 16px)`, display: "flex", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
          {isPaid && (
            <>
              <button type="button" disabled={busy} onClick={onReject} style={{ flex: 1, height: BTN_H, borderRadius: "12px", border: "1.5px solid rgba(239,68,68,0.3)", background: "transparent", color: "#EF4444", fontSize: FS(12, 1.5, 14), fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, transition: "all 0.15s" }}>{busy ? "..." : "Reject"}</button>
              <button type="button" disabled={busy} onClick={onAccept} style={{ flex: 1, height: BTN_H, borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: FS(12, 1.5, 14), fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30`, transition: "all 0.15s" }}>{busy ? "..." : "Accept"}</button>
            </>
          )}
          {isPreparing && (
            <button type="button" disabled={busy} onClick={onFoodReady} style={{ flex: 1, height: BTN_H, borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: FS(12, 1.5, 14), fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30`, transition: "all 0.15s" }}>{busy ? "..." : "Food Ready"}</button>
          )}
          {isAwaiting && (
            <button type="button" disabled={busy} onClick={onCollected} style={{ flex: 1, height: BTN_H, borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: FS(12, 1.5, 14), fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30`, transition: "all 0.15s" }}>{busy ? "..." : "Dispatch"}</button>
          )}
          {isDispatched && (
            <button type="button" disabled={busy} onClick={onDelivered} style={{ flex: 1, height: BTN_H, borderRadius: "12px", border: "none", background: YELLOW, color: "#111", fontSize: FS(12, 1.5, 14), fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30`, transition: "all 0.15s" }}>{busy ? "..." : "Mark Delivered"}</button>
          )}
        </div>
      )}

      {(isDelivered || isCancelled) && <div style={{ height: "clamp(8px, 1vh, 14px)" }} />}

      <style>{`
        @keyframes cardPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50% { box-shadow: 0 0 16px 4px rgba(239,68,68,0.15); }
        }
      `}</style>
    </li>
  );
}

// ─── Dish Thumbnail ──────────────────────────────────────────────────────────
function DishThumb({ src, size = 34 }: { src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const show = src && !broken;
  return (
    <div style={{ width: size, height: size, borderRadius: "8px", overflow: "hidden", flexShrink: 0, background: "#2a2a2a" }}>
      {show ? (
        <img src={src} alt="" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingBag size={Math.round(size * 0.4)} style={{ color: "#555" }} />
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
          <p style={{ color: "#666", fontSize: "14px" }}>Loading drivers...</p>
        ) : drivers.length === 0 ? (
          <p style={{ color: "#666", fontSize: "14px" }}>No drivers found. Add drivers in Settings first.</p>
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

// ─── Countdown Ring (SVG) ─────────────────────────────────────────────────────
function CountdownRing({ fraction, minutes, seconds, isLow }: { fraction: number; minutes: number; seconds: number; isLow: boolean }) {
  const size = 38;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - fraction);
  const color = isLow ? "#EF4444" : YELLOW;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2a2a" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color, fontFamily: FONT, letterSpacing: "-0.3px" }}>
        {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
      </span>
    </div>
  );
}
