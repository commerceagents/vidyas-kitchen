"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upsertFestivalAction, type FestivalUpsertPayload } from "@/app/actions/festival-pricing";
import { festivalUiStatus, type FestivalRow, type FestivalUiStatus } from "@/lib/menu/discount-pricing";
import { DiscountPctPicker } from "@/components/dashboard/DiscountPctPicker";
import { suggestFestivalDiscountPct } from "@/lib/menu/discount-presets";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";

function statusMeta(status: FestivalUiStatus): { label: string; color: string; bg: string; border: string } {
  if (status === "live") return { label: "Live now", color: "#FACC15", bg: "rgba(250,204,21,0.12)", border: "rgba(250,204,21,0.3)" };
  if (status === "upcoming") return { label: "Upcoming", color: "#38BDF8", bg: "rgba(56,189,248,0.10)", border: "rgba(56,189,248,0.25)" };
  if (status === "ended") return { label: "Date passed", color: "#666", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" };
  return { label: "Off", color: "#888", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" };
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
  const meta = statusMeta(status);
  const isPast = status === "ended";

  return (
    <div
      style={{
        background: "#141414",
        border: f.active ? `1px solid ${YELLOW}30` : "1px solid #222",
        borderRadius: 16,
        padding: "18px 20px",
        fontFamily: FONT,
        opacity: isPast ? 0.55 : 1,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {f.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: meta.color,
                background: meta.bg,
                border: `1px solid ${meta.border}`,
              }}
            >
              {meta.label}
            </span>
            <span style={{ fontSize: 12, color: "#555" }}>
              {f.date_start === f.date_end ? f.date_start : `${f.date_start} → ${f.date_end}`}
            </span>
          </div>
        </div>

        {/* Toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: f.active ? YELLOW : "#666" }}>
            {f.active ? "On" : "Off"}
          </span>
          <div
            onClick={() => onPatch({ active: !f.active })}
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              background: f.active ? YELLOW : "#333",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: f.active ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: f.active ? "#111" : "#888",
                transition: "left 0.2s, background 0.2s",
              }}
            />
          </div>
        </label>
      </div>

      {/* % picker */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Offer %
        </p>
        <DiscountPctPicker
          value={f.discount_override}
          suggested={suggestFestivalDiscountPct(f.discount_override, f.name)}
          onChange={(pct) => onPatch({ discount_override: pct })}
          size="sm"
        />
      </div>

      {/* Badge wording */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Badge text
        </p>
        <input
          type="text"
          value={f.chip_label}
          onChange={(e) => onPatch({ chip_label: e.target.value })}
          placeholder="e.g. PONGAL OFFER"
          style={{
            width: "100%",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            outline: "none",
            fontFamily: FONT,
            boxSizing: "border-box",
          }}
        />
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        style={{
          height: 38,
          padding: "0 20px",
          borderRadius: 10,
          border: "none",
          background: YELLOW,
          color: "#111",
          fontSize: 13,
          fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.6 : 1,
          fontFamily: FONT,
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function sortFestivals(rows: FestivalRow[]): { current: FestivalRow[]; past: FestivalRow[] } {
  const today = new Date().toISOString().slice(0, 10);
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

export default function FestivalPricingPage() {
  const [rows, setRows] = useState<FestivalRow[]>([]);
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
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patchRow = (id: string, patch: Partial<FestivalRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: FestivalRow) => {
    setSavingId(r.id);
    const payload: FestivalUpsertPayload = {
      id: r.id, name: r.name, date_start: r.date_start, date_end: r.date_end,
      discount_override: r.discount_override, chip_label: r.chip_label, active: r.active,
    };
    const out = await upsertFestivalAction(payload);
    setSavingId(null);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMsg(out.ok ? "Saved." : (out.error ?? "Save failed."));
    msgTimer.current = setTimeout(() => setMsg(null), 4000);
    if (out.ok) void load();
  };

  const { current, past } = sortFestivals(rows);

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#fff", fontFamily: FONT, padding: "clamp(16px,3vw,32px)" }}>
      {/* Header */}
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "clamp(20px,2.5vw,26px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Festivals
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#555", maxWidth: 480 }}>
            Toggle on to push an offer to the app instantly. AI Pricing suggests these automatically 7 days before each festival.
          </p>
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "#1a1a1a", border: "1px solid #2a2a2a", fontSize: 13, color: "#ccc" }}>
            {msg}
          </div>
        )}

        {/* Current festivals */}
        {current.length === 0 && rows.length > 0 ? (
          <p style={{ color: "#555", fontSize: 14 }}>No upcoming festivals this year.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {current.map((f) => (
              <FestivalCard
                key={f.id}
                f={f}
                onPatch={(patch) => patchRow(f.id, patch)}
                onSave={() => save(f)}
                saving={savingId === f.id}
              />
            ))}
          </div>
        )}

        {/* Past festivals — collapsed */}
        {past.length > 0 && (
          <details style={{ marginTop: 24 }}>
            <summary style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#444", cursor: "pointer", listStyle: "none", marginBottom: 12,
            }}>
              Past festivals ({past.length})
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {past.map((f) => (
                <FestivalCard
                  key={f.id}
                  f={f}
                  onPatch={(patch) => patchRow(f.id, patch)}
                  onSave={() => save(f)}
                  saving={savingId === f.id}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
