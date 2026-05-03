"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design Tokens ─────────────────────────────────────────────────────────
const C = {
  bg:           "#0a0a0a",
  surface:      "rgba(14,14,14,0.75)",
  glass:        "rgba(255,255,255,0.04)",
  border:       "rgba(255,255,255,0.08)",
  red:          "#BD2320",
  redGlow:      "rgba(189,35,32,0.35)",
  white:        "#ffffff",
  mono:         "var(--font-outfit), system-ui, -apple-system, sans-serif",
};

const sp = (n: number) => n * 8;

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/(?:^|\s|\(|\/)\w/g, match => match.toUpperCase());
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface CheckoutScreenProps {
  onBack: () => void;
  /** Called after Razorpay redirect succeeds (optional; not used on redirect flow). */
  onPlaceOrder?: (method: string) => void;
  cart: Record<string, number>;
  items: MenuItem[];
  updateQty: (id: string, delta: number) => void;
  locationLabel: string;
  onChangeLocation: () => void;
  onAddMore: () => void;
  phone: string;
  customerName: string;
}

export function CheckoutScreen({
  onBack,
  onPlaceOrder,
  cart,
  items,
  updateQty,
  locationLabel,
  onChangeLocation,
  onAddMore,
  phone,
  customerName,
}: CheckoutScreenProps) {
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Filter items that are in cart
  const cartItems = items.filter(it => cart[it.id] > 0);
  const itemTotal = cartItems.reduce((acc, it) => acc + it.price * cart[it.id], 0);
  
  // Static charges as discussed
  const packagingFee = 20;
  const deliveryFee  = 35;
  const tax          = Math.round(itemTotal * 0.05); // 5% GST
  const grandTotal   = itemTotal + packagingFee + deliveryFee + tax;

  const handlePlaceOrder = async () => {
    if (paymentMethod === "cod") {
      setCheckoutError("Cash on delivery isn’t available for online checkout yet.");
      return;
    }
    if (!phone.trim()) {
      setCheckoutError("Missing phone. Please sign in again.");
      return;
    }
    if (cartItems.length === 0) return;

    setPlacing(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          customerName: customerName.trim() || "Customer",
          deliveryAddress: locationLabel,
          paymentMethod,
          lines: cartItems.map((it) => ({ menuItemId: it.id, quantity: cart[it.id] })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; paymentUrl?: string };
      if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`);
      if (!data.paymentUrl) throw new Error("No payment URL returned");
      onPlaceOrder?.(paymentMethod);
      window.location.href = data.paymentUrl;
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Something went wrong");
      setPlacing(false);
    }
  };

  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring", stiffness: 350, damping: 30 }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bg, zIndex: 200,
      display: "flex", flexDirection: "column", color: C.white,
      fontFamily: C.mono, overflow: "hidden"
    }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: `max(16px, env(safe-area-inset-top)) ${sp(2.5)}px 16px`,
        display: "flex", alignItems: "center", gap: 16,
        background: `linear-gradient(to bottom, ${C.bg} 80%, transparent)`,
        flexShrink: 0, zIndex: 10
      }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: C.surface, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.01em" }}>Checkout</h2>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: `0 ${sp(2.5)}px 140px` }} className="no-scrollbar">
        
        {/* ── Cart Items ──────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Order</h3>
            <button 
              onClick={onAddMore}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                color: C.red, cursor: "pointer"
              }}
            >
              + Add more
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cartItems.map((item) => (
              <div key={item.id} style={{
                background: "rgba(255,255,255,0.03)", borderRadius: 18,
                padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                border: "1px solid rgba(255,255,255,0.05)"
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{toTitleCase(item.name)}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>₹{item.price}</p>
                </div>

                <div style={{
                  height: 32, borderRadius: 16, background: C.red, display: "flex",
                  alignItems: "center", justifyContent: "space-between", padding: "0 4px",
                  boxShadow: "0 4px 12px rgba(189,35,32,0.4)", width: 80, flexShrink: 0
                }}>
                  <button onClick={() => updateQty(item.id, -1)} style={{ background: "none", border: "none", color: "white", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 900 }}>{cart[item.id]}</span>
                  <button onClick={() => updateQty(item.id, 1)} style={{ background: "none", border: "none", color: "white", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Address ─────────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ transitionDelay: "0.1s", marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Delivery To</h3>
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 18,
            padding: "16px", display: "flex", alignItems: "center", gap: 14,
            border: "1px solid rgba(255,255,255,0.05)"
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: "rgba(189,35,32,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{locationLabel}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>35-45 mins • Estimated Arrival</p>
            </div>
            <button onClick={onChangeLocation} style={{ background: "none", border: "none", color: C.red, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Change</button>
          </div>
        </motion.section>

        {/* ── Bill Details ────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ transitionDelay: "0.2s", marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bill Details</h3>
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 22,
            padding: "20px", border: "1px solid rgba(255,255,255,0.05)",
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
              <span style={{ opacity: 0.5 }}>Delivery Tip</span>
              <span style={{ color: C.red, fontWeight: 800 }}>Add Tip</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ opacity: 0.5 }}>Delivery Fee</span>
              <span style={{ fontWeight: 600 }}>₹{deliveryFee}</span>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900 }}>
              <span>Grand Total</span>
              <span>₹{grandTotal}</span>
            </div>
          </div>
        </motion.section>

        {/* ── Payment Mode ────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} style={{ transitionDelay: "0.3s", marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px", opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment Mode</h3>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }} className="no-scrollbar">
            {[
              { id: "upi", label: "UPI (GPay/PhonePe)", icon: "⚡" },
              { id: "card", label: "Debit/Credit Card", icon: "💳" },
              { id: "cod", label: "Cash on Delivery", icon: "💵", disabled: true },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={"disabled" in p && p.disabled}
                onClick={() => !("disabled" in p && p.disabled) && setPaymentMethod(p.id)}
                style={{
                  flex: "0 0 140px", padding: "16px", borderRadius: 16,
                  opacity: "disabled" in p && p.disabled ? 0.45 : 1,
                  background: paymentMethod === p.id ? "rgba(189,35,32,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${paymentMethod === p.id ? C.red : "rgba(255,255,255,0.06)"}`,
                  display: "flex", flexDirection: "column", gap: 8, textAlign: "left",
                  cursor: "disabled" in p && p.disabled ? "not-allowed" : "pointer", transition: "all 0.2s"
                }}
              >
                <span style={{ fontSize: 20 }}>{p.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>{p.label}</span>
              </button>
            ))}
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
            color: "#fecaca", fontSize: 13, fontWeight: 600, lineHeight: 1.4
          }}>
            {checkoutError}
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handlePlaceOrder}
          disabled={placing}
          style={{
            width: "100%", height: 60, borderRadius: 20,
            background: "linear-gradient(135deg, #BD2320 0%, #8B1A18 100%)",
            border: "none", color: "white", fontSize: 17, fontWeight: 900,
            letterSpacing: "0.02em", cursor: "pointer",
            boxShadow: `0 8px 30px ${C.redGlow}, 0 2px 0 rgba(255,255,255,0.1) inset`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12
          }}
        >
          {placing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "white" }}
            />
          ) : (
            <>
              Place Order • ₹{grandTotal}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
