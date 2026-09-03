"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CalendarDays, CheckCircle2, Clock, Pause } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { upsertFestivalAction, type FestivalUpsertPayload } from "@/app/actions/festival-pricing";
import { festivalUiStatus, type FestivalRow, type FestivalUiStatus } from "@/lib/menu/discount-pricing";
import { DiscountPctPicker } from "@/components/dashboard/DiscountPctPicker";
import { suggestFestivalDiscountPct } from "@/lib/menu/discount-presets";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
  DashboardNotificationPanel,
} from "@/components/dashboard/DashboardChrome";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const CARD_BG = "#1a1a1a";
const BORDER = "#2a2a2a";
const CARD_PAD = "clamp(16px, 2vw, 22px)";

const DETAIL_BOX: CSSProperties = {
  background: "#222",
  borderRadius: 12,
  padding: "12px 14px",
  border: "1px solid #2a2a2a",
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

function todayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatFestivalDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusChip(status: FestivalUiStatus): { label: string; bg: string; color: string; border: string } {
  if (status === "live") {
    return { label: "Live now", bg: "rgba(250, 204, 21, 0.12)", color: "#FACC15", border: "rgba(250, 204, 21, 0.35)" };
  }
  if (status === "upcoming") {
    return { label: "Upcoming", bg: "rgba(56, 189, 248, 0.12)", color: "#38BDF8", border: "rgba(56, 189, 248, 0.35)" };
  }
  if (status === "ended") {
    return { label: "Date passed", bg: "rgba(102, 102, 102, 0.12)", color: "#888", border: "rgba(102, 102, 102, 0.35)" };
  }
  return { label: "Off", bg: "rgba(255,255,255,0.04)", color: "#888", border: "1px solid #333" };
}

function sortFestivals(rows: FestivalRow[]): { current: FestivalRow[]; past: FestivalRow[] } {
  const today = todayYmd();
  const order: Record<FestivalUiStatus, number> = { live: 0, upcoming: 1, off: 2, ended: 3 };
  const sorted = [...rows].sort((a, b) => {
    const sa = festivalUiStatus(a);
    const sb = festivalUiStatus(b);
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    return a.date_start.localeCompare(b.date_start);
  });
  return {
    current: sorted.filter((f) => f.date_end >= today || f.active),
    past: sorted.filter((f) => f.date_end < today && !f.active),
  };
}

function FestivalCard({
  f,
  onPatch,
  onSave,
  saving,
}: {
  f: FestivalRow;
  onPatch: (patch: Partial<FestivalRow>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const status = festivalUiStatus(f);
  const chip = statusChip(status);
  const dateLabel =
    f.date_start === f.date_end
      ? formatFestivalDate(f.date_start)
      : `${formatFestivalDate(f.date_start)} – ${formatFestivalDate(f.date_end)}`;

  return (
    <li
      className="vk-order-card"
      style={{
        borderRadius: 18,
        border: f.active ? "1px solid rgba(245, 227, 45, 0.28)" : `1px solid ${BORDER}`,
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
          {f.name}
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
          {chip.label}
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
          <div style={DETAIL_BOX}>
            <CalendarDays size={16} color={YELLOW} strokeWidth={2.25} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {dateLabel}
            </span>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Offer %
            </p>
            <DiscountPctPicker
              value={f.discount_override}
              suggested={suggestFestivalDiscountPct(f.discount_override, f.name)}
              onChange={(pct) => onPatch({ discount_override: pct })}
              size="sm"
            />
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Badge text
            </p>
            <input
              type="text"
              value={f.chip_label}
              onChange={(e) => onPatch({ chip_label: e.target.value })}
              placeholder="e.g. PONGAL OFFER"
              style={{
                width: "100%",
                background: "#222",
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                outline: "none",
                fontFamily: FONT,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div
          className="vk-order-card-footer"
          style={{ marginTop: "auto", paddingTop: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
        >
          <button
            type="button"
            onClick={() => onPatch({ active: !f.active })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 6,
              border: f.active ? `1px solid ${YELLOW}35` : "1px solid #444",
              background: f.active ? `${YELLOW}14` : "rgba(102, 102, 102, 0.08)",
              color: f.active ? YELLOW : "#888",
              fontSize: 11,
              fontWeight: 800,
              fontFamily: FONT,
              cursor: "pointer",
              letterSpacing: "0.2px",
              lineHeight: 1.2,
            }}
          >
            {f.active ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              height: 44,
              minWidth: 110,
              borderRadius: 10,
              border: "none",
              background: YELLOW,
              color: "#111",
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: FONT,
              boxShadow: `0 4px 14px ${YELLOW}25`,
              opacity: saving ? 0.6 : 1,
              boxSizing: "border-box",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </li>
  );
}

function MetricTabs({
  cards,
}: {
  cards: { id: string; label: string; value: string; icon: LucideIcon; color: string; bg: string }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: "clamp(10px, 1.2vw, 16px)",
        width: "100%",
        fontFamily: FONT,
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
                  fontSize: "clamp(16px, 1.5vw, 20px)",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
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

export default function FestivalPricingPage() {
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

  const [rows, setRows] = useState<FestivalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/menu/festivals", { cache: "no-store" });
      const j = (await res.json()) as { rows?: FestivalRow[] };
      setRows(j.rows ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchRow = (id: string, patch: Partial<FestivalRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: FestivalRow) => {
    setSavingId(r.id);
    const payload: FestivalUpsertPayload = {
      id: r.id,
      name: r.name,
      date_start: r.date_start,
      date_end: r.date_end,
      discount_override: r.discount_override,
      chip_label: r.chip_label,
      active: r.active,
    };
    const out = await upsertFestivalAction(payload);
    setSavingId(null);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMsg(out.ok ? "Saved." : (out.error ?? "Save failed."));
    msgTimer.current = setTimeout(() => setMsg(null), 4000);
    if (out.ok) void load();
  };

  const openNotifications = () => {
    setNotifOpen(true);
    markAllRead();
  };

  const { current, past } = sortFestivals(rows);
  const liveCount = rows.filter((f) => festivalUiStatus(f) === "live").length;
  const upcomingCount = rows.filter((f) => {
    const s = festivalUiStatus(f);
    return s === "upcoming" || (s === "off" && f.date_end >= todayYmd());
  }).length;
  const offCount = rows.filter((f) => festivalUiStatus(f) === "off").length;
  const pastCount = past.length;

  const metricCards = [
    { id: "live", label: "Live now", value: String(liveCount), icon: CheckCircle2, color: "#FACC15", bg: "rgba(250, 204, 21, 0.08)" },
    { id: "upcoming", label: "Upcoming", value: String(upcomingCount), icon: CalendarDays, color: "#38BDF8", bg: "rgba(56, 189, 248, 0.08)" },
    { id: "off", label: "Off", value: String(offCount), icon: Pause, color: "#888", bg: "rgba(102, 102, 102, 0.08)" },
    { id: "past", label: "Past", value: String(pastCount), icon: Clock, color: "#666", bg: "rgba(102, 102, 102, 0.08)" },
  ];

  const content = loading ? (
    <DashboardSpinner minHeight="100%" />
  ) : current.length === 0 && past.length === 0 ? (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", boxSizing: "border-box" }}>
      <CalendarDays size={56} color="#FACC15" strokeWidth={1.2} style={{ marginBottom: 16 }} />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#666", fontFamily: FONT }}>No festivals yet</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", fontFamily: FONT }}>Run the festivals SQL patch in Supabase to load the calendar</p>
    </div>
  ) : (
    <div className="no-scrollbar" style={{ overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 20 }}>
      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD_BG, fontSize: 13, color: "#ccc", fontFamily: FONT }}>
          {msg}
        </div>
      )}
      {current.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F59E0B", fontFamily: FONT }}>
            Upcoming & live
          </p>
          <ul className="vk-order-grid vk-festival-grid" style={{ margin: 0, padding: 0 }}>
            {current.map((f) => (
              <FestivalCard
                key={f.id}
                f={f}
                onPatch={(patch) => patchRow(f.id, patch)}
                onSave={() => void save(f)}
                saving={savingId === f.id}
              />
            ))}
          </ul>
        </div>
      )}
      {past.length > 0 && (
        <details>
          <summary
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#555",
              fontFamily: FONT,
              cursor: "pointer",
              listStyle: "none",
              marginBottom: 10,
            }}
          >
            Past festivals ({past.length})
          </summary>
          <ul className="vk-order-grid vk-festival-grid" style={{ margin: 0, padding: 0 }}>
            {past.map((f) => (
              <FestivalCard
                key={f.id}
                f={f}
                onPatch={(patch) => patchRow(f.id, patch)}
                onSave={() => void save(f)}
                saving={savingId === f.id}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  return (
    <>
      <div
        className="vk-dash-home-mobile"
        style={{ display: "none", flexDirection: "column", height: "100%", minHeight: "100dvh", background: "#0d0d0d" }}
      >
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
        />
        <div className="no-scrollbar" style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: FONT }}>Festivals</h2>
          <MetricTabs cards={metricCards} />
          {content}
        </div>
      </div>

      <div
        className="vk-dash-home-desktop"
        style={{ display: "none", flexDirection: "column", height: "100%", gap: "clamp(12px, 1.5vw, 20px)", background: "#0d0d0d", boxSizing: "border-box", overflow: "hidden" }}
      >
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
          <h1 style={{ margin: 0, fontSize: "clamp(16px, 1.5vw, 22px)", fontWeight: 800, color: "#ffffff", fontFamily: "var(--font-outfit)", letterSpacing: "-0.02em" }}>
            Festivals
          </h1>
          <DashboardDesktopTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
            unreadCount={unreadCount}
            onOpenNotifications={openNotifications}
            hideSearchAndMonth
          />
        </div>

        <MetricTabs cards={metricCards} />

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
          .vk-festival-grid {
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
