"use client";

import { useMemo, useState, useEffect } from "react";
import { PackageOpen, MapPin, User, Clock, X, ShoppingBag, Phone } from "lucide-react";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import { normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import {
  shortOrderId,
  tabForOrder,
  type DashboardOrder,
  type DashboardTab,
} from "@/lib/dashboard/orders";

const FONT = "var(--font-outfit), system-ui, sans-serif";

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

// ─── Order Details Modal ──────────────────────────────────────────────────────
function OrderDetailsModal({
  order,
  onClose,
}: {
  order: DashboardOrder;
  onClose: () => void;
}) {
  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);
  const status = normalizeOrderStatus(order.status);

  let statusText = "Pending";
  let statusBg = "rgba(245, 166, 35, 0.1)";
  let statusTextColor = "#F5A623";

  if (status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING) {
    statusText = "Preparing";
    statusBg = "rgba(17, 17, 17, 0.08)";
    statusTextColor = "#111111";
  } else if (status === OrderStatus.READY) {
    statusText = "Ready";
    statusBg = "rgba(40, 199, 111, 0.1)";
    statusTextColor = "#28C76F";
  } else if (status === OrderStatus.OUT_FOR_DELIVERY) {
    statusText = "Dispatched";
    statusBg = "rgba(255, 159, 67, 0.1)";
    statusTextColor = "#FF9F43";
  } else if (status === OrderStatus.DELIVERED) {
    statusText = "Delivered";
    statusBg = "rgba(40, 199, 111, 0.1)";
    statusTextColor = "#28C76F";
  } else if (status === OrderStatus.REJECTED || status === OrderStatus.CANCELLED) {
    statusText = "Cancelled";
    statusBg = "rgba(239, 68, 68, 0.08)";
    statusTextColor = "#EF4444";
  }

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 1000,
          animation: "fadeIn 0.18s ease",
        }}
      />

      {/* Modal Panel */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(480px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
          zIndex: 1001,
          fontFamily: FONT,
          animation: "slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 20px 0",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 800,
                color: "#111111",
                letterSpacing: "-0.3px",
              }}
            >
              Order {shortOrderId(order.id)}
            </h3>
            <span
              style={{
                display: "inline-block",
                marginTop: "6px",
                padding: "3px 10px",
                borderRadius: "20px",
                background: statusBg,
                color: statusTextColor,
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {statusText}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "none",
              background: "#F4F6F8",
              color: "#666",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Customer Info */}
        <div
          style={{
            margin: "0 20px 16px",
            padding: "14px",
            background: "#F9FAFB",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#555" }}>
            <Phone size={14} style={{ color: "#F5A623", flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: "#111" }}>{order.phone_number || "—"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#555" }}>
            <MapPin size={14} style={{ color: "#F5A623", flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>Delivery Address / Slot</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#555" }}>
            <Clock size={14} style={{ color: "#F5A623", flexShrink: 0 }} />
            <span>{slotLine || "Immediate"}</span>
          </div>
        </div>

        {/* Divider */}
        <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "0 20px 16px" }} />

        {/* Items Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 20px",
            marginBottom: "10px",
            fontSize: "11px",
            fontWeight: 800,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: "0.6px",
          }}
        >
          <span>Item</span>
          <span>Amount</span>
        </div>

        {/* Items List */}
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          {(order.items || []).length === 0 ? (
            <p style={{ color: "#aaa", fontSize: "13px", margin: 0, textAlign: "center", padding: "12px 0" }}>
              No items found
            </p>
          ) : (
            (order.items || []).map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "#F9FAFB",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(245,166,35,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ShoppingBag size={15} style={{ color: "#F5A623" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#111111" }}>{it.name}</div>
                    <div style={{ fontSize: "11px", color: "#888", fontWeight: 600, marginTop: "1px" }}>
                      Qty {it.quantity} × ₹{(it.unit_price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#111111" }}>
                  ₹{((it.unit_price || 0) * it.quantity).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Total Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "0 20px 20px",
            padding: "14px 0",
            borderTop: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#888888" }}>Total Amount</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "#111111" }}>
            ₹{(order.total_amount || 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Keyframe Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 24px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
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

  const runCollected = async (orderId: string) => {
    setBusyId(orderId);
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
        padding: mobile ? "0 16px 16px" : "20px",
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
                  borderRadius: "20px",
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
                    borderRadius: "999px",
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
          <div style={{ 
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            boxSizing: "border-box"
          }}>
            <PackageOpen 
              size={56} 
              color="#FACC15" 
              strokeWidth={1.2} 
              style={{ marginBottom: "16px" }} 
            />
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#666" }}>
              No orders in this stage
            </p>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "0 0 24px 0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
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
        )}
      </div>

      {/* Details Modal */}
      {detailOrder && (
        <OrderDetailsModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
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

  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);

  // Slot kind badge (Dinner / Lunch / etc.)
  const rawKind = order.delivery_slot_kind || "";
  const slotKindLabel = rawKind.charAt(0).toUpperCase() + rawKind.slice(1).toLowerCase();
  const slotKindBg = rawKind.toLowerCase() === "dinner"
    ? "rgba(99, 60, 180, 0.1)"
    : rawKind.toLowerCase() === "lunch"
    ? "rgba(245, 166, 35, 0.1)"
    : "rgba(0, 207, 221, 0.1)";
  const slotKindColor = rawKind.toLowerCase() === "dinner"
    ? "#7C3AED"
    : rawKind.toLowerCase() === "lunch"
    ? "#F5A623"
    : "#00CFDD";

  let statusText = "Pending";
  let statusBg = "rgba(245, 166, 35, 0.1)";
  let statusTextColor = "#F5A623";

  if (isPreparing) {
    statusText = "Preparing";
    statusBg = "rgba(17, 17, 17, 0.08)";
    statusTextColor = "#111111";
  } else if (isAwaiting) {
    statusText = "Ready";
    statusBg = "rgba(40, 199, 111, 0.1)";
    statusTextColor = "#28C76F";
  }

  return (
    <li
      id={`order-${order.id}`}
      style={{
        borderRadius: "14px",
        border: highlighted ? "2px solid #F5A623" : "1px solid #2a2a2a",
        background: "#1e1e1e",
        padding: "14px",
        boxShadow: highlighted ? "0 8px 30px rgba(245,166,35,0.15)" : "0 2px 8px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "all 0.25s ease",
      }}
    >
      {/* Header: Order ID + Slot Kind badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#ffffff" }}>
          Order {shortOrderId(order.id)}
        </h4>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Show slot kind (Dinner/Lunch) always if available */}
          {slotKindLabel && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "6px",
                background: slotKindBg,
                color: slotKindColor,
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {slotKindLabel}
            </span>
          )}
          {/* Show status badge only for non-dispatched states */}
          {!isDispatched && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "6px",
                background: statusBg,
                color: statusTextColor,
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {statusText}
            </span>
          )}
        </div>
      </div>

      {/* Info Row */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {order.customer_name && (
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff" }}>
            {order.customer_name}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
          <User size={13} style={{ color: "#555" }} />
          <span style={{ fontWeight: 600, color: "#888888" }}>{order.phone_number || "—"}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "7px" }}>
        {isPaid && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              style={{
                height: "34px",
                padding: "0 10px",
                borderRadius: "8px",
                border: "1.5px solid rgba(239,68,68,0.25)",
                background: "transparent",
                color: "#EF4444",
                fontSize: "12px",
                fontWeight: 700,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onAccept}
              style={{
                flex: 1,
                height: "34px",
                borderRadius: "8px",
                border: "none",
                background: "#F27A54",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 800,
                cursor: busy ? "wait" : "pointer",
                boxShadow: "0 4px 12px rgba(242,122,84,0.15)",
              }}
            >
              {busy ? "Accepting..." : "Accept"}
            </button>
          </>
        )}

        {isPreparing && (
          <button
            type="button"
            disabled={busy}
            onClick={onFoodReady}
            style={{
              flex: 1,
              height: "34px",
              borderRadius: "8px",
              border: "none",
              background: "#F5A623",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
              boxShadow: "0 4px 12px rgba(245,166,35,0.15)",
            }}
          >
            {busy ? "Working..." : "Food Ready"}
          </button>
        )}

        {isAwaiting && (
          <button
            type="button"
            disabled={busy}
            onClick={onCollected}
            style={{
              flex: 1,
              height: "34px",
              borderRadius: "8px",
              border: "none",
              background: "#111111",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            {busy ? "Working..." : "Dispatch"}
          </button>
        )}

        {isDispatched && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelivered}
            style={{
              flex: 1,
              height: "34px",
              borderRadius: "8px",
              border: "none",
              background: "#111111",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Working..." : "Mark Delivered"}
          </button>
        )}

        {/* Details Popup Button */}
        <button
          type="button"
          onClick={onShowDetails}
          style={{
            height: "34px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid rgba(0,0,0,0.07)",
            background: "#F4F6F8",
            color: "#555555",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.15s ease",
          }}
        >
          Details
        </button>
      </div>
    </li>
  );
}
