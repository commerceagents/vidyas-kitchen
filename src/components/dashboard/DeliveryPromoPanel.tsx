"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck } from "lucide-react";
import {
  loadDeliveryPromoAction,
  saveDeliveryPromoAction,
  type DeliveryPromoUpsertPayload,
} from "@/app/actions/delivery-promo";
import {
  BASE_DELIVERY_INR,
  deliveryPromoFromMode,
  deliveryPromoMode,
  deliveryPromoSummary,
  type DeliveryPromoMode,
  type DeliveryPromoSettings,
} from "@/lib/delivery-promo";

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

/** Digits only — no leading zeros, so 500 stays 500 not 0500. */
function parseRupeeInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return Math.round(Number.parseInt(digits, 10));
}

function formatRupeeInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
}

type Props = {
  settings: DeliveryPromoSettings;
  loadError?: string;
};

export function DeliveryPromoPanel({ settings, loadError = "" }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(loadError);
  const [saved, setSaved] = useState<DeliveryPromoSettings>(settings);
  const [mode, setMode] = useState<DeliveryPromoMode>(() => deliveryPromoMode(settings));
  const [valueText, setValueText] = useState(() => {
    const m = deliveryPromoMode(settings);
    const n = m === "free_over_min" ? settings.minOrderInr : settings.discountInr;
    return formatRupeeInput(n);
  });
  const [draft, setDraft] = useState<DeliveryPromoUpsertPayload>(() => ({
    active: settings.active,
    discountInr: settings.discountInr,
    minOrderInr: settings.minOrderInr,
  }));

  const applyMode = useCallback((nextMode: DeliveryPromoMode, valueInr: number, active: boolean) => {
    const { discountInr, minOrderInr } = deliveryPromoFromMode(nextMode, valueInr);
    setMode(nextMode);
    setValueText(formatRupeeInput(nextMode === "free_over_min" ? minOrderInr : discountInr));
    setDraft({ active, discountInr, minOrderInr });
  }, []);

  const hydrate = useCallback(
    (next: DeliveryPromoSettings) => {
      setSaved(next);
      const nextMode = deliveryPromoMode(next);
      const valueInr = nextMode === "free_over_min" ? next.minOrderInr : next.discountInr;
      applyMode(nextMode, valueInr, next.active);
    },
    [applyMode],
  );

  useEffect(() => {
    hydrate(settings);
    setError(loadError);
  }, [settings, loadError, hydrate]);

  const dirty =
    draft.active !== saved.active ||
    draft.discountInr !== saved.discountInr ||
    draft.minOrderInr !== saved.minOrderInr;

  const updateValue = (raw: string) => {
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    const n = digits ? Number.parseInt(digits, 10) : 0;
    setValueText(digits);
    const { discountInr, minOrderInr } = deliveryPromoFromMode(mode, n);
    setDraft((d) => ({ ...d, discountInr, minOrderInr }));
  };

  const switchMode = (nextMode: DeliveryPromoMode) => {
    const fallback =
      nextMode === "free_over_min"
        ? draft.minOrderInr > 0
          ? draft.minOrderInr
          : 500
        : draft.minOrderInr > 0
          ? BASE_DELIVERY_INR
          : draft.discountInr > 0
            ? draft.discountInr
            : BASE_DELIVERY_INR;
    applyMode(nextMode, fallback, draft.active);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const n = parseRupeeInput(valueText);
    if (mode === "free_over_min" && n <= 0) {
      setSaving(false);
      setError("Enter the minimum food total for free delivery.");
      return;
    }
    if (mode === "flat_off" && n <= 0) {
      setSaving(false);
      setError("Enter how much comes off delivery.");
      return;
    }
    const { discountInr, minOrderInr } = deliveryPromoFromMode(mode, n);
    const res = await saveDeliveryPromoAction({ active: draft.active, discountInr, minOrderInr });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Save failed");
      return;
    }
    const loaded = await loadDeliveryPromoAction();
    if (loaded.ok) {
      hydrate(loaded.settings);
      setError("");
    }
  };

  const modeBtn = (id: DeliveryPromoMode, label: string, hint: string) => {
    const on = mode === id;
    return (
      <button
        type="button"
        onClick={() => switchMode(id)}
        style={{
          textAlign: "left",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${on ? `${GREEN}55` : BORDER}`,
          background: on ? `${GREEN}12` : "#222",
          color: "#fff",
          fontFamily: FONT,
          cursor: "pointer",
        }}
      >
        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{label}</span>
        <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "#888", lineHeight: 1.4 }}>{hint}</span>
      </button>
    );
  };

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
                Pick one rule. WhatsApp and the app both use it until you turn it off.
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
            {modeBtn(
              "free_over_min",
              "Free delivery over a minimum",
              `Delivery becomes ₹0 when food total hits your number. Fee is always ₹${BASE_DELIVERY_INR}.`,
            )}
            {modeBtn(
              "flat_off",
              "Flat amount off delivery",
              `Same rupee cut on every order — no minimum food total.`,
            )}
          </div>

          <label style={{ display: "block", marginTop: 14 }}>
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
              {mode === "free_over_min" ? "Minimum food total (₹)" : "Off delivery (₹)"}
            </span>
            <input
              style={inputStyle}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={mode === "free_over_min" ? "500" : String(BASE_DELIVERY_INR)}
              value={valueText}
              onChange={(e) => updateValue(e.target.value)}
              onBlur={() => setValueText(formatRupeeInput(parseRupeeInput(valueText)))}
            />
          </label>

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
