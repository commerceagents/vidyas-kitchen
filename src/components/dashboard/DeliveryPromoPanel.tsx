"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck } from "lucide-react";
import {
  loadDeliveryPromoAction,
  saveDeliveryPromoAction,
  type DeliveryPromoUpsertPayload,
} from "@/app/actions/delivery-promo";
import { BASE_DELIVERY_INR, deliveryPromoSummary, type DeliveryPromoSettings } from "@/lib/delivery-promo";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const GREEN = "#86efac";
const BORDER = "#2a2a2a";

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

export function DeliveryPromoPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<DeliveryPromoSettings | null>(null);
  const [draft, setDraft] = useState<DeliveryPromoUpsertPayload>({
    active: false,
    discountInr: BASE_DELIVERY_INR,
    minOrderInr: 500,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await loadDeliveryPromoAction();
    if (res.ok) {
      setSaved(res.settings);
      setDraft({
        active: res.settings.active,
        discountInr: res.settings.discountInr,
        minOrderInr: res.settings.minOrderInr,
      });
      setError("");
    } else {
      setError(res.error || "Could not load delivery promo");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dirty =
    saved != null &&
    (draft.active !== saved.active ||
      draft.discountInr !== saved.discountInr ||
      draft.minOrderInr !== saved.minOrderInr);

  const save = async () => {
    setSaving(true);
    setError("");
    const res = await saveDeliveryPromoAction(draft);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Save failed");
      return;
    }
    await refresh();
  };

  if (loading) {
    return (
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <DashboardSpinner minHeight={120} />
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 16,
        flexShrink: 0,
        background: "#1a1a1a",
        borderRadius: 12,
        padding: "16px 18px",
        border: `1px solid ${draft.active ? `${GREEN}35` : BORDER}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
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
          <Truck size={17} style={{ color: draft.active ? GREEN : "#888" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: FONT }}>
                Delivery discount
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888", fontFamily: FONT }}>
                Runs until you turn it off. WhatsApp and the app both use this.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, active: !d.active }))}
              aria-pressed={draft.active}
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${draft.active ? "#f87171" : `${GREEN}50`}`,
                background: "transparent",
                color: draft.active ? "#f87171" : GREEN,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: FONT,
                cursor: "pointer",
              }}
            >
              {draft.active ? "Turn off" : "Turn on"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#888",
                  fontFamily: FONT,
                  marginBottom: 6,
                }}
              >
                Off delivery (₹)
              </span>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={BASE_DELIVERY_INR}
                value={draft.discountInr}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, discountInr: Math.round(Number(e.target.value) || 0) }))
                }
              />
            </label>
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#888",
                  fontFamily: FONT,
                  marginBottom: 6,
                }}
              >
                Min food total (₹)
              </span>
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={draft.minOrderInr}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, minOrderInr: Math.round(Number(e.target.value) || 0) }))
                }
              />
            </label>
          </div>

          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#777", fontFamily: FONT }}>
            {draft.active
              ? `Live: ${deliveryPromoSummary({
                  active: true,
                  discountInr: draft.discountInr,
                  minOrderInr: draft.minOrderInr,
                })}`
              : `Off — customers pay the usual ₹${BASE_DELIVERY_INR} delivery fee.`}
          </p>

          {error ? (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#fca5a5", fontFamily: FONT }}>{error}</p>
          ) : null}

          {dirty ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              style={{
                marginTop: 12,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${YELLOW}40`,
                background: `${YELLOW}18`,
                color: YELLOW,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: FONT,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save delivery discount"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
