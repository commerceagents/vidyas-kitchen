"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bot, Play, Pause, Zap, Clock, CheckCircle2, AlertTriangle, Percent } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
  DashboardNotificationPanel,
} from "@/components/dashboard/DashboardChrome";
import {
  approvePricingDecisionAction,
  rejectPricingDecisionAction,
  toggleAgentAction,
  runAgentManuallyAction,
} from "@/app/actions/ai-pricing";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";
import { DiscountPctPicker } from "@/components/dashboard/DiscountPctPicker";
import { MENU_BY_CATEGORY } from "@/components/ui/mobile/mobileMenuData";
import { roundToDiscountPreset } from "@/lib/menu/discount-presets";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const CARD_BG = "#1a1a1a";
const BORDER = "#2a2a2a";
const CARD_PAD = "clamp(16px, 2vw, 22px)";

const DETAIL_BOX: React.CSSProperties = {
  background: "#222",
  borderRadius: 12,
  padding: "12px 14px",
  border: "1px solid #2a2a2a",
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const DETAIL_TEXT: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

type Decision = {
  id: string;
  dish_id: string;
  decision_type: string;
  old_discount: number | null;
  new_discount: number | null;
  reasoning: string;
  status: string;
  decided_at: string;
  applied_at: string | null;
};

type AgentState = {
  enabled: boolean;
  lastRunAt: string | null;
  decisions: Decision[];
  pendingCount: number;
  appliedCount: number;
  loading: boolean;
};

export default function PricingAgentPage() {
  const [notifOpen, setNotifOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    soundMuted,
    setSoundMuted,
    markAllRead,
    newCount,
    month,
    setMonth,
    searchQuery,
    setSearchQuery,
  } = useDashboardData();

  const [state, setState] = useState<AgentState>({
    enabled: true,
    lastRunAt: null,
    decisions: [],
    pendingCount: 0,
    appliedCount: 0,
    loading: true,
  });
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/pricing-agent-state", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const decisions = Array.isArray(data.decisions) ? data.decisions : [];
        const pendingCount = decisions.filter((d: Decision) => d.status === "pending").length;
        const appliedCount = decisions.filter((d: Decision) => d.status === "applied" || d.status === "auto_applied").length;
        // expired decisions are silently dropped from UI
        setState({ ...data, decisions, pendingCount, appliedCount, loading: false });
      } else {
        setState((s) => ({ ...s, decisions: [], pendingCount: 0, appliedCount: 0, loading: false }));
      }
    } catch {
      setState((s) => ({ ...s, decisions: [], pendingCount: 0, appliedCount: 0, loading: false }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async () => {
    const next = !state.enabled;
    setState((s) => ({ ...s, enabled: next }));
    const r = await toggleAgentAction(next);
    if (!r.ok) setState((s) => ({ ...s, enabled: !next }));
  };

  const flashMsg = useCallback((text: string) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    setMsg(text);
    msgTimerRef.current = setTimeout(() => setMsg(null), 5000);
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setMsg(null);
    const r = await runAgentManuallyAction();
    setRunning(false);
    if (r.ok) {
      const total = r.result?.totalDecisions ?? 0;
      const pending = r.result?.pendingApproval ?? 0;
      const auto = r.result?.autoApplied ?? 0;
      if (total === 0) {
        flashMsg("All good — no changes needed right now.");
      } else if (pending > 0) {
        flashMsg(`${pending} new suggestion${pending > 1 ? "s" : ""} need your approval.`);
      } else {
        flashMsg(`${auto} change${auto > 1 ? "s" : ""} auto-applied.`);
      }
      void load();
    } else {
      flashMsg(r.error ?? "Run failed — check Vercel logs.");
    }
  };

  const handleApprove = async (id: string, pct?: number | null) => {
    if (id.startsWith("demo-")) return;
    const r = await approvePricingDecisionAction(id, pct);
    if (r.ok) void load();
    else setMsg(r.error ?? "Approve failed");
  };

  const handleReject = async (id: string) => {
    if (id.startsWith("demo-")) return;
    const r = await rejectPricingDecisionAction(id);
    if (r.ok) void load();
    else setMsg(r.error ?? "Reject failed");
  };

  const openNotifications = () => {
    setNotifOpen(true);
    markAllRead();
  };

  const pending = state.decisions.filter((d) => d.status === "pending");
  const recent = state.decisions.filter((d) => d.status !== "pending" && d.status !== "expired").slice(0, 20);

  const metricCards = [
    { id: "status", label: "Status", value: state.enabled ? "Active" : "Paused", icon: Zap, color: state.enabled ? "#22C55E" : "#666", bg: state.enabled ? "rgba(34, 197, 94, 0.08)" : "rgba(102, 102, 102, 0.08)" },
    { id: "pending", label: "Pending", value: String(state.pendingCount), icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.08)" },
    { id: "applied", label: "Applied (30d)", value: String(state.appliedCount), icon: CheckCircle2, color: "#34D399", bg: "rgba(52, 211, 153, 0.08)" },
    { id: "lastrun", label: "Last run", value: state.lastRunAt ? new Date(state.lastRunAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }) : "Never", icon: Clock, color: "#38BDF8", bg: "rgba(56, 189, 248, 0.08)" },
  ];

  const content = state.loading ? (
    <DashboardSpinner minHeight="100%" />
  ) : (
    <>
      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD_BG, fontSize: 13, color: "#ccc", fontFamily: FONT, marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {pending.length === 0 && recent.length === 0 ? (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", boxSizing: "border-box" }}>
          <Bot size={56} color="#FACC15" strokeWidth={1.2} style={{ marginBottom: 16 }} />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#666", fontFamily: FONT }}>No decisions yet</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", fontFamily: FONT }}>Run the agent to generate pricing recommendations</p>
        </div>
      ) : (
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {pending.length > 0 && (
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F59E0B", fontFamily: FONT }}>
                Needs your approval
              </p>
              <ul className="vk-order-grid vk-pricing-decisions-grid" style={{ margin: 0, padding: 0 }}>
                {pending.map((d) => (
                  <DecisionCard
                    key={d.id}
                    decision={d}
                    onApprove={(pct) => handleApprove(d.id, pct)}
                    onReject={() => handleReject(d.id)}
                  />
                ))}
              </ul>
            </div>
          )}
          {recent.length > 0 && (
            <details open={pending.length === 0}>
              <summary style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#555", fontFamily: FONT, cursor: "pointer", listStyle: "none", marginBottom: 10 }}>
                Recent history ({recent.length})
              </summary>
              <ul className="vk-order-grid vk-pricing-decisions-grid" style={{ margin: 0, padding: 0 }}>
                {recent.map((d) => (
                  <DecisionCard
                    key={d.id}
                    decision={d}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div
        className="vk-dash-home-mobile"
        style={{ display: "none", flexDirection: "column", height: "100%", minHeight: "100dvh", background: "#0d0d0d" }}
      >
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
        />
        <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Mobile: agent chip + toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: FONT }}>AI Pricing</h2>
            <AgentChip enabled={state.enabled} onClick={handleToggle} />
          </div>
          <PricingMetricTabs cards={metricCards} />
          {content}
        </div>
      </div>

      {/* ── Desktop Layout ── */}
      <div
        className="vk-dash-home-desktop"
        style={{ display: "none", flexDirection: "column", height: "100%", gap: "clamp(12px, 1.5vw, 20px)", background: "#0d0d0d", boxSizing: "border-box", overflow: "hidden" }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#141414",
            borderRadius: "clamp(14px, 1.5vw, 20px)",
            padding: "clamp(12px, 1.5vh, 16px) clamp(16px, 1.5vw, 24px)",
            border: "1px solid #222222",
            flex: "0 0 auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(16px, 1.5vw, 22px)", fontWeight: 800, color: "#ffffff", fontFamily: "var(--font-outfit)", letterSpacing: "-0.02em" }}>
              AI Pricing
            </h1>
            <AgentChip enabled={state.enabled} onClick={handleToggle} />
          </div>
          <DashboardDesktopTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
            unreadCount={unreadCount}
            onOpenNotifications={openNotifications}
            hideSearchAndMonth
            trailingActions={
              <button
                type="button"
                onClick={running ? undefined : handleRun}
                disabled={running || !state.enabled}
                aria-label={running ? "Agent running" : "Run agent"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: running ? `1px solid ${YELLOW}35` : `1px solid ${BORDER}`,
                  background: running ? `${YELLOW}14` : CARD_BG,
                  color: running ? YELLOW : state.enabled ? "#aaa" : "#444",
                  cursor: running || !state.enabled ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
              >
                {running ? <Pause size={20} fill="currentColor" /> : <Play size={20} />}
              </button>
            }
          />
        </div>

        <PricingMetricTabs cards={metricCards} />

        {/* Content Panel */}
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: "#141414",
            borderRadius: "clamp(14px, 1.5vw, 20px)",
            padding: "clamp(14px, 1.5vh, 20px)",
            border: "1px solid #222222",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {content}
          </div>
        </div>
      </div>

      <DashboardNotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
        onMarkAllRead={markAllRead}
        onAccept={() => {}}
        onReject={() => {}}
        onView={() => {}}
        onDismiss={() => {}}
      />

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-home-mobile { display: flex !important; }
          .vk-dash-home-desktop { display: none !important; }
          .vk-pricing-decisions-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 1024px) {
          .vk-dash-home-mobile { display: none !important; }
          .vk-dash-home-desktop { display: flex !important; }
        }
      `}</style>
    </>
  );
}

function PricingMetricTabs({
  cards,
}: {
  cards: {
    id: string;
    label: string;
    value: string;
    icon: LucideIcon;
    color: string;
    bg: string;
  }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: "clamp(10px, 1.2vw, 16px)",
        width: "100%",
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
        flexShrink: 0,
      }}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            style={{
              flex: "1 1 0px",
              background: "#1a1a1a",
              borderRadius: "clamp(12px, 1.2vw, 16px)",
              padding: "clamp(12px, 1.5vh, 18px) clamp(12px, 1.2vw, 18px)",
              display: "flex",
              alignItems: "center",
              gap: "clamp(8px, 0.8vw, 12px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              border: "1px solid #2a2a2a",
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: card.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: card.color,
                flexShrink: 0,
              }}
            >
              <Icon size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: card.id === "lastrun" ? "clamp(13px, 1.2vw, 16px)" : "clamp(16px, 1.5vw, 20px)",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: card.id === "lastrun" ? "normal" : "nowrap",
                }}
              >
                {card.value}
              </h3>
              <p
                style={{
                  margin: "1px 0 0",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#666666",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {card.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgentChip({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        border: enabled ? `1px solid ${YELLOW}35` : "1px solid #444",
        background: enabled ? `${YELLOW}14` : "rgba(102, 102, 102, 0.08)",
        color: enabled ? YELLOW : "#888",
        fontSize: 11,
        fontWeight: 800,
        fontFamily: FONT,
        cursor: "pointer",
        letterSpacing: "0.2px",
        lineHeight: 1.2,
      }}
    >
      {enabled ? "Active" : "Paused"}
    </button>
  );
}

function decisionDisplayName(decision: Decision): string {
  const fromReason = decision.reasoning?.match(/Festival "([^"]+)"/);
  if (fromReason?.[1]) return fromReason[1];

  if (decision.dish_id.startsWith("festival:")) {
    return "Festival offer";
  }

  const dish = Object.values(MENU_BY_CATEGORY)
    .flat()
    .find((d) => d.id === decision.dish_id);
  if (dish) return dish.name;

  return decision.dish_id;
}

function statusChipStyle(status: string): { bg: string; color: string; border: string } {
  if (status === "pending") {
    return { bg: "rgba(245, 158, 11, 0.12)", color: "#F59E0B", border: "rgba(245, 158, 11, 0.35)" };
  }
  if (status === "rejected") {
    return { bg: "rgba(239, 68, 68, 0.12)", color: "#EF4444", border: "rgba(239, 68, 68, 0.35)" };
  }
  return { bg: "rgba(52, 211, 153, 0.12)", color: "#34D399", border: "rgba(52, 211, 153, 0.35)" };
}

function statusLabel(status: string): string {
  if (status === "auto_applied") return "Auto applied";
  if (status === "pending") return "Pending";
  if (status === "applied") return "Applied";
  if (status === "rejected") return "Rejected";
  return status.replace("_", " ");
}

function decisionTypeLabel(type: string): string {
  if (type === "increase_discount") return "Increase";
  if (type === "decrease_discount") return "Decrease";
  if (type === "remove_discount") return "Remove";
  if (type === "festival_activate") return "Festival";
  if (type === "festival_deactivate") return "Festival off";
  if (type === "meal_boost") return "Meal boost";
  return type.replace("_", " ");
}

function InfoChip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        background: accent ? `${YELLOW}14` : "rgba(255,255,255,0.04)",
        border: accent ? `1px solid ${YELLOW}35` : "1px solid #333",
        color: accent ? YELLOW : "#888",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.2px",
        lineHeight: 1.2,
      }}
    >
      {label}
    </span>
  );
}

function DecisionCard({
  decision,
  onApprove,
  onReject,
}: {
  decision: Decision;
  onApprove?: (pct?: number | null) => void;
  onReject?: () => void;
}) {
  const isPending = decision.status === "pending";
  const needsPctPick =
    isPending &&
    (decision.decision_type === "increase_discount" ||
      decision.decision_type === "meal_boost" ||
      decision.decision_type === "festival_activate");
  const [pickedPct, setPickedPct] = useState<number>(() =>
    roundToDiscountPreset(decision.new_discount ?? 20),
  );
  const name = decisionDisplayName(decision);
  const chip = statusChipStyle(decision.status);
  const decidedLabel = new Date(decision.decided_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <li
      className="vk-order-card"
      style={{
        borderRadius: 18,
        border: isPending ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #2a2a2a",
        background: CARD_BG,
        padding: 0,
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        height: "100%",
        fontFamily: FONT,
        listStyle: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px clamp(14px, 2vw, 18px)",
          background: "linear-gradient(180deg, #111 0%, #0d0d0d 100%)",
          borderBottom: "1px solid #2a2a2a",
          borderRadius: "18px 18px 0 0",
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.3px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {name}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 12px",
            borderRadius: 8,
            background: chip.bg,
            border: `1px solid ${chip.border}`,
            color: chip.color,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.2px",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {statusLabel(decision.status)}
        </span>
      </div>

      <div
        style={{
          padding: CARD_PAD,
          paddingTop: "clamp(12px, 1.5vw, 16px)",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <div style={{ ...DETAIL_BOX, alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc", lineHeight: 1.45 }}>
              {decision.reasoning}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <div style={{ ...DETAIL_BOX, flex: 1 }}>
              <Percent size={16} color={YELLOW} strokeWidth={2.25} style={{ flexShrink: 0 }} />
              <span style={DETAIL_TEXT}>
                {decision.decision_type === "festival_activate"
                  ? "Currently off"
                  : `Was ${decision.old_discount != null ? `${decision.old_discount}%` : "—"}`}
              </span>
            </div>
            <div
              style={{
                ...DETAIL_BOX,
                flex: 1,
                background: `${YELLOW}10`,
                border: `1px solid ${YELLOW}28`,
              }}
            >
              <Percent size={16} color={YELLOW} strokeWidth={2.25} style={{ flexShrink: 0 }} />
              <span style={{ ...DETAIL_TEXT, color: YELLOW }}>
                {decision.decision_type === "festival_activate"
                  ? `Activate ${needsPctPick ? pickedPct : (decision.new_discount ?? 20)}%`
                  : `New ${needsPctPick ? `${pickedPct}%` : decision.new_discount != null ? `${decision.new_discount}%` : "—"}`}
              </span>
            </div>
          </div>

          {needsPctPick && (
            <div style={{ marginTop: 4 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Tap a % (AI suggested highlighted)
              </p>
              <DiscountPctPicker
                value={pickedPct}
                suggested={decision.new_discount}
                onChange={setPickedPct}
                size="sm"
              />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <InfoChip label={decisionTypeLabel(decision.decision_type)} />
          </div>
        </div>

        <div
          className="vk-order-card-footer"
          style={{ marginTop: "auto", paddingTop: 16, flexShrink: 0 }}
        >
          <div className="vk-order-card-footer-total">
            <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 4 }}>
              {decidedLabel}
            </div>
            {decision.applied_at && (
              <div style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>
                Applied{" "}
                {new Date(decision.applied_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            )}
          </div>

          {isPending && onApprove && onReject ? (
            <div className="vk-order-card-actions">
              <button
                type="button"
                onClick={onReject}
                className="vk-order-btn vk-order-btn-reject"
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: "1.5px solid rgba(239,68,68,0.35)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#EF4444",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: FONT,
                  boxSizing: "border-box",
                }}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => onApprove(needsPctPick ? pickedPct : null)}
                className="vk-order-btn vk-order-btn-accept"
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: "none",
                  background: YELLOW,
                  color: "#111",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: FONT,
                  boxShadow: `0 4px 14px ${YELLOW}25`,
                  boxSizing: "border-box",
                }}
              >
                Approve
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
