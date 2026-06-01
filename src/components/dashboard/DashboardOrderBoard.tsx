"use client";

import { useMemo, useState } from "react";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import { kitchenLabelForStatus, normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import {
  shortOrderId,
  tabForOrder,
  type DashboardOrder,
} from "@/lib/dashboard/orders";

const FONT = "var(--font-outfit), system-ui, sans-serif";

type Tab = "new" | "ongoing" | "completed";

const TABS: { id: Tab; label: string }[] = [
  { id: "new", label: "New" },
  { id: "ongoing", label: "Ongoing" },
  { id: "completed", label: "Done" },
];

type Props = {
  orders: DashboardOrder[];
  loading: boolean;
  highlightOrderId: string | null;
  onActionDone: () => void;
  mobile?: boolean;
};

export function DashboardOrderBoard({
  orders,
  loading,
  highlightOrderId,
  onActionDone,
  mobile = false,
}: Props) {
  const [tab, setTab] = useState<Tab>("new");
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<Tab, DashboardOrder[]> = { new: [], ongoing: [], completed: [] };
    for (const o of orders) g[tabForOrder(o.status)].push(o);
    return g;
  }, [orders]);

  const list = grouped[tab];

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
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "2px",
        }}
      >
        {TABS.map(({ id, label }) => {
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
                minHeight: "44px",
                padding: "0 16px",
                borderRadius: "12px",
                border: "none",
                background: active ? "#f5e32d" : "#1a1a1a",
                color: active ? "#000" : "#888",
                fontSize: "14px",
                fontWeight: 700,
                fontFamily: FONT,
                cursor: "pointer",
              }}
            >
              {label}
              <span
                style={{
                  minWidth: "22px",
                  height: "22px",
                  padding: "0 6px",
                  borderRadius: "999px",
                  background: active ? "rgba(0,0,0,0.12)" : "#222",
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#666", padding: "40px 0" }}>Loading orders…</p>
        ) : list.length === 0 ? (
          <div style={{ textAlign: "center", padding: mobile ? "48px 12px" : "64px 24px" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#666" }}>
              No {tab === "new" ? "new" : tab === "ongoing" ? "ongoing" : "completed"} orders this month
            </p>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
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
                mobile={mobile}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  highlighted,
  busy,
  onAccept,
  onReject,
  mobile,
}: {
  order: DashboardOrder;
  highlighted: boolean;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  mobile: boolean;
}) {
  const status = normalizeOrderStatus(order.status);
  const isPaid = status === OrderStatus.PAID;
  const slotLine = formatSlotLineForCustomer(order.delivery_slot, order.delivery_slot_kind);
  const itemSummary = order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") || "—";

  return (
    <li
      id={`order-${order.id}`}
      style={{
        borderRadius: mobile ? "16px" : "14px",
        border: highlighted ? "1.5px solid #f5e32d" : isPaid ? "1.5px solid rgba(245,227,45,0.35)" : "1px solid #222",
        background: "#1a1a1a",
        padding: mobile ? "16px" : "18px 20px",
        boxShadow: highlighted ? "0 0 24px rgba(245,227,45,0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
        <div>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#666" }}>Order ID</p>
          <p style={{ margin: "2px 0 0", fontSize: mobile ? "18px" : "16px", fontWeight: 800, color: "#fff" }}>
            #{shortOrderId(order.id)}
          </p>
        </div>
        <span
          style={{
            alignSelf: "flex-start",
            padding: "6px 10px",
            borderRadius: "8px",
            background: "#141414",
            border: "1px solid #333",
            fontSize: "12px",
            fontWeight: 700,
            color: isPaid ? "#f5e32d" : "#aaa",
          }}
        >
          {kitchenLabelForStatus(order.status)}
        </span>
      </div>

      <p style={{ margin: "0 0 4px", fontSize: "14px", color: "#ccc" }}>
        ₹{order.total_amount ?? "—"}
        {order.phone_number ? ` · ${order.phone_number}` : ""}
      </p>
      {slotLine ? (
        <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, color: "#888" }}>{slotLine}</p>
      ) : null}
      <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#666", lineHeight: 1.45 }}>{itemSummary}</p>

      {isPaid ? (
        <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: "8px" }}>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            style={{
              flex: 1,
              minHeight: "44px",
              borderRadius: "12px",
              border: "none",
              background: "#f5e32d",
              color: "#000",
              fontSize: "14px",
              fontWeight: 800,
              fontFamily: FONT,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Working…" : "Accept order"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            style={{
              flex: 1,
              minHeight: "44px",
              borderRadius: "12px",
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              fontSize: "14px",
              fontWeight: 700,
              fontFamily: FONT,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Reject
          </button>
        </div>
      ) : null}
    </li>
  );
}
