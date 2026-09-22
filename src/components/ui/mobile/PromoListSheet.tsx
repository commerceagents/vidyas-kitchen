"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "@phosphor-icons/react";

export type PublicPromo = {
  id: string;
  name: string;
  kind: "auto" | "code";
  code: string | null;
  terms: string;
  amount: number;
  eligible: boolean;
  reason: string | null;
  endsOn: string | null;
};

const FONT = "var(--font-outfit), system-ui, sans-serif";

function untilLabel(ymd: string | null): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.slice(0, 10))) return null;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `Until ${label}`;
}

/**
 * The list behind "View promos". Codes the kitchen has switched on, plus
 * festival discounts that apply on their own.
 */
export function PromoListSheet({
  open,
  promos,
  loading,
  onClose,
  onApply,
}: {
  open: boolean;
  promos: PublicPromo[];
  loading: boolean;
  onClose: () => void;
  onApply: (code: string) => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="vk-promos"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 11000,
            background: "rgba(12,12,12,0.48)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vk-promos-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "78dvh",
              overflow: "auto",
              background: "#fff",
              borderRadius: "24px 24px 0 0",
              padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
              fontFamily: FONT,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id="vk-promos-title" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                  Promos
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>
                  Offers running right now. Tap one to use it on this order.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: "none",
                  background: "rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {loading ? (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.45)" }}>
                  Checking offers…
                </p>
              ) : promos.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.55)", lineHeight: 1.5 }}>
                  No promos right now. When a festive code is on, it shows up here — you don’t have to catch the Instagram post.
                </p>
              ) : (
                promos.map((promo) => {
                  const until = untilLabel(promo.endsOn);
                  return (
                    <div
                      key={promo.id}
                      style={{
                        borderRadius: 16,
                        border: "1px solid rgba(0,0,0,0.08)",
                        padding: "14px 14px 12px",
                        background: promo.eligible ? "rgba(22,140,80,0.06)" : "#fff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{promo.name}</p>
                        {promo.code ? (
                          <span
                            style={{
                              flexShrink: 0,
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: "0.06em",
                              color: "#BD2320",
                              background: "rgba(189,35,32,0.08)",
                              borderRadius: 8,
                              padding: "4px 8px",
                            }}
                          >
                            {promo.code}
                          </span>
                        ) : (
                          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: "#12784A" }}>
                            No code
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.55)" }}>
                        {promo.terms}
                        {until ? ` · ${until}` : ""}
                      </p>
                      {promo.kind === "auto" ? (
                        <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: "#12784A" }}>
                          {promo.eligible
                            ? `Already on this bill — you save ₹${promo.amount.toLocaleString("en-IN")}`
                            : promo.reason}
                        </p>
                      ) : promo.eligible ? (
                        <button
                          type="button"
                          onClick={() => promo.code && onApply(promo.code)}
                          style={{
                            marginTop: 10,
                            height: 40,
                            padding: "0 16px",
                            border: "none",
                            borderRadius: 12,
                            background: "#BD2320",
                            color: "#fff",
                            fontFamily: FONT,
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Use {promo.code}
                        </button>
                      ) : (
                        <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: "#BD2320" }}>
                          {promo.reason}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
