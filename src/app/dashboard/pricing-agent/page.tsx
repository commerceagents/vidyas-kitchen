"use client";

import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Bot, Play, Pause, Zap, Clock, CheckCircle2, AlertTriangle, Percent, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
} from "@/components/dashboard/DashboardChrome";
import {
  approvePricingDecisionAction,
  rejectPricingDecisionAction,
  updateAppliedDiscountAction,
  toggleAgentAction,
  runAgentManuallyAction,
} from "@/app/actions/ai-pricing";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";
import { DiscountPctPicker } from "@/components/dashboard/DiscountPctPicker";
import { MENU_BY_CATEGORY, MENU_CATEGORIES } from "@/components/ui/mobile/mobileMenuData";
import { setFestivalDishesAction } from "@/app/actions/festival-pricing";
import { roundToDiscountPreset } from "@/lib/menu/discount-presets";
import { festivalCalendarStatus } from "@/lib/menu/discount-pricing";
import {
  festivalIdOf,
  isQualityDecision,
  listTabForDecision,
  preferredFestivalIds,
  visibleReasoning,
  type PricingListTab,
} from "@/lib/ai/pricing-tabs";
import { festivalNameKey, historyPerformanceLine, type OfferOutcome } from "@/lib/ai/offer-memory";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";

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

type DishSuggestion = { dishId: string; pct: number; note: string };

type FestivalWindow = {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  active: boolean;
  discount_override: number;
  relevant_categories?: string;
};

type AgentState = {
  enabled: boolean;
  lastRunAt: string | null;
  decisions: Decision[];
  pendingCount: number;
  appliedCount: number;
  loading: boolean;
  festivalDishes: Record<string, string[]>;
  dishOverrides: Record<string, Record<string, number>>;
  offerOutcomes: OfferOutcome[];
  festivals: FestivalWindow[];
};

export default function PricingAgentPage() {
  const {
    unreadCount,
    soundMuted,
    setSoundMuted,
    openNotifications,
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
    festivalDishes: {},
    dishOverrides: {},
    offerOutcomes: [],
    festivals: [],
  });
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [listTab, setListTab] = useState<PricingListTab>("upcoming");
  const msgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (followup = false) => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch("/api/ai/pricing-agent-state", { cache: "no-store", signal: ctrl.signal });
      if (res.ok) {
        const data = await res.json();
        const decisions = Array.isArray(data.decisions) ? data.decisions : [];
        const pendingCount = decisions.filter((d: Decision) => d.status === "pending").length;
        const appliedCount = decisions.filter((d: Decision) => d.status === "applied" || d.status === "auto_applied").length;
        const festivalDishes =
          data.festivalDishes && typeof data.festivalDishes === "object" ? data.festivalDishes : {};
        const dishOverrides =
          data.dishOverrides && typeof data.dishOverrides === "object" ? data.dishOverrides : {};
        const offerOutcomes = Array.isArray(data.offerOutcomes) ? data.offerOutcomes : [];
        const festivals = Array.isArray(data.festivals) ? data.festivals : [];
        setState({
          ...data,
          decisions,
          pendingCount,
          appliedCount,
          festivalDishes,
          dishOverrides,
          offerOutcomes,
          festivals,
          loading: false,
        });
        if (data.refreshing && !followup) {
          window.setTimeout(() => {
            void load(true);
          }, 12000);
        }
      } else if (!followup) {
        setState((s) => ({ ...s, decisions: [], pendingCount: 0, appliedCount: 0, loading: false }));
      }
    } catch {
      if (!followup) {
        setState((s) => ({ ...s, decisions: [], pendingCount: 0, appliedCount: 0, loading: false }));
      }
    } finally {
      window.clearTimeout(timer);
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

  const handleApprove = async (
    id: string,
    pct?: number | null,
    dishIds?: string[],
    dishOverrides?: Record<string, number>,
  ) => {
    if (id.startsWith("demo-")) return;
    if (dishIds && dishIds.length === 0) {
      flashMsg("Tick at least one dish, then tap Approve.");
      return;
    }
    setState((s) => {
      const decisions = s.decisions.map((d) => (d.id === id ? { ...d, status: "applied" } : d));
      return {
        ...s,
        decisions,
        pendingCount: decisions.filter((d) => d.status === "pending").length,
        festivalDishes:
          dishIds && s.decisions.some((d) => d.id === id && d.dish_id.startsWith("festival:"))
            ? {
                ...s.festivalDishes,
                [String(s.decisions.find((d) => d.id === id)?.dish_id).slice("festival:".length)]: dishIds,
              }
            : s.festivalDishes,
      };
    });
    flashMsg(dishIds ? "Approved. Those dishes get the lower price on the real menu during the festival dates." : "Approved.");
    const r = await approvePricingDecisionAction(id, pct, dishIds, dishOverrides);
    if (!r.ok) flashMsg(r.error ?? "Approve failed");
    void load();
  };

  const handleReject = async (id: string) => {
    if (id.startsWith("demo-")) return;
    const r = await rejectPricingDecisionAction(id);
    if (r.ok) void load();
    else setMsg(r.error ?? "Reject failed");
  };

  const handleUpdate = async (id: string, pct: number) => {
    if (id.startsWith("demo-")) return;
    const r = await updateAppliedDiscountAction(id, pct);
    if (r.ok) void load();
    else setMsg(r.error ?? "Update failed");
  };

  const handleSaveDishes = async (
    festivalId: string,
    dishIds: string[],
    dishOverrides?: Record<string, number>,
  ) => {
    const r = await setFestivalDishesAction(festivalId, dishIds, dishOverrides);
    if (r.ok) {
      setState((s) => ({ ...s, festivalDishes: { ...s.festivalDishes, [festivalId]: dishIds } }));
      flashMsg(dishIds.length ? `Offer saved on ${dishIds.length} dish${dishIds.length === 1 ? "" : "es"}.` : "No dishes selected, so the menu stays full price.");
      void load();
    } else {
      flashMsg(r.error ?? "Could not save the dishes");
    }
  };

  const festivalById = new Map(state.festivals.map((festival) => [festival.id, festival]));
  const tabOf = (decision: Decision) =>
    listTabForDecision(decision, festivalById.get(festivalIdOf(decision.dish_id) || "") ?? null);
  const nestFestival = nestTargetFestival(state.decisions, state.festivals);
  const nestedSuggestions = nestFestival ? suggestionsForFestival(state.decisions, nestFestival, festivalById) : [];
  const hiddenDishIds = new Set(nestedSuggestions.map((row) => row.dishId));
  const preferredIds = preferredFestivalIds(
    state.festivals.map((festival) => ({
      ...festival,
      included_dish_ids: state.festivalDishes[festival.id] ?? [],
    })),
  );
  const visibleDecisions = state.decisions.filter((decision) => {
    if (hiddenDishIds.has(decision.dish_id)) return false;
    const festivalId = festivalIdOf(decision.dish_id);
    if (!festivalId || !decision.decision_type.startsWith("festival")) return true;
    return preferredIds.has(festivalId);
  });
  const upcoming = visibleDecisions.filter((decision) => tabOf(decision) === "upcoming");
  const active = visibleDecisions.filter((decision) => tabOf(decision) === "active");
  const history = visibleDecisions
    .filter((decision) => tabOf(decision) === "history")
    .filter((decision) => {
      const id = festivalIdOf(decision.dish_id);
      const festival = id ? festivalById.get(id) : undefined;
      return festival != null && festivalNameKey(festival.name) === "navaratri" && decision.decision_type === "festival_activate";
    })
    .slice(0, 1);

  const metricCards = [
    { id: "status", label: "Status", value: state.enabled ? "Active" : "Paused", icon: Zap, color: state.enabled ? "#22C55E" : "#666", bg: state.enabled ? "rgba(34, 197, 94, 0.08)" : "rgba(102, 102, 102, 0.08)" },
    { id: "pending", label: "Pending", value: String(state.pendingCount), icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.08)" },
    { id: "applied", label: "Applied (30d)", value: String(state.appliedCount), icon: CheckCircle2, color: "#34D399", bg: "rgba(52, 211, 153, 0.08)" },
    { id: "lastrun", label: "Last run", value: state.lastRunAt ? new Date(state.lastRunAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }) : "Never", icon: Clock, color: "#38BDF8", bg: "rgba(56, 189, 248, 0.08)" },
  ];

  const content = state.loading ? (
    <DashboardSpinner minHeight="100%" />
  ) : (
    <PricingDecisionsPanel
      listTab={listTab}
      onTabChange={setListTab}
      upcoming={upcoming}
      active={active}
      history={history}
      msg={msg}
      onApprove={handleApprove}
      onReject={handleReject}
      onUpdate={handleUpdate}
      festivalDishes={state.festivalDishes}
      dishOverrides={state.dishOverrides}
      offerOutcomes={state.offerOutcomes}
      festivals={state.festivals}
      nestFestivalId={nestFestival ? festivalIdOf(nestFestival.dish_id) : null}
      suggestions={nestedSuggestions}
      onSaveDishes={handleSaveDishes}
    />
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
          unreadCount={unreadCount}
          onOpenNotifications={openNotifications}
        />
        <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16, paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          {/* Mobile: agent chip + toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: FONT }}>AI Pricing</h2>
            <AgentChip enabled={state.enabled} onClick={handleToggle} />
          </div>
          <PricingMetricTabs cards={metricCards} />
          {content}
        </div>
        <DashboardMobileNav />
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

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-home-mobile { display: flex !important; }
          .vk-dash-home-desktop { display: none !important; }
          .vk-pricing-decisions-grid {
            grid-template-columns: 1fr !important;
          }
          .vk-festival-dish-grid {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
        }
        @media (min-width: 1024px) {
          .vk-dash-home-mobile { display: none !important; }
          .vk-dash-home-desktop { display: flex !important; }
          .vk-festival-dish-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
          }
        }
        .vk-pricing-filters {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          max-width: 100%;
          scrollbar-width: none;
        }
        .vk-pricing-filters::-webkit-scrollbar { display: none; }
        .vk-pricing-filters button {
          scroll-snap-align: start;
          flex: 0 0 auto;
        }
        .vk-pricing-tab-switch { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
        .vk-festival-adjust-toggle, .vk-festival-sticky { display: none; }
        @media (max-width: 1023px) {
          .vk-festival-adjust-toggle {
            display: flex;
            align-items: center;
            width: 100%;
            min-height: 44px;
            margin: 0 0 8px;
            padding: 0 12px;
            border-radius: 12px;
            border: 1px solid #333;
            background: #1c1c1c;
            color: #fff;
            font-family: var(--font-outfit), system-ui, sans-serif;
            font-weight: 700;
            font-size: 13px;
            text-align: left;
            cursor: pointer;
          }
          .vk-festival-adjust-body { display: none; }
          .vk-festival-adjust.is-open .vk-festival-adjust-body { display: block; }
          .vk-festival-sticky.is-on {
            display: block;
            position: fixed;
            left: 12px;
            right: 12px;
            bottom: calc(76px + env(safe-area-inset-bottom, 0px));
            z-index: 30;
          }
          .vk-festival-sticky.is-on button {
            width: 100%;
            min-height: 44px;
            border: none;
            border-radius: 12px;
            background: #f5e32d;
            color: #111;
            font-family: var(--font-outfit), system-ui, sans-serif;
            font-weight: 800;
            font-size: 15px;
            cursor: pointer;
          }
          .vk-order-card-actions .vk-order-btn { min-height: 44px; }
        }
        @media (min-width: 1024px) {
          .vk-pricing-filters { flex-wrap: wrap; overflow: visible; }
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
    <div className="vk-pricing-metric-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.id} className="vk-pricing-metric-card">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: card.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: card.color,
                flexShrink: 0,
              }}
            >
              <Icon size={19} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: card.id === "lastrun" ? "clamp(13px, 1.2vw, 15px)" : "clamp(16px, 1.5vw, 19px)",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.15,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: card.id === "lastrun" ? "normal" : "nowrap",
                }}
              >
                {card.value}
              </h3>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "#888888",
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

const TAB_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const TAB_MS = 280;

function PricingDecisionsPanel({
  listTab,
  onTabChange,
  upcoming,
  active,
  history,
  msg,
  onApprove,
  onReject,
  onUpdate,
  festivalDishes,
  dishOverrides,
  offerOutcomes,
  festivals,
  nestFestivalId,
  suggestions,
  onSaveDishes,
}: {
  listTab: PricingListTab;
  onTabChange: (tab: PricingListTab) => void;
  upcoming: Decision[];
  active: Decision[];
  history: Decision[];
  msg: string | null;
  onApprove: (id: string, pct?: number | null, dishIds?: string[], dishOverrides?: Record<string, number>) => void;
  onReject: (id: string) => void;
  onUpdate: (id: string, pct: number) => void | Promise<void>;
  festivalDishes: Record<string, string[]>;
  dishOverrides: Record<string, Record<string, number>>;
  offerOutcomes: OfferOutcome[];
  festivals: FestivalWindow[];
  nestFestivalId: string | null;
  suggestions: DishSuggestion[];
  onSaveDishes: (festivalId: string, dishIds: string[], dishOverrides?: Record<string, number>) => Promise<void>;
}) {
  const [motionOn, setMotionOn] = useState(false);
  const [group, setGroup] = useState<OfferGroup>("all");
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setMotionOn(true);
  }, []);

  return (
    <div className="vk-pricing-decisions-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexShrink: 0, flexWrap: "wrap" }}>
        <OfferGroupFilters value={group} onChange={setGroup} />
        <ListTabSwitch
          value={listTab}
          onChange={onTabChange}
          upcomingCount={upcoming.length}
          activeCount={active.length}
          historyCount={history.length}
          motionOn={motionOn}
        />
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD_BG, fontSize: 13, color: "#ccc", fontFamily: FONT, marginBottom: 12, flexShrink: 0 }}>
          {msg}
        </div>
      )}

      <div className="vk-pricing-decisions-viewport">
        {(["upcoming", "active", "history"] as const).map((tab) => {
          const showing = listTab === tab;
          const items = tab === "upcoming" ? upcoming : tab === "active" ? active : history;
          const emptyTitle = tab === "upcoming" ? "Nothing upcoming" : tab === "active" ? "No live offers" : "No finished offers";
          const emptyBody =
            tab === "upcoming"
              ? "Festivals that have not started, and dishes that need a decision, show up here."
              : tab === "active"
                ? "Offers running today show up here."
                : "When an offer’s last day has passed, its result shows up here.";
          return (
            <div
              key={tab}
              aria-hidden={!showing}
              className="vk-pricing-decisions-tab-pane"
              style={{
                position: "absolute",
                inset: 0,
                overflowY: showing ? "auto" : "hidden",
                opacity: showing ? 1 : 0,
                transform: showing ? "translateX(0)" : tab === "history" ? "translateX(14px)" : "translateX(-14px)",
                transition: motionOn ? `opacity ${TAB_MS}ms ${TAB_EASE}, transform ${TAB_MS}ms ${TAB_EASE}` : "none",
                pointerEvents: showing ? "auto" : "none",
              }}
            >
              {items.length === 0 ? (
                <div style={{ minHeight: 200, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", boxSizing: "border-box" }}>
                  <Bot size={52} color="#FACC15" strokeWidth={1.2} style={{ marginBottom: 14 }} />
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#999", fontFamily: FONT }}>
                    {emptyTitle}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666", fontFamily: FONT }}>
                    {emptyBody}
                  </p>
                </div>
              ) : (
                <OfferGroups
                  items={items.filter((d) => group === "all" || decisionGroup(d) === group)}
                  festivalDishes={festivalDishes}
                  dishOverrides={dishOverrides}
                  offerOutcomes={offerOutcomes}
                  festivals={festivals}
                  nestFestivalId={nestFestivalId}
                  suggestions={suggestions}
                  onSaveDishes={onSaveDishes}
                  onApprove={tab === "history" ? undefined : onApprove}
                  onReject={tab === "history" ? undefined : onReject}
                  onUpdate={tab === "history" ? undefined : onUpdate}
                  readOnly={tab === "history"}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListTabSwitch({
  value,
  onChange,
  upcomingCount,
  activeCount,
  historyCount,
  motionOn,
}: {
  value: PricingListTab;
  onChange: (tab: PricingListTab) => void;
  upcomingCount: number;
  activeCount: number;
  historyCount: number;
  motionOn: boolean;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const btnRefs = React.useRef<Partial<Record<PricingListTab, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState({ left: 3, width: 0, ready: false });

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const btn = btnRefs.current[value];
    if (!wrap || !btn) return;
    const wr = wrap.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setPill({ left: br.left - wr.left, width: br.width, ready: true });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure, upcomingCount, activeCount, historyCount]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const tabs = [
    { id: "upcoming" as const, label: "Upcoming", count: upcomingCount },
    { id: "active" as const, label: "Active", count: activeCount },
    { id: "history" as const, label: "History", count: historyCount },
  ];

  return (
    <div
      ref={wrapRef}
      role="tablist"
      aria-label="Pricing decisions"
      className="vk-pricing-tab-switch"
      style={{
        position: "relative",
        display: "inline-flex",
        padding: 3,
        borderRadius: 10,
        background: "#111",
        border: `1px solid ${BORDER}`,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          left: pill.left,
          width: pill.width,
          borderRadius: 8,
          background: YELLOW,
          opacity: pill.ready ? 1 : 0,
          transition: pill.ready && motionOn
            ? `left ${TAB_MS}ms ${TAB_EASE}, width ${TAB_MS}ms ${TAB_EASE}`
            : "none",
          pointerEvents: "none",
        }}
      />
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              btnRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            style={{
              position: "relative",
              zIndex: 1,
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: active ? "#111" : "#888",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: FONT,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: motionOn ? `color ${TAB_MS}ms ${TAB_EASE}` : "none",
            }}
          >
            {t.label}
            <span style={{ opacity: 0.7 }}>{t.count}</span>
          </button>
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

type OfferGroup = "all" | "festival" | "chicken" | "egg" | "mutton";

function decisionGroup(decision: Decision): OfferGroup {
  if (decision.decision_type.startsWith("festival") || decision.dish_id.startsWith("festival:")) return "festival";
  for (const category of MENU_CATEGORIES) {
    if (MENU_BY_CATEGORY[category.id].some((dish) => dish.id === decision.dish_id)) return category.id;
  }
  return "all";
}

function OfferGroupFilters({ value, onChange }: { value: OfferGroup; onChange: (next: OfferGroup) => void }) {
  const options: { id: OfferGroup; label: string }[] = [
    { id: "all", label: "All" },
    { id: "festival", label: "Festival" },
    ...MENU_CATEGORIES.map((category) => ({ id: category.id as OfferGroup, label: category.label })),
  ];
  return (
    <div className="vk-pricing-filters">
      {options.map((option) => {
        const on = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 999,
              border: on ? `1px solid ${YELLOW}` : "1px solid #333",
              background: on ? YELLOW : "transparent",
              color: on ? "#111" : "#aaa",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONT,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function OfferGroups({
  items,
  festivalDishes,
  dishOverrides,
  offerOutcomes,
  festivals,
  nestFestivalId,
  suggestions,
  onSaveDishes,
  onApprove,
  onReject,
  onUpdate,
  readOnly,
}: {
  items: Decision[];
  festivalDishes: Record<string, string[]>;
  dishOverrides: Record<string, Record<string, number>>;
  offerOutcomes: OfferOutcome[];
  festivals: FestivalWindow[];
  nestFestivalId: string | null;
  suggestions: DishSuggestion[];
  onSaveDishes: (festivalId: string, dishIds: string[], dishOverrides?: Record<string, number>) => Promise<void>;
  onApprove?: (id: string, pct?: number | null, dishIds?: string[], dishOverrides?: Record<string, number>) => void;
  onReject?: (id: string) => void;
  onUpdate?: (id: string, pct: number) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const sections: { id: string; label: string; items: Decision[] }[] = [];
  const push = (id: string, label: string, row: Decision) => {
    const found = sections.find((section) => section.id === id);
    if (found) found.items.push(row);
    else sections.push({ id, label, items: [row] });
  };
  for (const row of items) {
    const group = decisionGroup(row);
    if (group === "festival") push("festival", "Festival", row);
    else if (group === "chicken" || group === "egg" || group === "mutton") {
      const label = MENU_CATEGORIES.find((category) => category.id === group)?.label ?? group;
      push(group, label, row);
    } else push("other", "Other", row);
  }
  if (sections.length === 0) {
    return (
      <p style={{ margin: "24px 0", textAlign: "center", color: "#777", fontFamily: FONT, fontSize: 14 }}>
        Nothing in this filter.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {sections.map((section) => (
        <section key={section.id}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#888", fontFamily: FONT }}>
            {section.label}
            <span style={{ marginLeft: 8, color: "#555" }}>{section.items.length}</span>
          </h3>
          {section.id === "festival" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {section.items.map((d) =>
                d.decision_type === "festival_activate" && d.dish_id.startsWith("festival:") ? (
                  <FestivalBundle
                    key={d.id}
                    decision={d}
                    savedIds={festivalDishes[d.dish_id.slice("festival:".length)] ?? EMPTY_DISH_IDS}
                    savedOverrides={dishOverrides[d.dish_id.slice("festival:".length)] ?? EMPTY_OVERRIDES}
                    suggestions={festivalIdOf(d.dish_id) === nestFestivalId ? suggestions : EMPTY_SUGGESTIONS}
                    historyLine={historyLineFor(d, festivals, offerOutcomes)}
                    pending={d.status === "pending" && !readOnly}
                    readOnly={Boolean(readOnly)}
                    onApprove={onApprove}
                    onReject={onReject}
                    onUpdate={onUpdate}
                    onSaveDishes={onSaveDishes}
                  />
                ) : (
                  <ul key={d.id} className="vk-order-grid vk-pricing-decisions-grid no-scrollbar" style={{ margin: 0, padding: 0 }}>
                    <DecisionCard
                      decision={d}
                      quality={isQualityDecision(d.reasoning)}
                      lowSeller={!isQualityDecision(d.reasoning) && !d.dish_id.startsWith("festival:")}
                      historyLine={historyLineFor(d, festivals, offerOutcomes)}
                      readOnly={Boolean(readOnly)}
                      onApprove={onApprove && !isQualityDecision(d.reasoning) ? (pct) => onApprove(d.id, pct) : undefined}
                      onReject={onReject ? () => onReject(d.id) : undefined}
                      onUpdate={onUpdate ? (pct) => onUpdate(d.id, pct) : undefined}
                    />
                  </ul>
                ),
              )}
            </div>
          ) : (
          <ul className="vk-order-grid vk-pricing-decisions-grid no-scrollbar" style={{ margin: 0, padding: 0 }}>
            {section.items.map((d) => (
              <DecisionCard
                key={d.id}
                decision={d}
                quality={isQualityDecision(d.reasoning)}
                lowSeller={!isQualityDecision(d.reasoning) && (d.decision_type === "increase_discount" || d.decision_type === "meal_boost")}
                historyLine={historyLineFor(d, festivals, offerOutcomes)}
                readOnly={Boolean(readOnly)}
                onApprove={onApprove && !isQualityDecision(d.reasoning) ? (pct) => onApprove(d.id, pct) : undefined}
                onReject={onReject ? () => onReject(d.id) : undefined}
                onUpdate={onUpdate ? (pct) => onUpdate(d.id, pct) : undefined}
              />
            ))}
          </ul>
          )}
        </section>
      ))}
    </div>
  );
}

const EMPTY_DISH_IDS: string[] = [];
const EMPTY_SUGGESTIONS: DishSuggestion[] = [];
const EMPTY_OVERRIDES: Record<string, number> = {};

function FestivalBundle({
  decision,
  savedIds,
  savedOverrides,
  suggestions,
  historyLine,
  pending,
  readOnly,
  onApprove,
  onReject,
  onUpdate,
  onSaveDishes,
}: {
  decision: Decision;
  savedIds: string[];
  savedOverrides: Record<string, number>;
  suggestions: DishSuggestion[];
  historyLine: string | null;
  pending: boolean;
  readOnly: boolean;
  onApprove?: (id: string, pct?: number | null, dishIds?: string[], dishOverrides?: Record<string, number>) => void;
  onReject?: (id: string) => void;
  onUpdate?: (id: string, pct: number) => void | Promise<void>;
  onSaveDishes: (festivalId: string, dishIds: string[], dishOverrides?: Record<string, number>) => Promise<void>;
}) {
  const festivalId = decision.dish_id.slice("festival:".length);
  const savedKey = dishKey(savedIds);
  const suggestionKey = suggestions.map((row) => `${row.dishId}:${row.pct}`).join("|");
  const overrideKey = Object.entries(savedOverrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, pct]) => `${id}:${pct}`)
    .join("|");
  const touched = React.useRef(false);
  const [picked, setPicked] = useState<string[]>(savedIds);
  const [overrides, setOverrides] = useState<Record<string, number>>(savedOverrides);
  const [festivalPct, setFestivalPct] = useState<number>(() => roundToDiscountPreset(decision.new_discount ?? 20));
  const [adjustOpen, setAdjustOpen] = useState(false);
  useEffect(() => {
    if (touched.current) return;
    if (savedIds.length > 0) setPicked(savedIds);
    else if (pending) setPicked(suggestions.map((row) => row.dishId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, suggestionKey, pending]);
  useEffect(() => {
    setOverrides(savedOverrides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideKey]);
  const toggle = (id: string) => {
    touched.current = true;
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };
  const priced = (festivalDefault: number) => {
    const map: Record<string, number> = {};
    for (const id of picked) {
      const suggested = suggestions.find((row) => row.dishId === id)?.pct;
      map[id] = overrides[id] ?? suggested ?? festivalDefault;
    }
    return map;
  };
  return (
    <div>
      <ul className="vk-order-grid vk-pricing-decisions-grid no-scrollbar" style={{ margin: 0, padding: 0 }}>
        <DecisionCard
          decision={decision}
          onApprove={pending && onApprove ? (pct) => onApprove(decision.id, pct, picked, priced(pct ?? festivalPct)) : undefined}
          onReject={onReject ? () => onReject(decision.id) : undefined}
          onUpdate={onUpdate ? (pct) => onUpdate(decision.id, pct) : undefined}
          onPctChange={setFestivalPct}
          selectedCount={picked.length}
          approveLabel={pending ? (picked.length ? `Approve selected (${picked.length})` : "Tick dishes below") : undefined}
          approveDisabled={pending && picked.length === 0}
          historyLine={historyLine}
          readOnly={readOnly}
        />
      </ul>
      {readOnly ? null : (
        <FestivalDishPicker
          title={decisionDisplayName(decision)}
          picked={picked}
          overrides={overrides}
          suggestions={suggestions}
          festivalPct={festivalPct}
          onToggle={toggle}
          onOverride={(id, pct) => {
            touched.current = true;
            setOverrides((current) => ({ ...current, [id]: pct }));
          }}
          pending={pending}
          savedKey={savedKey}
          adjustOpen={adjustOpen}
          onToggleAdjust={() => setAdjustOpen((open) => !open)}
          onSave={() => onSaveDishes(festivalId, picked, priced(festivalPct))}
        />
      )}
      {pending && adjustOpen ? (
        <div className={`vk-festival-sticky${picked.length ? " is-on" : ""}`}>
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={() => onApprove?.(decision.id, festivalPct, picked, priced(festivalPct))}
          >
            {picked.length ? `Approve all selected (${picked.length})` : "Tick dishes first"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function dishKey(ids: string[]): string {
  return [...ids].sort().join(",");
}

function FestivalDishPicker({
  title,
  picked,
  overrides,
  suggestions,
  festivalPct,
  onToggle,
  onOverride,
  pending,
  savedKey,
  adjustOpen,
  onToggleAdjust,
  onSave,
}: {
  title: string;
  picked: string[];
  overrides: Record<string, number>;
  suggestions: DishSuggestion[];
  festivalPct: number;
  onToggle: (id: string) => void;
  onOverride: (id: string, pct: number) => void;
  pending: boolean;
  savedKey: string;
  adjustOpen: boolean;
  onToggleAdjust: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const dirty = dishKey(picked) !== savedKey;
  return (
    <div
      className={`vk-festival-adjust${adjustOpen ? " is-open" : ""}`}
      style={{
        marginTop: 12,
        padding: "14px 16px 16px",
        borderRadius: 16,
        border: "1px solid #2a2a2a",
        background: "#141414",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: FONT }}>
          {title} dishes
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: "#888" }}>{picked.length} selected</span>
        </p>
        {pending ? null : (
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              await onSave();
              setSaving(false);
            }}
            style={{
              height: 44,
              padding: "0 14px",
              borderRadius: 10,
              border: "none",
              background: dirty ? YELLOW : "#2a2a2a",
              color: dirty ? "#111" : "#666",
              fontSize: 13,
              fontWeight: 800,
              fontFamily: FONT,
              cursor: dirty && !saving ? "pointer" : "default",
            }}
          >
            {saving ? "Saving…" : dirty ? "Update menu" : "On the menu"}
          </button>
        )}
      </div>
      <button type="button" className="vk-festival-adjust-toggle" onClick={onToggleAdjust}>
        {picked.length} dishes selected — tap to adjust individually
      </button>
      <div className="vk-festival-adjust-body">
      <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#aaa", lineHeight: 1.45, fontFamily: FONT }}>
        {pending
          ? "Tick the dishes and set a % on any row that should differ from the festival default. One Approve applies every ticked dish."
          : "This offer is already on the menu. Change the ticks or a dish’s %, then tap Update menu."}
      </p>
      <div className="vk-festival-dish-grid">
        {MENU_CATEGORIES.map((category) => (
          <div key={category.id}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#777", fontFamily: FONT }}>
              {category.label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MENU_BY_CATEGORY[category.id].map((dish) => {
                const on = picked.includes(dish.id);
                const suggestion = suggestions.find((row) => row.dishId === dish.id);
                const pct = overrides[dish.id] ?? suggestion?.pct ?? festivalPct;
                return (
                  <div key={dish.id}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minHeight: 44,
                        padding: "0 4px",
                        cursor: "pointer",
                        color: on ? "#fff" : "#aaa",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: FONT,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(dish.id)}
                        style={{ width: 18, height: 18, accentColor: YELLOW, flexShrink: 0 }}
                      />
                      {dish.name.replace(" - ", " — ")}
                    </label>
                    {on ? (
                      <div style={{ padding: "0 0 6px 32px" }}>
                        {suggestion ? (
                          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#9cdcff", fontFamily: FONT }}>
                            {suggestion.note}
                          </p>
                        ) : null}
                        <DiscountPctPicker value={pct} suggested={suggestion?.pct ?? festivalPct} onChange={(next) => onOverride(dish.id, next)} size="sm" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

function DecisionCard({
  decision,
  onApprove,
  onReject,
  onUpdate,
  onPctChange,
  selectedCount,
  approveLabel,
  approveDisabled,
  quality,
  lowSeller,
  historyLine,
  readOnly,
}: {
  decision: Decision;
  onApprove?: (pct?: number | null) => void;
  onReject?: () => void;
  onUpdate?: (pct: number) => void | Promise<void>;
  onPctChange?: (pct: number) => void;
  selectedCount?: number;
  approveLabel?: string;
  approveDisabled?: boolean;
  quality?: boolean;
  lowSeller?: boolean;
  historyLine?: string | null;
  readOnly?: boolean;
}) {
  const isPending = decision.status === "pending" && !readOnly;
  const isLiveOffer = !readOnly && (decision.status === "applied" || decision.status === "auto_applied");
  const editableType =
    !quality &&
    (decision.decision_type === "increase_discount" ||
      decision.decision_type === "decrease_discount" ||
      decision.decision_type === "meal_boost" ||
      decision.decision_type === "festival_activate");
  const showPctPicker = editableType && (isPending || isLiveOffer);
  const [pickedPct, setPickedPct] = useState<number>(() =>
    roundToDiscountPreset(decision.new_discount ?? 20),
  );
  const [updating, setUpdating] = useState(false);
  const savedPct = roundToDiscountPreset(decision.new_discount ?? 20);
  const pctDirty = showPctPicker && pickedPct !== savedPct;

  useEffect(() => {
    setPickedPct(roundToDiscountPreset(decision.new_discount ?? 20));
  }, [decision.new_discount]);
  useEffect(() => {
    onPctChange?.(pickedPct);
  }, [pickedPct, onPctChange]);
  const name = decisionDisplayName(decision);
  const chip = historyLine
    ? { bg: "rgba(255,255,255,0.06)", color: "#aaa", border: "#333" }
    : statusChipStyle(decision.status);
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
        border: quality
          ? "1px solid rgba(245, 158, 11, 0.7)"
          : lowSeller
            ? "1px solid rgba(56, 189, 248, 0.55)"
            : isPending
              ? "1px solid rgba(245, 158, 11, 0.35)"
              : "1px solid #2a2a2a",
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
            display: "flex",
            alignItems: "center",
            gap: 8,
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
            {quality ? <AlertTriangle size={16} color="#F59E0B" style={{ flexShrink: 0 }} /> : null}
            {lowSeller && !quality ? <TrendingDown size={16} color="#38BDF8" style={{ flexShrink: 0 }} /> : null}
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
          {historyLine ? "Ended" : statusLabel(decision.status)}
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
              {historyLine || visibleReasoning(decision.reasoning)}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <div style={{ ...DETAIL_BOX, flex: 1 }}>
              <Percent size={16} color={YELLOW} strokeWidth={2.25} style={{ flexShrink: 0 }} />
              <span style={DETAIL_TEXT}>
                {decision.decision_type === "festival_activate"
                  ? isLiveOffer
                    ? "Was off"
                    : "Currently off"
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
                  ? `${isLiveOffer ? "Live" : "Activate"} ${showPctPicker ? pickedPct : (decision.new_discount ?? 20)}%${selectedCount != null ? ` · ${selectedCount} dishes` : ""}`
                  : `New ${showPctPicker ? `${pickedPct}%` : decision.new_discount != null ? `${decision.new_discount}%` : "—"}`}
              </span>
            </div>
          </div>

          {showPctPicker && (
            <div style={{ marginTop: 4 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {isPending ? "Tap a % (AI suggested highlighted)" : "Change the offer %"}
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
            <InfoChip label={quality ? "Check reviews" : lowSeller ? "Low seller" : decisionTypeLabel(decision.decision_type)} accent={Boolean(lowSeller) && !quality} />
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

          {isPending && quality && onReject ? (
            <div className="vk-order-card-actions vk-order-card-actions--single">
              <button
                type="button"
                onClick={onReject}
                className="vk-order-btn"
                style={{
                  height: 44,
                  minHeight: 44,
                  borderRadius: 10,
                  border: "1.5px solid rgba(245, 158, 11, 0.45)",
                  background: "rgba(245, 158, 11, 0.1)",
                  color: "#F59E0B",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                Dismiss
              </button>
            </div>
          ) : isPending && onApprove && onReject ? (
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
                onClick={() => {
                  if (approveDisabled) return;
                  onApprove(showPctPicker ? pickedPct : null);
                }}
                disabled={approveDisabled}
                className="vk-order-btn vk-order-btn-accept"
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: "none",
                  background: approveDisabled ? "#3a3a3a" : YELLOW,
                  color: approveDisabled ? "#777" : "#111",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: approveDisabled ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                  boxShadow: `0 4px 14px ${YELLOW}25`,
                  boxSizing: "border-box",
                }}
              >
                {approveLabel ?? "Approve"}
              </button>
            </div>
          ) : pctDirty && onUpdate ? (
            <div className="vk-order-card-actions">
              <button
                type="button"
                disabled={updating}
                onClick={async () => {
                  setUpdating(true);
                  await onUpdate(pickedPct);
                  setUpdating(false);
                }}
                className="vk-order-btn vk-order-btn-accept"
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: "none",
                  background: YELLOW,
                  color: "#111",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: updating ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                  boxShadow: `0 4px 14px ${YELLOW}25`,
                  boxSizing: "border-box",
                  opacity: updating ? 0.6 : 1,
                }}
              >
                {updating ? "Updating…" : "Update offer"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function categoryCovered(categories: string | undefined, dishId: string): boolean {
  const raw = (categories || "all").trim().toLowerCase();
  if (!raw || raw === "all") return true;
  const allowed = new Set(raw.split(",").map((part) => part.trim()));
  for (const category of MENU_CATEGORIES) {
    if (MENU_BY_CATEGORY[category.id].some((dish) => dish.id === dishId)) return allowed.has(category.id);
  }
  return false;
}

function nestTargetFestival(decisions: Decision[], festivals: FestivalWindow[]): Decision | null {
  const byId = new Map(festivals.map((festival) => [festival.id, festival]));
  const ranked = decisions
    .filter(
      (decision) =>
        decision.decision_type === "festival_activate" &&
        decision.status !== "rejected" &&
        decision.status !== "expired",
    )
    .map((decision) => {
      const festival = byId.get(festivalIdOf(decision.dish_id) || "");
      return { decision, calendar: festival ? festivalCalendarStatus(festival) : ("active" as const) };
    })
    .filter((row) => row.calendar !== "expired");
  return (
    ranked.find((row) => row.decision.status === "pending")?.decision ??
    ranked.find((row) => row.calendar === "active")?.decision ??
    null
  );
}

function suggestionsForFestival(
  decisions: Decision[],
  festivalDecision: Decision,
  festivals: Map<string, FestivalWindow>,
): DishSuggestion[] {
  const festival = festivals.get(festivalIdOf(festivalDecision.dish_id) || "");
  const out: DishSuggestion[] = [];
  for (const decision of decisions) {
    if (decision.status !== "pending") continue;
    if (decision.decision_type !== "increase_discount" && decision.decision_type !== "meal_boost") continue;
    if (isQualityDecision(decision.reasoning)) continue;
    if (decision.dish_id.startsWith("festival:")) continue;
    if (!categoryCovered(festival?.relevant_categories, decision.dish_id)) continue;
    const note = visibleReasoning(decision.reasoning);
    out.push({
      dishId: decision.dish_id,
      pct: roundToDiscountPreset(decision.new_discount ?? 20),
      note: note.length > 140 ? `${note.slice(0, 137)}…` : note,
    });
  }
  return out;
}

function historyLineFor(decision: Decision, festivals: FestivalWindow[], outcomes: OfferOutcome[]): string | null {
  const id = festivalIdOf(decision.dish_id);
  if (!id || decision.decision_type !== "festival_activate") return null;
  const festival = festivals.find((row) => row.id === id);
  if (!festival || festivalCalendarStatus(festival) !== "expired") return null;
  const rollup = outcomes.find((row) => row.dishId === `festival:${id}` && row.startDate === festival.date_start);
  const measured = rollup ? historyPerformanceLine(rollup) : null;
  if (measured) return measured;
  const pct = decision.new_discount ?? festival.discount_override;
  const from = new Date(`${festival.date_start}T12:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  const to = new Date(`${festival.date_end}T12:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  return `Ran ${from} – ${to} · ${pct}% off · orders counted after the nightly run`;
}
