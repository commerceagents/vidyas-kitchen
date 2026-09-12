"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BowlFood, ForkKnife, Minus, Plus } from "@phosphor-icons/react";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import type { MenuItem } from "@/components/ui/mobile/mobileMenuData";
import { listPriceForVariant } from "@/lib/menu/discount-pricing";
import { useActiveFestival } from "./festival-pricing-context";

export function cartLineKey(itemId: string, weight?: string | null): string {
  return weight ? `${itemId}:${weight}` : itemId;
}

export function qtyForDish(item: MenuItem, cart: Record<string, number>): number {
  return Object.entries(cart).reduce((sum, [key, q]) => {
    if (key === item.id || key.startsWith(`${item.id}:`)) return sum + q;
    return sum;
  }, 0);
}

/** Compact sizes already in the cart, e.g. "500gm" or "500gm + 1kg". */
export function dishCartSizeLabel(item: MenuItem, cart: Record<string, number>): string {
  const parts: string[] = [];
  for (const v of item.variants || []) {
    const q = cart[cartLineKey(item.id, v.weight)] || 0;
    if (q <= 0) continue;
    const label = String(v.label || v.weight || "").replace(/\s+/g, "");
    parts.push(q > 1 ? `${q}×${label}` : label);
  }
  return parts.join(" + ");
}

export function dishLineTotal(item: MenuItem, cart: Record<string, number>): number {
  return (item.variants || []).reduce((sum, v) => {
    const q = cart[cartLineKey(item.id, v.weight)] || 0;
    return sum + (v.price || 0) * q;
  }, 0);
}

function sizeServingMeta(weightOrLabel: string): { servings: string; kind: "bowl" | "meal" } {
  const s = (weightOrLabel || "").toLowerCase();
  if (/1\s*kg|1000/.test(s)) return { servings: "Serves 3–4", kind: "meal" };
  if (/500/.test(s)) return { servings: "Serves 1–2", kind: "bowl" };
  return { servings: "Flexible portion", kind: "bowl" };
}

export function SizeQtyDrawer({
  item,
  cart,
  updateQty,
  onClose,
}: {
  item: MenuItem | null;
  cart: Record<string, number>;
  updateQty: (key: string, delta: number) => void;
  onClose: () => void;
}) {
  const activeFestival = useActiveFestival();
  const lineTotal = item ? dishLineTotal(item, cart) : 0;
  const units = item ? qtyForDish(item, cart) : 0;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={`vk-size-qty-${item.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 280,
            background: "rgba(12,12,12,0.45)",
            backdropFilter: "blur(16px) saturate(160%)",
            WebkitBackdropFilter: "blur(16px) saturate(160%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 28, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vk-size-qty-title"
            style={{
              background: C.bg,
              borderRadius: "28px 28px 0 0",
              padding: "10px 24px max(20px, env(safe-area-inset-bottom))",
              boxShadow: "0 -16px 48px rgba(0,0,0,0.16)",
              maxHeight: "min(92vh, 760px)",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 4, paddingBottom: 14 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.12)" }} />
            </div>
            <h3
              id="vk-size-qty-title"
              style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.03em" }}
            >
              Size & quantity
            </h3>
            <p style={{ margin: "0 0 22px", fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.42)", lineHeight: 1.4 }}>
              {item.name.replace(" - ", " — ")}
              <span style={{ display: "block", marginTop: 4, fontWeight: 500 }}>
                Add 500gm and 1kg together if you want 1.5kg.
              </span>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(item.variants || []).map((v) => {
                const key = cartLineKey(item.id, v.weight);
                const qty = cart[key] || 0;
                const inCart = qty > 0;
                const listPrice = listPriceForVariant(item, v.id, v.price, new Date(), activeFestival);
                const meta = sizeServingMeta(v.weight || v.label || "");
                const Icon = meta.kind === "meal" ? ForkKnife : BowlFood;
                return (
                  <div
                    key={key}
                    style={{
                      padding: "18px 18px 16px",
                      borderRadius: 22,
                      background: inCart ? "rgba(189,35,32,0.04)" : C.surface,
                      border: `1.5px solid ${inCart ? C.red : C.border}`,
                      boxShadow: inCart ? `0 4px 20px ${C.redGlow}` : "0 2px 8px rgba(0,0,0,0.04)",
                      transition: "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 18,
                          background: inCart ? "rgba(189,35,32,0.12)" : "rgba(0,0,0,0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 0.3s ease",
                        }}
                      >
                        <Icon size={26} weight={inCart ? "fill" : "duotone"} color={inCart ? C.red : "rgba(0,0,0,0.45)"} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>{v.label}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.42)" }}>
                          {meta.servings}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {listPrice != null && listPrice > v.price && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: 13,
                              fontWeight: 700,
                              color: "rgba(0,0,0,0.38)",
                              textDecoration: "line-through",
                            }}
                          >
                            ₹{listPrice.toLocaleString("en-IN")}
                          </p>
                        )}
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.red, letterSpacing: "-0.03em" }}>
                          ₹{v.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.4)" }}>
                        {qty === 0 ? "Not in cart" : `${qty} in cart`}
                      </p>
                      <div
                        style={{
                          height: 44,
                          borderRadius: 999,
                          background: inCart ? C.red : "rgba(0,0,0,0.08)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 6px",
                          width: 128,
                          flexShrink: 0,
                          transition: "background 0.3s ease",
                        }}
                      >
                        <motion.button
                          type="button"
                          whileTap={{ scale: qty > 0 ? 0.85 : 1 }}
                          aria-label={`Decrease ${v.label}`}
                          disabled={qty <= 0}
                          onClick={() => qty > 0 && updateQty(key, -1)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: "none",
                            background: "transparent",
                            color: inCart ? "#fff" : "rgba(0,0,0,0.28)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: qty > 0 ? "pointer" : "default",
                          }}
                        >
                          <Minus size={16} weight="bold" />
                        </motion.button>
                        <motion.span
                          key={qty}
                          initial={{ scale: 0.8, opacity: 0.6 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                          style={{
                            flex: 1,
                            textAlign: "center",
                            fontSize: 16,
                            fontWeight: 900,
                            fontFamily: C.mono,
                            color: inCart ? "#fff" : C.text,
                          }}
                        >
                          {String(qty).padStart(2, "0")}
                        </motion.span>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.85 }}
                          aria-label={`Increase ${v.label}`}
                          onClick={() => updateQty(key, 1)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: "none",
                            background: inCart ? "rgba(255,255,255,0.22)" : C.text,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Plus size={16} weight="bold" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
              {units > 0 && (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "rgba(0,0,0,0.5)", textAlign: "center" }}>
                  {units} pack{units === 1 ? "" : "s"} · ₹{lineTotal.toLocaleString("en-IN")}
                </p>
              )}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                style={{
                  width: "100%",
                  height: 54,
                  border: "none",
                  borderRadius: 18,
                  background: C.red,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 900,
                  fontFamily: C.mono,
                  cursor: "pointer",
                  boxShadow: `0 8px 24px ${C.redGlow}`,
                }}
              >
                Done
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
