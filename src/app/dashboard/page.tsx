"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transitionOrderStatus } from "@/app/actions/order-transition";
import { kitchenLabelForStatus, normalizeOrderStatus, OrderStatus } from "@/lib/order-status";
import { formatSlotLineForCustomer } from "@/lib/delivery-slots";
import { ShoppingBag, IndianRupee, AlertCircle, Truck } from "lucide-react";

const fontUi = "var(--font-outfit), system-ui, sans-serif";
const fontData = "var(--font-jetbrains-mono), ui-monospace, monospace";

export default function Dashboard() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    kitchenPipeline: 0,
  });

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchOrders() {
    const { data } = await supabase.from("orders").select("*, users(full_name)").order("created_at", { ascending: false });

    if (data) {
      const sorted = [...data].sort((a, b) => {
        const ta = (a as { delivery_slot?: string }).delivery_slot
          ? new Date(String((a as { delivery_slot?: string }).delivery_slot)).getTime()
          : Infinity;
        const tb = (b as { delivery_slot?: string }).delivery_slot
          ? new Date(String((b as { delivery_slot?: string }).delivery_slot)).getTime()
          : Infinity;
        if (ta !== tb) return ta - tb;
        return String((b as { created_at?: string }).created_at || "").localeCompare(
          String((a as { created_at?: string }).created_at || ""),
        );
      });
      setOrders(sorted);
      calculateStats(sorted);
    }
  }

  function calculateStats(data: Record<string, unknown>[]) {
    const revenueStatuses = new Set([
      OrderStatus.PAID,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      "completed",
    ]);

    const totalRevenue = data
      .filter((o) => revenueStatuses.has(String((o as { status?: string }).status || "").toLowerCase()))
      .reduce((acc, o) => acc + Number((o as { total_amount?: number }).total_amount || 0), 0);

    const pendingPayments = data.filter(
      (o) => String((o as { status?: string }).status) === OrderStatus.PENDING_PAYMENT,
    ).length;

    const pipeline = new Set([
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.OUT_FOR_DELIVERY,
      "confirmed",
      "prepping",
      "out",
    ]);

    const kitchenPipeline = data.filter((o) =>
      pipeline.has(String((o as { status?: string }).status || "").toLowerCase()),
    ).length;

    setStats({
      totalOrders: data.length,
      totalRevenue,
      pendingPayments,
      kitchenPipeline,
    });
  }

  async function onTransition(id: string, next: string) {
    const r = await transitionOrderStatus(id, next);
    if (r.ok) fetchOrders();
    else alert(r.error);
  }

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: fontUi,
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(189, 35, 32, 0.12), transparent 55%), #080808",
        padding: "clamp(1rem, 3vw, 2.75rem)",
        color: "#fff",
      }}
    >
      <header
        className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
        style={{ marginBottom: "clamp(1.75rem, 4vw, 2.75rem)" }}
      >
        <div>
          <h1
            style={{
              fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Vidya&apos;s Kitchen
          </h1>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.5,
            }}
          >
            Owner operations
          </p>
        </div>
        <div
          className="flex items-center self-start sm:self-auto shrink-0 rounded-full"
          style={{
            gap: 10,
            padding: "10px 20px",
            minHeight: 40,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: fontData,
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.78)",
            lineHeight: 1.5,
          }}
        >
          <span
            className="inline-block shrink-0 rounded-full"
            style={{
              width: 9,
              height: 9,
              marginTop: 1,
              background: "#22c55e",
              boxShadow: "0 0 10px rgba(34,197,94,0.6)",
            }}
          />
          <span style={{ paddingTop: 1, paddingBottom: 1 }}>Live sync</span>
        </div>
      </header>

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ marginBottom: "clamp(2rem, 5vw, 3rem)" }}
      >
        <StatCard
          icon={<ShoppingBag className="h-5 w-5" strokeWidth={2} />}
          label="Total orders"
          value={stats.totalOrders}
          accent="rgba(255,255,255,0.9)"
          iconTint="rgba(255,255,255,0.12)"
        />
        <StatCard
          icon={<IndianRupee className="h-5 w-5" strokeWidth={2} />}
          label="Revenue (paid onward)"
          value={`₹${Math.round(stats.totalRevenue).toLocaleString("en-IN")}`}
          accent="#BD2320"
          iconTint="rgba(189, 35, 32, 0.15)"
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5" strokeWidth={2} />}
          label="Pending payment"
          value={stats.pendingPayments}
          accent="#f59e0b"
          iconTint="rgba(245, 158, 11, 0.12)"
        />
        <StatCard
          icon={<Truck className="h-5 w-5" strokeWidth={2} />}
          label="In kitchen & dispatch"
          value={stats.kitchenPipeline}
          accent="#c4b5fd"
          iconTint="rgba(196, 181, 253, 0.12)"
        />
      </div>

      <section
        className="overflow-hidden rounded-[1.75rem]"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(13, 13, 15, 0.92)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
        }}
      >
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            padding: "1.375rem 1.75rem",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              lineHeight: 1.45,
            }}
          >
            Orders by slot
          </h2>
          <button
            type="button"
            onClick={() => fetchOrders()}
            className="shrink-0 rounded-full transition-colors hover:bg-white/[0.08]"
            style={{
              fontFamily: fontData,
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.62)",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.03)",
              cursor: "pointer",
              padding: "12px 24px",
              lineHeight: 1.5,
            }}
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Customer", "Amount", "Status", "Slot", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "1rem 1.25rem",
                      fontFamily: fontData,
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.45)",
                      lineHeight: 1.5,
                      verticalAlign: "bottom",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const o = order as {
                  id: string;
                  status: string;
                  total_amount: number;
                  phone_number: string;
                  users?: { full_name?: string };
                  delivery_slot?: string | null;
                  delivery_slot_kind?: string | null;
                };
                const st = normalizeOrderStatus(o.status);
                return (
                  <tr
                    key={o.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    <td style={{ padding: "1.1rem 1.25rem", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.35 }}>{o.users?.full_name || "Guest"}</div>
                      <div style={{ fontFamily: fontData, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                        {o.phone_number || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "1.1rem 1.25rem", verticalAlign: "top", fontFamily: fontData, fontWeight: 800, fontSize: "0.95rem" }}>
                      ₹{Number(o.total_amount).toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "1.1rem 1.25rem", verticalAlign: "top" }}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td
                      style={{
                        padding: "1.1rem 1.25rem",
                        verticalAlign: "top",
                        fontSize: "0.875rem",
                        color: "rgba(255,255,255,0.55)",
                        lineHeight: 1.45,
                        maxWidth: 220,
                      }}
                    >
                      {formatSlotLineForCustomer(o.delivery_slot ?? undefined, o.delivery_slot_kind ?? undefined) || "—"}
                    </td>
                    <td style={{ padding: "1.1rem 1.25rem", verticalAlign: "top" }}>
                      <div className="flex flex-wrap gap-2">
                        {st === OrderStatus.PENDING_PAYMENT && (
                          <ActionBtn label="Confirm pay" onClick={() => onTransition(o.id, OrderStatus.PAID)} tone="primary" />
                        )}
                        {st === OrderStatus.PAID && (
                          <ActionBtn label="Accept order" onClick={() => onTransition(o.id, OrderStatus.PREPARING)} tone="ghost" />
                        )}
                        {st === OrderStatus.PREPARING && (
                          <ActionBtn label="Mark ready" onClick={() => onTransition(o.id, OrderStatus.READY)} tone="ghost" />
                        )}
                        {st === OrderStatus.READY && (
                          <ActionBtn label="Dispatch" onClick={() => onTransition(o.id, OrderStatus.OUT_FOR_DELIVERY)} tone="warn" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
                    <p style={{ margin: 0, fontStyle: "italic", color: "rgba(255,255,255,0.35)", fontSize: "0.95rem" }}>
                      Waiting for new orders…
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: "primary" | "ghost" | "warn";
}) {
  const base: CSSProperties = {
    fontFamily: fontData,
    fontSize: "0.62rem",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "0.5rem 0.9rem",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    transition: "transform 0.15s ease, filter 0.15s ease",
  };
  if (tone === "primary") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...base,
          background: "#BD2320",
          color: "#fff",
          boxShadow: "0 4px 16px rgba(189, 35, 32, 0.35)",
        }}
        className="hover:brightness-110 active:scale-[0.97]"
      >
        {label}
      </button>
    );
  }
  if (tone === "warn") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...base,
          background: "rgba(245, 158, 11, 0.92)",
          color: "#1a1003",
        }}
        className="hover:brightness-110 active:scale-[0.97]"
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...base,
        background: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
      className="hover:bg-white/12 active:scale-[0.97]"
    >
      {label}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  iconTint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
  iconTint: string;
}) {
  return (
    <div
      className="relative transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        borderRadius: "var(--radius-ios, 28px)",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(13, 13, 15, 0.85)",
        padding: "1.5rem 1.35rem 1.5rem",
        minHeight: 128,
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        /* no overflow:hidden — prevents clipped labels with wide letter-spacing */
        overflow: "visible",
      }}
    >
      <div
        className="pointer-events-none absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{ background: iconTint, color: accent }}
      >
        {icon}
      </div>
      <div className="relative pr-14">
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.48)",
            lineHeight: 1.5,
            marginBottom: "0.65rem",
            paddingTop: "0.125rem",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: fontData,
            fontSize: "1.75rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: accent,
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const n = normalizeOrderStatus(status);
  const styles: Record<string, { bg: string; fg: string; border: string }> = {
    pending_payment: { bg: "rgba(245,158,11,0.12)", fg: "#fbbf24", border: "rgba(245,158,11,0.25)" },
    paid: { bg: "rgba(59,130,246,0.1)", fg: "#93c5fd", border: "rgba(59,130,246,0.22)" },
    preparing: { bg: "rgba(167,139,250,0.12)", fg: "#d8b4fe", border: "rgba(167,139,250,0.25)" },
    ready: { bg: "rgba(34,211,238,0.1)", fg: "#67e8f9", border: "rgba(34,211,238,0.2)" },
    out_for_delivery: { bg: "rgba(251,191,36,0.1)", fg: "#fcd34d", border: "rgba(251,191,36,0.22)" },
    delivered: { bg: "rgba(34,197,94,0.1)", fg: "#86efac", border: "rgba(34,197,94,0.22)" },
    cancelled: { bg: "rgba(239,68,68,0.1)", fg: "#fca5a5", border: "rgba(239,68,68,0.22)" },
  };
  const s = styles[n] || { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.1)" };

  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: fontData,
        fontSize: "0.62rem",
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "0.35rem 0.65rem",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        lineHeight: 1.4,
      }}
    >
      {kitchenLabelForStatus(status)}
    </span>
  );
}
