"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Minus, Plus, MapPin, Lightning, CreditCard, Money, ArrowRight } from "@phosphor-icons/react";

import { loadSavedPlaces, type SavedPlace } from "@/lib/vk-saved-places";
import {
  type DeliverySlotKind,
  iterDeliveryDateOptions,
  slotCardsForIstDate,
  isOrderingWindowOpen,
} from "@/lib/delivery-slots";
import { TYPO } from "@/components/ui/mobile/mobile-typography";

// ─── Design Tokens ─────────────────────────────────────────────────────────
const C = {
  bg:           "#F5F5F7",
  surface:      "rgba(255,255,255,0.72)",
  glass:        "rgba(255,255,255,0.55)",
  border:       "rgba(0,0,0,0.06)",
  red:          "#BD2320",
  redGlow:      "rgba(189,35,32,0.25)",
  white:        "#ffffff",
  text:         "#1A1A1A",
  mono:         "var(--font-outfit), system-ui, -apple-system, sans-serif",
};

const sp = (n: number) => n * 8;

/** Wait until the browser has painted (so loading UI can appear before heavy work / redirect). */
function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/(?:^|\s|\(|\/)\w/g, match => match.toUpperCase());
}

/** Same as home — strip (MOM'S RECIPE) etc. for layout; tag becomes a chip. */
function parseRecipeTag(name: string) {
  const regex = /[\(]?((?:MOM'S|SISTER'S|SISTER-IN-LAW'S|GRANDMA'S|GRANDMA|CHEFS)\s+RECIPE)[\)]?/i;
  const match = name.match(regex);
  if (match) {
    const tag = match[1].trim();
    const cleanName = name.replace(match[0], "").trim();
    return { cleanName, tag };
  }
  return { cleanName: name, tag: null };
}

import { MenuItem } from "@/components/ui/mobile/mobileMenuData";

interface CheckoutScreenProps {
  onBack: () => void;
  cart: Record<string, number>;
  items: MenuItem[];
  updateQty: (id: string, delta: number) => void;
  locationLabel: string;
  onChangeLocation: () => void;
  /** Apply a saved place from map flow (Home / Work / Other) when configured. */
  onSelectSavedLocation?: (place: SavedPlace) => void;
  onAddMore: () => void;
  phone: string;
  customerName: string;
  /** Pin saved at location step — stored on order for driver proximity + map. */
  deliveryLat?: number;
  deliveryLng?: number;
}

export function CheckoutScreen({
  onBack,
  cart,
  items,
  updateQty,
  locationLabel,
  onChangeLocation,
  onSelectSavedLocation,
  onAddMore,
  phone,
  customerName,
  deliveryLat,
  deliveryLng,
}: CheckoutScreenProps) {
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const dayOptions = useMemo(() => iterDeliveryDateOptions(14), []);
  const [deliveryDateYmd, setDeliveryDateYmd] = useState(() => dayOptions[0]?.istYmd ?? "");
  const [slotKind, setSlotKind] = useState<DeliverySlotKind | null>(null);

  /** Changing day clears slot so the user must explicitly pick a meal window. */
  useEffect(() => {
    setSlotKind(null);
  }, [deliveryDateYmd]);

  const slotCards = useMemo(() => slotCardsForIstDate(deliveryDateYmd), [deliveryDateYmd]);

  const refreshSavedPlaces = useCallback(() => {
    setSavedPlaces(
      loadSavedPlaces().filter((p) => p.lat !== 0 && p.lng !== 0),
    );
  }, []);

  useEffect(() => {
    refreshSavedPlaces();
    window.addEventListener("focus", refreshSavedPlaces);
    return () => window.removeEventListener("focus", refreshSavedPlaces);
  }, [refreshSavedPlaces]);

  // Filter items that are in cart with variant support
  const cartEntries = useMemo(() => {
    return Object.entries(cart).map(([key, qty]) => {
      const [id, weight] = key.split(":");
      const item = items.find(i => i.id === id);
      if (!item) return null;
      const variant = item.variants?.find(v => v.weight === weight);
      if (!variant) return null;
      return { 
        key, // item.id:weight
        id: item.id,
        variantId: variant.id,
        name: item.name,
        price: variant.price,
        weight: variant.weight,
        weightLabel: variant.label,
        quantity: qty 
      };
    }).filter(Boolean) as { key: string; id: string; variantId: string; name: string; price: number; weight: string; weightLabel: string; quantity: number }[];
  }, [cart, items]);

  const itemTotal = cartEntries.reduce((acc, it) => acc + it.price * it.quantity, 0);
  
  // Static charges as discussed
  const packagingFee = 20;
  const deliveryFee  = 35;
  const tax          = Math.round(itemTotal * 0.05); // 5% GST
  const grandTotal   = itemTotal + packagingFee + deliveryFee + tax;
  const orderCtaDisabled = placing || slotKind == null || !isOrderingWindowOpen();

  const handlePlaceOrder = async () => {
    if (paymentMethod === "cod") {
      setCheckoutError("Cash on delivery isn’t available for online checkout yet.");
      return;
    }
    if (!phone.trim()) {
      setCheckoutError("Missing phone. Please sign in again.");
      return;
    }
    if (!slotKind) {
      setCheckoutError("Choose an available delivery slot.");
      return;
    }
    if (!isOrderingWindowOpen()) {
      setCheckoutError("Ordering is only open between 6 AM and 6 PM IST.");
      return;
    }
    setCheckoutError(null);
    setPlacing(true);
    await waitForPaint();
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          customerName: customerName.trim() || "Customer",
          deliveryAddress: locationLabel,
          deliveryDate: deliveryDateYmd,
          deliverySlot: slotKind,
          paymentMethod,
          lines: cartEntries.map((it) => ({ menuItemId: it.variantId, quantity: it.quantity, variant: it.weight, weightLabel: it.weightLabel })),
          ...(typeof deliveryLat === "number" &&
          typeof deliveryLng === "number" &&
          Number.isFinite(deliveryLat) &&
          Number.isFinite(deliveryLng)
            ? { deliveryLat, deliveryLng }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; paymentUrl?: string };
      if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`);
      if (!data.paymentUrl) throw new Error("No payment URL returned");
      try {
        sessionStorage.setItem("vk_pending_checkout_cart", JSON.stringify({ cart }));
      } catch {
        /* noop */
      }
      window.location.assign(data.paymentUrl);
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Something went wrong");
      setPlacing(false);
    }
  };

  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring" as const, stiffness: 350, damping: 30 },
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bg, zIndex: 200,
      display: "flex", flexDirection: "column", color: C.text,
      fontFamily: C.mono, overflow: "hidden",
      filter: isOrderingWindowOpen() ? "none" : "grayscale(0.9) opacity(0.6)",
      transition: "filter 0.5s ease, opacity 0.5s ease",
    }}>
      {/* ── Header (centered title, back balances width) ─────────────────── */}
      <div style={{
        padding: `max(16px, env(safe-area-inset-top)) ${sp(2.5)}px 16px`,
        display: "grid",
        gridTemplateColumns: "44px 1fr 44px",
        alignItems: "center",
        columnGap: 10,
        background: `linear-gradient(to bottom, ${C.bg} 80%, transparent)`,
        flexShrink: 0, zIndex: 10,
      }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: C.surface, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={20} weight="bold" color={C.text} />
        </motion.button>
        <h2 style={{ ...TYPO.title, margin: 0, textAlign: "center" }}>Checkout</h2>
        <div style={{ width: 44 }} aria-hidden />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: `0 ${sp(2.5)}px 140px` }} className="no-scrollbar">
        
        {/* ── Cart Items ──────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ ...TYPO.sectionTitle, margin: 0, opacity: 0.72 }}>Your Order</h3>
            <button 
              onClick={onAddMore}
              style={{
                background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                color: C.red, cursor: "pointer"
              }}
            >
              + Add more
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cartEntries.map((item) => {
              const { cleanName, tag } = parseRecipeTag(item.name);
              return (
              <div key={item.key} style={{
                background: C.surface, borderRadius: 18,
                padding: "12px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                gap: 12,
                border: `1px solid ${C.border}`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{toTitleCase(cleanName)}</p>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.4)", fontFamily: C.mono }}>
                      ({item.weightLabel})
                    </span>
                  </div>
                  {tag ? (
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        padding: "3px 9px",
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.03em",
                        background: "rgba(189,35,32,0.14)",
                        border: "1px solid rgba(189,35,32,0.32)",
                        color: C.red,
                        fontFamily: C.mono,
                        lineHeight: 1.3,
                      }}
                    >
                      {toTitleCase(tag)}
                    </span>
                  ) : null}
                  <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 800, color: C.text }}>₹{item.price}</p>
                </div>

                <div style={{
                  height: 32, borderRadius: 16, background: C.red, display: "flex",
                  alignItems: "center", justifyContent: "space-between", padding: "0 4px",
                  boxShadow: "0 4px 12px rgba(189,35,32,0.4)", width: 80, flexShrink: 0,
                  alignSelf: "center",
                }}>
                  <button onClick={() => updateQty(item.key, -1)} style={{ background: "none", border: "none", color: "white", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Minus size={12} weight="bold" color="white" />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 900 }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.key, 1)} style={{ background: "none", border: "none", color: "white", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={12} weight="bold" color="white" />
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        </motion.section>

        {/* ── Address ─────────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ transitionDelay: "0.1s", marginTop: 32 }}>
          <h3 style={{ ...TYPO.sectionTitle, margin: "0 0 12px", opacity: 0.72 }}>Delivery To</h3>
          <div style={{
            background: C.surface, borderRadius: 18,
            padding: "16px", display: "flex", alignItems: "center", gap: 14,
            border: `1px solid ${C.border}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: "rgba(189,35,32,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <MapPin size={20} weight="fill" color={C.red} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{locationLabel}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>
                Scheduled meal · pick your date & slot below
              </p>
            </div>
            <button onClick={onChangeLocation} style={{ background: "none", border: "none", color: C.red, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Change</button>
          </div>
          {savedPlaces.length > 0 && onSelectSavedLocation && (
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                marginTop: 10,
                paddingBottom: 4,
                WebkitOverflowScrolling: "touch",
              }}
              className="no-scrollbar"
            >
              {savedPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => onSelectSavedLocation(place)}
                  style={{
                    flex: "0 0 auto",
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    color: C.text,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: C.mono,
                  }}
                >
                  {place.label}
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Delivery date & slots (24h rule) ─────────────────────────────── */}
        <motion.section {...fadeUp} style={{ transitionDelay: "0.11s", marginTop: 28 }}>
          <h3 style={{ ...TYPO.sectionTitle, margin: "0 0 10px", opacity: 0.72 }}>
            Delivery day
          </h3>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
              WebkitOverflowScrolling: "touch",
            }}
            className="no-scrollbar"
          >
            {dayOptions.map((d) => {
              const hasAny = d.cards.some((c) => c.available);
              const on = d.istYmd === deliveryDateYmd;
              return (
                <button
                  key={d.istYmd}
                  type="button"
                  disabled={!hasAny}
                  onClick={() => setDeliveryDateYmd(d.istYmd)}
                  style={{
                    flex: "0 0 auto",
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: `1.5px solid ${on ? C.red : "rgba(0,0,0,0.08)"}`,
                    background: on ? "rgba(189,35,32,0.08)" : C.surface,
                    color: hasAny ? C.text : "rgba(0,0,0,0.35)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: hasAny ? "pointer" : "not-allowed",
                    fontFamily: C.mono,
                  }}
                >
                  {d.weekendLabel}
                </button>
              );
            })}
          </div>
          <h3 style={{ ...TYPO.sectionTitle, margin: "18px 0 8px", opacity: 0.72 }}>
            Meal time
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "rgba(0,0,0,0.4)", fontWeight: 600, lineHeight: 1.45 }}>
            Book at least 24 hours before the start of the window (IST).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slotCards.map((c) => {
              const on = slotKind === c.kind;
              const disabled = !c.available;
              return (
                <button
                  key={c.kind}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setSlotKind(c.kind)}
                  style={{
                    textAlign: "left",
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: `1.5px solid ${disabled ? "rgba(0,0,0,0.06)" : on ? C.red : "rgba(0,0,0,0.08)"}`,
                    background: disabled
                      ? "rgba(0,0,0,0.02)"
                      : on
                        ? "rgba(189,35,32,0.08)"
                        : C.surface,
                    color: disabled ? "rgba(0,0,0,0.35)" : C.text,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: disabled ? "not-allowed" : "pointer",
                    lineHeight: 1.35,
                    fontFamily: C.mono,
                  }}
                >
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span>
                      {c.label}{" "}
                      <span style={{ opacity: 0.55, fontWeight: 700 }}>({c.rangeLabel})</span>
                    </span>
                    {disabled ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(189,35,32,0.6)", maxWidth: "46%" }}>
                        Not available — order at least 24 hrs ahead
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          color: "#16a34a",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Available
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ── Bill Details ────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ transitionDelay: "0.2s", marginTop: 32 }}>
          <h3 style={{ ...TYPO.sectionTitle, margin: "0 0 12px", opacity: 0.72 }}>Bill Details</h3>
          <div style={{
            background: C.surface, borderRadius: 22,
            padding: "20px", border: `1px solid ${C.border}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            display: "flex", flexDirection: "column", gap: 12
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ opacity: 0.5 }}>Item Total</span>
              <span style={{ fontWeight: 600 }}>₹{itemTotal}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ opacity: 0.5 }}>Packaging Fee</span>
              <span style={{ fontWeight: 600 }}>₹{packagingFee}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ opacity: 0.5 }}>Delivery Fee</span>
              <span style={{ fontWeight: 600 }}>₹{deliveryFee}</span>
            </div>
            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900 }}>
              <span>Grand Total</span>
              <span>₹{grandTotal}</span>
            </div>
          </div>
        </motion.section>

        {/* ── Payment Mode ────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ transitionDelay: "0.3s", marginTop: 32 }}>
          <h3 style={{ ...TYPO.sectionTitle, margin: "0 0 12px", opacity: 0.72 }}>Payment Mode</h3>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }} className="no-scrollbar">
            {(
              [
                {
                  id: "upi",
                  label: "UPI (GPay/PhonePe)",
                  icon: (
                    <Lightning size={26} weight="fill" color="rgba(0,0,0,0.7)" />
                  ),
                },
                {
                  id: "card",
                  label: "Debit/Credit Card",
                  icon: (
                    <CreditCard size={26} weight="regular" color="rgba(0,0,0,0.7)" />
                  ),
                },
                {
                  id: "cod",
                  label: "Cash on Delivery",
                  icon: (
                    <Money size={26} weight="regular" color="rgba(0,0,0,0.7)" />
                  ),
                  disabled: true,
                },
              ] as const
            ).map((p) => {
              const disabled = "disabled" in p && p.disabled;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setPaymentMethod(p.id)}
                  style={{
                    flex: "0 0 140px", padding: "16px", borderRadius: 16,
                    opacity: disabled ? 0.45 : 1,
                    background: paymentMethod === p.id ? "rgba(189,35,32,0.08)" : C.surface,
                    border: `1.5px solid ${paymentMethod === p.id ? C.red : "rgba(0,0,0,0.06)"}`,
                    display: "flex", flexDirection: "column", gap: 8, textAlign: "left",
                    cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s"
                  }}
                >
                  {p.icon}
                  <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </motion.section>
      </div>

      {/* ── Bottom Action Bar ───────────────────────────────────────────── */}
      <div style={{
        padding: "24px 24px max(24px, env(safe-area-inset-bottom))",
        background: `linear-gradient(to top, ${C.bg} 80%, transparent)`,
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30
      }}>
        {checkoutError && (
          <p style={{
            margin: "0 0 12px", padding: "12px 14px", borderRadius: 14,
            background: "rgba(189,35,32,0.15)", border: "1px solid rgba(189,35,32,0.35)",
            color: C.red, fontSize: 13, fontWeight: 600, lineHeight: 1.4
          }}>
            {checkoutError}
          </p>
        )}
        <motion.button
          whileTap={{ scale: orderCtaDisabled ? 1 : 0.96 }}
          onClick={handlePlaceOrder}
          disabled={orderCtaDisabled}
          style={{
            width: "100%", height: 60, borderRadius: 20,
            background: placing
              ? "linear-gradient(135deg, #BD2320 0%, #8B1A18 100%)"
              : slotKind == null
                ? "rgba(0,0,0,0.06)"
                : "linear-gradient(135deg, #BD2320 0%, #8B1A18 100%)",
            border: slotKind == null && !placing ? "1.5px solid rgba(0,0,0,0.1)" : "none",
            color: slotKind == null && !placing ? "rgba(0,0,0,0.35)" : "white",
            fontSize: 17, fontWeight: 900,
            letterSpacing: "0.02em",
            cursor: placing ? "wait" : slotKind == null ? "not-allowed" : "pointer",
            opacity: placing ? 0.92 : slotKind == null ? 0.85 : 1,
            boxShadow:
              slotKind == null && !placing
                ? "none"
                : `0 8px 30px ${C.redGlow}, 0 2px 0 rgba(255,255,255,0.15) inset`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: placing ? 0 : 12,
            position: "relative",
          }}
        >
          {placing ? (
            <motion.div
              role="status"
              aria-label="Creating payment link"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.22)",
                borderTopColor: "#fff",
                borderRightColor: "rgba(255,255,255,0.5)",
                flexShrink: 0,
              }}
            />
          ) : !isOrderingWindowOpen() ? (
            "Ordering is closed (6 AM – 6 PM)"
          ) : (
            <>
              Place Order • ₹{grandTotal}
              <ArrowRight size={20} weight="bold" color="currentColor" aria-hidden />
            </>
          )}
        </motion.button>
      </div>

      {/* ── Bottom Vignette ──────────────────────────────────────────────── */}
      {!isOrderingWindowOpen() && (
        <div
          style={{
            position: "fixed",
            bottom: 0, left: 0, right: 0,
            height: 220,
            background: `linear-gradient(to top, ${C.bg} 40%, transparent 100%)`,
            pointerEvents: "none",
            zIndex: 205,
          }}
        />
      )}

      {/* ── Floating Warning Pill (Rule 1) ─────────────────────────────── */}
      {!isOrderingWindowOpen() && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.35 }}
          style={{
            position: "fixed",
            bottom: 32, left: 16, right: 16,
            zIndex: 210,
            display: "flex", justifyContent: "center",
            paddingBottom: "env(safe-area-inset-bottom)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex", gap: 14, alignItems: "center",
              flex: 1,
              justifyContent: "center",
              padding: "16px 24px",
              background: "rgba(189, 35, 32, 0.18)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderRadius: 999,
              border: "1px solid rgba(189, 35, 32, 0.35)",
              boxShadow: "0 12px 32px rgba(189,35,32,0.2)",
              pointerEvents: "auto",
            }}
          >
            <div style={{ 
              width: 36, height: 36, borderRadius: "50%", 
              background: "rgba(189,35,32,0.2)", 
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <ArrowLeft size={20} weight="bold" color="#f87171" style={{ transform: "rotate(90deg)" }} />
            </div>
            <span style={{ 
              fontSize: 14, color: C.red, fontWeight: 800, 
              letterSpacing: "0.01em", fontFamily: C.mono 
            }}>
              Ordering is open daily from 6 AM to 6 PM. See you then!
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
