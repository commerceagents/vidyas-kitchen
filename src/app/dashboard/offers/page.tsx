"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Tag, Ticket, Trash2 } from "lucide-react";
import {
  deleteOfferAction,
  listOffersAction,
  setOfferActiveAction,
  upsertOfferAction,
  type OfferUpsertPayload,
} from "@/app/actions/offers";
import { isOfferLive, offerTerms, type OfferRow } from "@/lib/offers";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
} from "@/components/dashboard/DashboardChrome";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const CARD_BG = "#1a1a1a";
const BORDER = "#2a2a2a";
const GREEN = "#86efac";

type Draft = OfferUpsertPayload & { id: string | null };

const BLANK: Draft = {
  id: null,
  name: "",
  kind: "auto",
  code: "",
  value_type: "percent",
  value: 10,
  min_order: 0,
  max_discount: null,
  starts_on: null,
  ends_on: null,
  usage_limit: null,
  per_customer_limit: null,
  active: true,
};

const inputStyle: React.CSSProperties = {
  background: "#222",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "9px 12px",
  color: "#fff",
  fontSize: 14,
  fontFamily: FONT,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#888",
  fontFamily: FONT,
  marginBottom: 6,
  display: "block",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

function windowText(o: OfferRow): string {
  if (!o.starts_on && !o.ends_on) return "Always on";
  if (o.starts_on && o.ends_on) return `${o.starts_on} → ${o.ends_on}`;
  if (o.starts_on) return `From ${o.starts_on}`;
  return `Until ${o.ends_on}`;
}

export default function OffersPage() {
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

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = useCallback(async () => {
    const { ok, rows, error } = await listOffersAction();
    setOffers(ok ? rows : []);
    setListError(ok ? "" : error || "Could not load offers");
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setFormError("");
    const res = await upsertOfferAction(draft);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error || "Save failed");
      return;
    }
    setDraft(null);
    await refresh();
  };

  const remove = async (o: OfferRow) => {
    if (!confirm(`Delete "${o.name}"? Orders that already used it keep their discount.`)) return;
    const res = await deleteOfferAction(o.id);
    if (!res.ok) {
      alert(res.error || "Could not delete");
      return;
    }
    await refresh();
  };

  const toggle = async (o: OfferRow) => {
    setOffers((prev) => prev.map((r) => (r.id === o.id ? { ...r, active: !r.active } : r)));
    const res = await setOfferActiveAction(o.id, !o.active);
    if (!res.ok) {
      alert(res.error || "Could not update");
      await refresh();
    }
  };

  const liveCount = useMemo(() => offers.filter((o) => isOfferLive(o)).length, [offers]);

  const editor = draft && (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${YELLOW}40`,
        borderRadius: 14,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {(["auto", "code"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setDraft({ ...draft, kind: k })}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${draft.kind === k ? YELLOW : BORDER}`,
              background: draft.kind === k ? `${YELLOW}18` : "transparent",
              color: draft.kind === k ? YELLOW : "#aaa",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONT,
              cursor: "pointer",
            }}
          >
            {k === "auto" ? "Festival / seasonal" : "Promo code"}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#888", fontFamily: FONT, lineHeight: 1.5 }}>
        {draft.kind === "auto"
          ? "Applies on its own to every order inside the dates below. Use this for Diwali, Pongal and seasonal pushes."
          : "Only applies when the customer types the code at checkout. Share it on WhatsApp, Instagram or a flyer."}
      </p>

      <Field label="Offer name (customers see this)">
        <input
          style={inputStyle}
          value={draft.name}
          placeholder={draft.kind === "auto" ? "Diwali Special" : "Welcome offer"}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Field>

      {draft.kind === "code" && (
        <Field label="Code">
          <input
            style={{ ...inputStyle, letterSpacing: "0.08em", fontWeight: 700 }}
            value={draft.code}
            placeholder="DIWALI50"
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
          />
        </Field>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Discount type">
          <select
            style={inputStyle}
            value={draft.value_type}
            onChange={(e) =>
              setDraft({ ...draft, value_type: e.target.value as Draft["value_type"] })
            }
          >
            <option value="percent">Percent off</option>
            <option value="flat">Flat ₹ off</option>
          </select>
        </Field>
        <Field label={draft.value_type === "percent" ? "Percent (max 90)" : "Rupees off"}>
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            value={String(draft.value)}
            onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Minimum order ₹">
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            value={String(draft.min_order)}
            placeholder="0"
            onChange={(e) => setDraft({ ...draft, min_order: Number(e.target.value) || 0 })}
          />
        </Field>
        {draft.value_type === "percent" && (
          <Field label="Cap the discount at ₹">
            <input
              style={inputStyle}
              type="number"
              inputMode="numeric"
              value={draft.max_discount == null ? "" : String(draft.max_discount)}
              placeholder="No cap"
              onChange={(e) => setDraft({ ...draft, max_discount: numOrNull(e.target.value) })}
            />
          </Field>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Starts on">
          <input
            style={inputStyle}
            type="date"
            value={draft.starts_on ?? ""}
            onChange={(e) => setDraft({ ...draft, starts_on: e.target.value || null })}
          />
        </Field>
        <Field label="Ends on">
          <input
            style={inputStyle}
            type="date"
            value={draft.ends_on ?? ""}
            onChange={(e) => setDraft({ ...draft, ends_on: e.target.value || null })}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Total uses">
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            value={draft.usage_limit == null ? "" : String(draft.usage_limit)}
            placeholder="Unlimited"
            onChange={(e) => setDraft({ ...draft, usage_limit: numOrNull(e.target.value) })}
          />
        </Field>
        <Field label="Uses per customer">
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            value={draft.per_customer_limit == null ? "" : String(draft.per_customer_limit)}
            placeholder="Unlimited"
            onChange={(e) => setDraft({ ...draft, per_customer_limit: numOrNull(e.target.value) })}
          />
        </Field>
      </div>

      {formError && (
        <div style={{ color: "#f87171", fontSize: 13, fontFamily: FONT }}>{formError}</div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{
            flex: 1,
            padding: "11px 16px",
            borderRadius: 10,
            border: "none",
            background: YELLOW,
            color: "#111",
            fontSize: 14,
            fontWeight: 800,
            fontFamily: FONT,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving..." : draft.id ? "Save changes" : "Create offer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setFormError("");
          }}
          style={{
            padding: "11px 18px",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: "transparent",
            color: "#aaa",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: FONT,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const content = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, color: "#888", fontFamily: FONT }}>
          {liveCount} running now
        </span>
        {!draft && (
          <button
            type="button"
            onClick={() => {
              setDraft({ ...BLANK });
              setFormError("");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: `1px solid ${YELLOW}40`,
              borderRadius: 10,
              padding: "8px 14px",
              color: YELLOW,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: FONT,
              flexShrink: 0,
            }}
          >
            <Plus size={14} /> New offer
          </button>
        )}
      </div>

      {loading ? (
        <DashboardSpinner minHeight="100%" />
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1, minHeight: 0 }}
        >
          {editor}

          {listError && (
            <div
              style={{
                color: "#fca5a5",
                fontSize: 13,
                fontFamily: FONT,
                padding: "12px 14px",
                border: "1px solid #7f1d1d",
                borderRadius: 12,
                background: "#2a1212",
                lineHeight: 1.5,
              }}
            >
              {listError}
            </div>
          )}

          {!listError && offers.length === 0 && !draft && (
            <div
              style={{
                flex: 1,
                minHeight: 240,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              <Tag size={56} color="#FACC15" strokeWidth={1.2} style={{ marginBottom: 16 }} />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#666", fontFamily: FONT }}>
                No offers yet
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", fontFamily: FONT }}>
                Tap New offer to run a festival discount or hand out a promo code.
              </p>
            </div>
          )}

          {offers.map((o) => {
            const live = isOfferLive(o);
            return (
              <div
                key={o.id}
                style={{
                  background: CARD_BG,
                  borderRadius: 12,
                  padding: "14px 16px",
                  border: `1px solid ${live ? `${GREEN}35` : BORDER}`,
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#333",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {o.kind === "code" ? (
                    <Ticket size={17} style={{ color: "#888" }} />
                  ) : (
                    <Tag size={17} style={{ color: "#888" }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: FONT }}>
                      {o.name}
                    </span>
                    {o.code && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          color: YELLOW,
                          background: `${YELLOW}18`,
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontFamily: FONT,
                        }}
                      >
                        {o.code}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: live ? GREEN : "#777",
                        fontFamily: FONT,
                      }}
                    >
                      {live ? "RUNNING" : o.active ? "SCHEDULED" : "OFF"}
                    </span>
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 13, color: "#bbb", fontFamily: FONT }}>
                    {offerTerms(o)}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#777", fontFamily: FONT }}>
                    {windowText(o)} · used {o.used_count}
                    {o.usage_limit != null ? ` of ${o.usage_limit}` : ""}
                    {o.per_customer_limit != null ? ` · ${o.per_customer_limit} per customer` : ""}
                  </p>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => void toggle(o)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${BORDER}`,
                        background: "transparent",
                        color: o.active ? "#aaa" : GREEN,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: FONT,
                        cursor: "pointer",
                      }}
                    >
                      {o.active ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError("");
                        setDraft({
                          id: o.id,
                          name: o.name,
                          kind: o.kind,
                          code: o.code ?? "",
                          value_type: o.value_type,
                          value: o.value,
                          min_order: o.min_order,
                          max_discount: o.max_discount,
                          starts_on: o.starts_on,
                          ends_on: o.ends_on,
                          usage_limit: o.usage_limit,
                          per_customer_limit: o.per_customer_limit,
                          active: o.active,
                        });
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${YELLOW}40`,
                        background: "transparent",
                        color: YELLOW,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: FONT,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void remove(o)}
                  aria-label={`Delete ${o.name}`}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    padding: 4,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile */}
      <div
        className="vk-dash-home-mobile"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          minHeight: "100dvh",
          background: "#0d0d0d",
        }}
      >
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
          unreadCount={unreadCount}
          onOpenNotifications={openNotifications}
        />
        <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: FONT }}>
            Offers
          </h2>
          {content}
        </div>
      </div>

      {/* Desktop */}
      <div
        className="vk-dash-home-desktop"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          gap: "clamp(12px, 1.5vw, 20px)",
          background: "#0d0d0d",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
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
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(16px, 1.5vw, 22px)",
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "var(--font-outfit)",
              letterSpacing: "-0.02em",
            }}
          >
            Offers
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
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{content}</div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-home-mobile {
            display: flex !important;
          }
          .vk-dash-home-desktop {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .vk-dash-home-mobile {
            display: none !important;
          }
          .vk-dash-home-desktop {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
