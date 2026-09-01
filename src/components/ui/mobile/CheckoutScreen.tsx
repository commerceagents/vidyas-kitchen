"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  MapPin,
  Lightning,
  CreditCard,
  Money,
  Sun,
  ForkKnife,
  Moon,
  CaretDown,
  BowlFood,
  UserPlus,
} from "@phosphor-icons/react";

import { loadSavedPlaces, type SavedPlace } from "@/lib/vk-saved-places";
import {
  type DeliverySlotKind,
  iterDeliveryDateOptions,
  slotCardsForIstDate,
  isOrderingWindowOpen,
} from "@/lib/delivery-slots";
import { TYPO } from "@/components/ui/mobile/mobile-typography";
import { MenuItem } from "@/components/ui/mobile/mobileMenuData";
import { readUiSession, writeUiSession } from "@/lib/vk-ui-session";

const C = {
  bg: "#F5F5F7",
  surface: "rgba(255,255,255,0.88)",
  border: "rgba(0,0,0,0.06)",
  red: "#BD2320",
  redGlow: "rgba(189,35,32,0.25)",
  redFaint: "rgba(189,35,32,0.08)",
  white: "#ffffff",
  text: "#1A1A1A",
  muted: "rgba(0,0,0,0.42)",
  mono: "var(--font-outfit), system-ui, -apple-system, sans-serif",
};

const sp = (n: number) => n * 8;

type CheckoutPhase = "cart" | "schedule";

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/(?:^|\s|\(|\/)\w/g, (match) => match.toUpperCase());
}

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

function MealSlotIcon({ kind, active, disabled }: { kind: DeliverySlotKind; active: boolean; disabled: boolean }) {
  const color = disabled ? "rgba(0,0,0,0.28)" : active ? C.red : "rgba(0,0,0,0.55)";
  const bg = disabled ? "rgba(0,0,0,0.04)" : active ? C.redFaint : "rgba(0,0,0,0.04)";
  const Icon = kind === "breakfast" ? Sun : kind === "lunch" ? ForkKnife : Moon;
  return (
    <span
      aria-hidden
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        background: bg,
        border: `1px solid ${active && !disabled ? "rgba(189,35,32,0.22)" : "rgba(0,0,0,0.05)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={22} weight={active && !disabled ? "fill" : "duotone"} color={color} />
    </span>
  );
}

function StepDots({ phase }: { phase: CheckoutPhase }) {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 4,
      }}
    >
      {(["cart", "schedule"] as const).map((p) => {
        const on = phase === p;
        const done = phase === "schedule" && p === "cart";
        return (
          <span
            key={p}
            style={{
              height: 4,
              width: on ? 22 : 8,
              borderRadius: 999,
              background: on || done ? C.red : "rgba(0,0,0,0.12)",
              transition: "width 0.28s ease, background 0.28s ease",
            }}
          />
        );
      })}
    </div>
  );
}

/** Slide-to-confirm final CTA — mirrors the driver app's swipe pattern, themed for checkout. */
function SwipeToPlaceOrder({
  label,
  disabled,
  loading,
  onConfirm,
}: {
  label: string;
  disabled: boolean;
  loading: boolean;
  onConfirm: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startXRef = useRef(0);
  const HANDLE = 50;
  const PAD = 4;
  const locked = disabled || loading;

  const getMaxOffset = useCallback(() => {
    if (!trackRef.current) return 200;
    return Math.max(0, trackRef.current.offsetWidth - HANDLE - PAD * 2);
  }, []);

  const handleStart = (clientX: number) => {
    if (locked || completed) return;
    setDragging(true);
    startXRef.current = clientX - offsetX;
  };
  const handleMove = (clientX: number) => {
    if (!dragging) return;
    const max = getMaxOffset();
    setOffsetX(Math.max(0, Math.min(clientX - startXRef.current, max)));
  };
  const handleEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const max = getMaxOffset();
    if (max > 0 && offsetX > max * 0.82) {
      setCompleted(true);
      setOffsetX(max);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
      onConfirm();
    } else {
      setOffsetX(0);
    }
  };

  // If placement failed (loading dropped back to false without navigating away), reset the slider.
  useEffect(() => {
    if (completed && !loading) {
      const t = setTimeout(() => {
        setCompleted(false);
        setOffsetX(0);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [completed, loading]);

  const max = getMaxOffset();
  const progress = max > 0 ? offsetX / max : 0;
  const showHandle = !disabled || loading;

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        width: "100%",
        height: 58,
        borderRadius: 20,
        background: disabled && !loading ? "rgba(0,0,0,0.06)" : `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
        border: disabled && !loading ? "1.5px solid rgba(0,0,0,0.08)" : "none",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        transition: "background 0.25s ease",
      }}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => { if (dragging) handleMove(e.clientX); }}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging) handleEnd(); }}
    >
      {/* Progress fill */}
      {showHandle && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${offsetX + HANDLE + PAD}px`,
            background: "rgba(255,255,255,0.14)",
            transition: dragging ? "none" : "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      )}

      {/* Label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 15.5,
          fontWeight: 900,
          fontFamily: C.mono,
          color: disabled && !loading ? "rgba(0,0,0,0.35)" : `rgba(255,255,255,${0.95 - progress * 0.55})`,
          pointerEvents: "none",
          letterSpacing: "0.01em",
        }}
      >
        {loading ? (
          <motion.div
            role="status"
            aria-label="Creating payment link"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.25)",
              borderTopColor: "#fff",
            }}
          />
        ) : (
          label
        )}
      </div>

      {/* Draggable handle */}
      {showHandle && (
        <div
          style={{
            position: "absolute",
            top: PAD,
            left: `${PAD + offsetX}px`,
            width: HANDLE,
            height: HANDLE,
            borderRadius: 15,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            cursor: loading ? "wait" : "grab",
            transition: dragging ? "none" : "left 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <ArrowRight size={20} weight="bold" color={C.red} />
        </div>
      )}
    </div>
  );
}

interface CheckoutScreenProps {
  onBack: () => void;
  cart: Record<string, number>;
  items: MenuItem[];
  updateQty: (id: string, delta: number) => void;
  locationLabel: string;
  onChangeLocation: () => void;
  onSelectSavedLocation?: (place: SavedPlace) => void;
  onAddMore: () => void;
  phone: string;
  customerName: string;
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
  const [phase, setPhase] = useState<CheckoutPhase>(() => {
    const saved = readUiSession()?.checkoutPhase;
    return saved === "schedule" ? "schedule" : "cart";
  });
  const [phaseDir, setPhaseDir] = useState<1 | -1>(1);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const dayOptions = useMemo(() => iterDeliveryDateOptions(14), []);
  // Today is almost always past the 24h booking cutoff — default to the first day that
  // actually has an open slot instead of landing on a picked-but-unbookable "today".
  const [deliveryDateYmd, setDeliveryDateYmd] = useState(() => {
    const firstAvailable = dayOptions.find((d) => d.cards.some((c) => c.available));
    return (firstAvailable ?? dayOptions[0])?.istYmd ?? "";
  });
  const [slotKind, setSlotKind] = useState<DeliverySlotKind | null>(null);
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [dayTip, setDayTip] = useState<string | null>(null);
  const dayTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dayTipTimerRef.current) clearTimeout(dayTipTimerRef.current);
    };
  }, []);

  const handleDayTap = (istYmd: string, hasAny: boolean, dayLabel: string) => {
    if (!hasAny) {
      if (dayTipTimerRef.current) clearTimeout(dayTipTimerRef.current);
      setDayTip(`All slots for ${dayLabel} are booked — pick another date`);
      dayTipTimerRef.current = setTimeout(() => setDayTip(null), 2400);
      return;
    }
    setDayTip(null);
    setDeliveryDateYmd(istYmd);
  };

  useEffect(() => {
    setSlotKind(null);
  }, [deliveryDateYmd]);

  useEffect(() => {
    writeUiSession({ checkoutPhase: phase });
  }, [phase]);

  const slotCards = useMemo(() => slotCardsForIstDate(deliveryDateYmd), [deliveryDateYmd]);

  const refreshSavedPlaces = useCallback(() => {
    setSavedPlaces(loadSavedPlaces().filter((p) => p.lat !== 0 && p.lng !== 0));
  }, []);

  useEffect(() => {
    refreshSavedPlaces();
    window.addEventListener("focus", refreshSavedPlaces);
    return () => window.removeEventListener("focus", refreshSavedPlaces);
  }, [refreshSavedPlaces]);

  const cartEntries = useMemo(() => {
    return Object.entries(cart)
      .map(([key, qty]) => {
        const [id, weight] = key.split(":");
        const item = items.find((i) => i.id === id);
        if (!item) return null;
        const variant = item.variants?.find((v) => v.weight === weight);
        if (!variant) return null;
        return {
          key,
          id: item.id,
          variantId: variant.id,
          name: item.name,
          image: item.image || item.image_url || "/VK_Logo.webp",
          price: variant.price,
          weight: variant.weight,
          weightLabel: variant.label,
          quantity: qty,
        };
      })
      .filter(Boolean) as {
      key: string;
      id: string;
      variantId: string;
      name: string;
      image: string;
      price: number;
      weight: string;
      weightLabel: string;
      quantity: number;
    }[];
  }, [cart, items]);

  useEffect(() => {
    if (cartEntries.length === 0 && phase === "schedule") {
      setPhaseDir(-1);
      setPhase("cart");
    }
  }, [cartEntries.length, phase]);

  const itemTotal = cartEntries.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const packagingFee = 20;
  const deliveryFee = 35;
  const tax = Math.round(itemTotal * 0.05);
  const otherCharges = packagingFee + tax;
  const grandTotal = itemTotal + packagingFee + deliveryFee + tax;
  const recipientIncomplete =
    forSomeoneElse && (!recipientName.trim() || recipientPhone.replace(/\D/g, "").length < 10);
  const orderCtaDisabled = placing || slotKind == null || !isOrderingWindowOpen() || recipientIncomplete;
  const cartEmpty = cartEntries.length === 0;

  const goSchedule = () => {
    if (cartEmpty) return;
    setCheckoutError(null);
    setPhaseDir(1);
    setPhase("schedule");
  };

  const goCart = () => {
    setCheckoutError(null);
    setPhaseDir(-1);
    setPhase("cart");
  };

  const handleHeaderBack = () => {
    if (phase === "schedule") goCart();
    else onBack();
  };

  const handlePlaceOrder = async () => {
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
    const recipientNameTrim = recipientName.trim();
    const recipientPhoneDigits = recipientPhone.replace(/\D/g, "");
    if (forSomeoneElse) {
      if (!recipientNameTrim) {
        setCheckoutError("Enter the recipient's name.");
        return;
      }
      if (recipientPhoneDigits.length < 10) {
        setCheckoutError("Enter a valid phone number for the recipient.");
        return;
      }
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
          ...(forSomeoneElse
            ? { recipientName: recipientNameTrim, recipientPhone: recipientPhoneDigits }
            : {}),
          lines: cartEntries.map((it) => ({
            menuItemId: it.variantId,
            quantity: it.quantity,
            variant: it.weight,
            weightLabel: it.weightLabel,
          })),
          ...(typeof deliveryLat === "number" &&
          typeof deliveryLng === "number" &&
          Number.isFinite(deliveryLat) &&
          Number.isFinite(deliveryLng)
            ? { deliveryLat, deliveryLng }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        paymentUrl?: string;
        orderId?: string;
      };
      if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`);
      writeUiSession({ checkoutPhase: "cart" });
      if (paymentMethod === "cod") {
        // No online payment to redirect to — the order is already placed, cash is
        // collected at delivery. Reuse the same success route as the paid flow so
        // cart-clearing / tracking / the confirmation modal all stay in one place.
        if (!data.orderId) throw new Error("Order was not created.");
        window.location.assign(`/?status=success&orderId=${data.orderId}`);
        return;
      }
      if (!data.paymentUrl) throw new Error("No payment URL returned");
      try {
        sessionStorage.setItem("vk_pending_checkout_cart", JSON.stringify({ cart }));
      } catch {
        /* noop */
      }
      window.location.assign(data.paymentUrl);
      // Custom URI schemes (e.g. upi:// fallback when Razorpay isn't configured) fail
      // silently on desktop/devices with no handler app — location.assign won't throw,
      // it just does nothing, which would otherwise leave the button spinning forever.
      // If we're still here after a beat, surface an error instead of hanging.
      if (!/^https?:\/\//i.test(data.paymentUrl)) {
        setTimeout(() => {
          if (typeof document !== "undefined" && !document.hidden) {
            setCheckoutError("Couldn't open a payment app on this device. Please try from a phone with GPay/PhonePe installed.");
            setPlacing(false);
          }
        }, 2200);
      }
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Something went wrong");
      setPlacing(false);
    }
  };

  const pageVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "28%" : "-28%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-18%" : "18%", opacity: 0 }),
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: C.bg,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        color: C.text,
        fontFamily: C.mono,
        overflow: "hidden",
        filter: isOrderingWindowOpen() ? "none" : "grayscale(0.9) opacity(0.6)",
        transition: "filter 0.5s ease, opacity 0.5s ease",
      }}
    >
      {/* Unavailable-day tap feedback */}
      <AnimatePresence>
        {dayTip && (
          <motion.div
            key={dayTip}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{
              position: "fixed",
              bottom: 110,
              left: 0,
              right: 0,
              margin: "0 auto",
              width: "fit-content",
              maxWidth: "82vw",
              zIndex: 9999,
              padding: "10px 18px",
              borderRadius: 24,
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(189,35,32,0.35)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
              color: C.text,
              fontSize: 12.5,
              fontWeight: 700,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {dayTip}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Soft atmosphere */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-8%",
          right: "-12%",
          width: "55%",
          height: "32%",
          background: "radial-gradient(circle, rgba(189,35,32,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          padding: `max(16px, env(safe-area-inset-top)) ${sp(2.5)}px 10px`,
          display: "grid",
          gridTemplateColumns: "44px 1fr 44px",
          alignItems: "center",
          columnGap: 10,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={handleHeaderBack}
          aria-label={phase === "schedule" ? "Back to cart" : "Back"}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: C.surface,
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <ArrowLeft size={20} weight="bold" color={C.text} />
        </motion.button>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ ...TYPO.title, margin: 0 }}>
            {phase === "cart" ? "My Cart" : "Schedule"}
          </h2>
          <StepDots phase={phase} />
        </div>
        <div style={{ width: 44 }} aria-hidden />
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <AnimatePresence custom={phaseDir} mode="wait" initial={false}>
          {phase === "cart" ? (
            <motion.div
              key="cart"
              custom={phaseDir}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.85 }}
              style={{
                position: "absolute",
                inset: 0,
                overflowY: "auto",
                padding: `8px ${sp(2.5)}px 140px`,
                WebkitOverflowScrolling: "touch",
              }}
              className="no-scrollbar"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <h3 style={{ ...TYPO.sectionTitle, margin: 0, opacity: 0.72 }}>Your order</h3>
                <button
                  type="button"
                  onClick={onAddMore}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderRadius: 10,
                    padding: "6px 2px",
                    fontSize: 13,
                    fontWeight: 800,
                    color: C.red,
                    cursor: "pointer",
                    fontFamily: C.mono,
                  }}
                >
                  + Add more
                </button>
              </div>

              {cartEmpty ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: C.surface,
                    borderRadius: 24,
                    border: `1px solid ${C.border}`,
                    padding: "36px 24px",
                    textAlign: "center",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.04)",
                  }}
                >
                  <span
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      background: C.redFaint,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <BowlFood size={32} weight="duotone" color={C.red} />
                  </span>
                  <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800 }}>Your cart is empty</p>
                  <p style={{ margin: "0 0 20px", fontSize: 13, fontWeight: 600, color: C.muted, lineHeight: 1.45 }}>
                    Add a dish from the menu to continue.
                  </p>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={onAddMore}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "14px 28px",
                      background: C.red,
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 900,
                      cursor: "pointer",
                      fontFamily: C.mono,
                      boxShadow: `0 8px 24px ${C.redGlow}`,
                    }}
                  >
                    Browse menu
                  </motion.button>
                </motion.div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {cartEntries.map((item, idx) => {
                      const { cleanName, tag } = parseRecipeTag(item.name);
                      const line = item.price * item.quantity;
                      return (
                        <motion.div
                          key={item.key}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.04, 0.2) }}
                          style={{
                            background: C.surface,
                            borderRadius: 20,
                            padding: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            border: `1px solid ${C.border}`,
                            boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
                          }}
                        >
                          <div
                            style={{
                              position: "relative",
                              width: 72,
                              height: 72,
                              borderRadius: 16,
                              overflow: "hidden",
                              flexShrink: 0,
                              background: "rgba(0,0,0,0.04)",
                            }}
                          >
                            <Image
                              src={item.image}
                              alt={cleanName}
                              fill
                              sizes="72px"
                              style={{ objectFit: "cover" }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 15,
                                fontWeight: 800,
                                lineHeight: 1.25,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {toTitleCase(cleanName)}
                            </p>
                            <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 700, color: C.muted }}>
                              {item.weightLabel}
                              {tag ? ` · ${toTitleCase(tag)}` : ""}
                            </p>
                            <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 900, color: C.red }}>
                              ₹{line.toLocaleString("en-IN")}
                            </p>
                          </div>
                          <div
                            style={{
                              height: 36,
                              borderRadius: 999,
                              background: C.red,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "0 4px",
                              boxShadow: `0 6px 16px ${C.redGlow}`,
                              width: 92,
                              flexShrink: 0,
                            }}
                          >
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => updateQty(item.key, -1)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "white",
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              <Minus size={13} weight="bold" color="white" />
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", minWidth: 22, textAlign: "center" }}>
                              {String(item.quantity).padStart(2, "0")}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => updateQty(item.key, 1)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "white",
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              <Plus size={13} weight="bold" color="white" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <h3 style={{ ...TYPO.sectionTitle, margin: "28px 0 12px", opacity: 0.72 }}>
                    Order summary
                  </h3>
                  <div
                    style={{
                      background: C.surface,
                      borderRadius: 22,
                      padding: "18px 18px 16px",
                      border: `1px solid ${C.border}`,
                      boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: C.muted,
                      }}
                    >
                      Bill details
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span style={{ color: C.muted, fontWeight: 600 }}>Item total</span>
                        <span style={{ fontWeight: 700 }}>₹{itemTotal.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span style={{ color: C.muted, fontWeight: 600 }}>Delivery fee</span>
                        <span style={{ fontWeight: 700 }}>₹{deliveryFee}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChargesOpen((v) => !v)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontFamily: C.mono,
                          fontSize: 14,
                          color: C.text,
                        }}
                      >
                        <span style={{ color: C.muted, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          GST & other charges
                          <CaretDown
                            size={14}
                            weight="bold"
                            color={C.muted}
                            style={{
                              transform: chargesOpen ? "rotate(180deg)" : "none",
                              transition: "transform 0.2s ease",
                            }}
                          />
                        </span>
                        <span style={{ fontWeight: 700 }}>₹{otherCharges}</span>
                      </button>
                      <AnimatePresence initial={false}>
                        {chargesOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div
                              style={{
                                marginTop: 2,
                                padding: "10px 12px",
                                borderRadius: 12,
                                background: "rgba(0,0,0,0.03)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                color: "rgba(0,0,0,0.55)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Packaging</span>
                                <span>₹{packagingFee}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>GST (5%)</span>
                                <span>₹{tax}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.01em" }}>To pay</span>
                        <span style={{ fontSize: 22, fontWeight: 900, color: C.red, letterSpacing: "-0.02em" }}>
                          ₹{grandTotal.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="schedule"
              custom={phaseDir}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.85 }}
              style={{
                position: "absolute",
                inset: 0,
                overflowY: "auto",
                padding: `8px ${sp(2.5)}px 150px`,
                WebkitOverflowScrolling: "touch",
              }}
              className="no-scrollbar"
            >
              {/* Compact order strip */}
              <button
                type="button"
                onClick={goCart}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 18,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  marginBottom: 22,
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                  fontFamily: C.mono,
                }}
              >
                <div style={{ display: "flex", marginRight: 2 }}>
                  {cartEntries.slice(0, 3).map((it, i) => (
                    <div
                      key={it.key}
                      style={{
                        position: "relative",
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        overflow: "hidden",
                        marginLeft: i === 0 ? 0 : -10,
                        border: `2px solid ${C.bg}`,
                        background: "rgba(0,0,0,0.04)",
                        zIndex: 3 - i,
                      }}
                    >
                      <Image src={it.image} alt="" fill sizes="34px" style={{ objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>
                    {cartEntries.reduce((n, i) => n + i.quantity, 0)} item
                    {cartEntries.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"} · ₹
                    {grandTotal.toLocaleString("en-IN")}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 600, color: C.muted }}>
                    Tap to edit cart
                  </p>
                </div>
                <ArrowRight size={16} weight="bold" color={C.muted} />
              </button>

              <h3 style={{ ...TYPO.sectionTitle, margin: "0 0 12px", opacity: 0.72 }}>Delivery to</h3>
              <div
                style={{
                  background: C.surface,
                  borderRadius: 20,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: `1px solid ${C.border}`,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: C.redFaint,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={22} weight="fill" color={C.red} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {locationLabel}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: C.muted, fontWeight: 600 }}>
                    Home-style meal, delivered to your pin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onChangeLocation}
                  style={{
                    background: "none",
                    border: "none",
                    color: C.red,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: C.mono,
                    flexShrink: 0,
                  }}
                >
                  Change
                </button>
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

              <button
                type="button"
                onClick={() => setForSomeoneElse((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "none",
                  border: "none",
                  padding: "16px 2px 0",
                  cursor: "pointer",
                  fontFamily: C.mono,
                  width: "100%",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: forSomeoneElse ? C.redFaint : "rgba(0,0,0,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <UserPlus size={16} weight="bold" color={forSomeoneElse ? C.red : C.muted} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text, flex: 1, textAlign: "left" }}>
                  Ordering for someone else?
                </span>
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 38,
                    height: 22,
                    borderRadius: 999,
                    background: forSomeoneElse ? C.red : "rgba(0,0,0,0.12)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <motion.span
                    initial={false}
                    animate={{ x: forSomeoneElse ? 16 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    style={{
                      position: "absolute",
                      top: 1,
                      left: 1,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }}
                  />
                </span>
              </button>

              <AnimatePresence initial={false}>
                {forSomeoneElse && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      <input
                        type="text"
                        inputMode="text"
                        placeholder="Recipient's name"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "13px 14px",
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          background: C.surface,
                          color: C.text,
                          fontFamily: C.mono,
                          fontSize: 14,
                          fontWeight: 700,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder="Recipient's phone number"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value.replace(/[^\d+ ]/g, ""))}
                        style={{
                          width: "100%",
                          padding: "13px 14px",
                          borderRadius: 14,
                          border: `1px solid ${C.border}`,
                          background: C.surface,
                          color: C.text,
                          fontFamily: C.mono,
                          fontSize: 14,
                          fontWeight: 700,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <p style={{ margin: "8px 2px 0", fontSize: 11, color: C.muted, fontWeight: 600, lineHeight: 1.45 }}>
                      Our delivery partner will contact them directly at the address above.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <h3 style={{ ...TYPO.sectionTitle, margin: "28px 0 12px", opacity: 0.72 }}>
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
                  const on = hasAny && d.istYmd === deliveryDateYmd;
                  const parts = d.weekendLabel.split(",");
                  const weekday = (parts[0] || d.weekendLabel).trim();
                  const rest = (parts[1] || "").trim();
                  return (
                    <motion.button
                      key={d.istYmd}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      aria-disabled={!hasAny}
                      onClick={() => handleDayTap(d.istYmd, hasAny, rest || weekday)}
                      style={{
                        flex: "0 0 auto",
                        minWidth: 72,
                        padding: "12px 14px",
                        borderRadius: 18,
                        border: `1.5px solid ${on ? C.red : "rgba(0,0,0,0.07)"}`,
                        background: on ? C.redFaint : C.surface,
                        color: hasAny ? C.text : "rgba(0,0,0,0.3)",
                        cursor: hasAny ? "pointer" : "not-allowed",
                        fontFamily: C.mono,
                      }}
                    >
                      <span style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.55 }}>
                        {weekday}
                      </span>
                      <span style={{ display: "block", marginTop: 4, fontSize: 14, fontWeight: 900 }}>
                        {rest || weekday}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <h3 style={{ ...TYPO.sectionTitle, margin: "26px 0 6px", opacity: 0.72 }}>Meal time</h3>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: C.muted, fontWeight: 600, lineHeight: 1.45 }}>
                Book at least 24 hours before the window starts (IST).
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {slotCards.map((c) => {
                  const on = slotKind === c.kind;
                  const disabled = !c.available;
                  return (
                    <motion.button
                      key={c.kind}
                      type="button"
                      whileTap={disabled ? undefined : { scale: 0.985 }}
                      disabled={disabled}
                      onClick={() => !disabled && setSlotKind(c.kind)}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: 20,
                        border: `1.5px solid ${
                          disabled ? "rgba(0,0,0,0.05)" : on ? C.red : "rgba(0,0,0,0.07)"
                        }`,
                        background: disabled ? "rgba(0,0,0,0.02)" : on ? C.redFaint : C.surface,
                        cursor: disabled ? "not-allowed" : "pointer",
                        fontFamily: C.mono,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <MealSlotIcon kind={c.kind} active={on} disabled={disabled} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 17,
                            fontWeight: 900,
                            color: disabled ? "rgba(0,0,0,0.35)" : C.text,
                          }}
                        >
                          {c.label}
                        </span>
                        <span
                          style={{
                            display: "block",
                            marginTop: 3,
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: disabled ? "rgba(0,0,0,0.28)" : C.muted,
                          }}
                        >
                          {c.rangeLabel}
                        </span>
                      </span>
                      {disabled ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "rgba(0,0,0,0.35)",
                            maxWidth: 88,
                            textAlign: "right",
                            lineHeight: 1.35,
                          }}
                        >
                          Book 24 hrs ahead
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: on ? C.red : "rgba(22,163,74,0.9)",
                            padding: "5px 9px",
                            borderRadius: 999,
                            background: on ? "rgba(189,35,32,0.1)" : "rgba(22,163,74,0.1)",
                          }}
                        >
                          {on ? "Selected" : "Open"}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <h3 style={{ ...TYPO.sectionTitle, margin: "28px 0 12px", opacity: 0.72 }}>
                Payment
              </h3>
              <div
                style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}
                className="no-scrollbar"
              >
                {(
                  [
                    {
                      id: "upi",
                      label: "UPI",
                      sub: "GPay / PhonePe",
                      icon: <Lightning size={22} weight="fill" color="rgba(0,0,0,0.7)" />,
                      disabled: false,
                    },
                    {
                      id: "card",
                      label: "Card",
                      sub: "Debit / Credit",
                      icon: <CreditCard size={22} weight="regular" color="rgba(0,0,0,0.7)" />,
                      disabled: false,
                    },
                    {
                      id: "cod",
                      label: "Cash",
                      sub: "Pay on delivery",
                      icon: <Money size={22} weight="regular" color="rgba(0,0,0,0.7)" />,
                      disabled: false,
                    },
                  ] as const
                ).map((p) => {
                  const disabled = p.disabled;
                  const on = paymentMethod === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setPaymentMethod(p.id)}
                      style={{
                        flex: "0 0 118px",
                        padding: "14px 12px",
                        borderRadius: 18,
                        opacity: disabled ? 0.45 : 1,
                        background: on ? C.redFaint : C.surface,
                        border: `1.5px solid ${on ? C.red : "rgba(0,0,0,0.06)"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        textAlign: "left",
                        cursor: disabled ? "not-allowed" : "pointer",
                        fontFamily: C.mono,
                      }}
                    >
                      {p.icon}
                      <span style={{ fontSize: 13, fontWeight: 900 }}>{p.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>{p.sub}</span>
                    </button>
                  );
                })}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          padding: "16px 20px max(20px, env(safe-area-inset-bottom))",
          background: `linear-gradient(to top, ${C.bg} 70%, transparent)`,
          position: "relative",
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        {checkoutError && phase === "schedule" && (
          <p
            style={{
              margin: "0 0 12px",
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(189,35,32,0.12)",
              border: "1px solid rgba(189,35,32,0.28)",
              color: C.red,
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            {checkoutError}
          </p>
        )}

        {phase === "cart" ? (
          <motion.button
            type="button"
            whileTap={{ scale: cartEmpty ? 1 : 0.97 }}
            onClick={goSchedule}
            disabled={cartEmpty}
            style={{
              width: "100%",
              height: 58,
              borderRadius: 20,
              border: "none",
              background: cartEmpty ? "rgba(0,0,0,0.06)" : `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
              color: cartEmpty ? "rgba(0,0,0,0.32)" : "#fff",
              fontSize: 16,
              fontWeight: 900,
              cursor: cartEmpty ? "not-allowed" : "pointer",
              fontFamily: C.mono,
              boxShadow: cartEmpty ? "none" : `0 10px 28px ${C.redGlow}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            Checkout
          </motion.button>
        ) : (
          <SwipeToPlaceOrder
            label={
              !isOrderingWindowOpen()
                ? "Ordering closed (6 AM – 6 PM)"
                : slotKind == null
                  ? "Pick a meal time"
                  : "Place order"
            }
            disabled={orderCtaDisabled}
            loading={placing}
            onConfirm={handlePlaceOrder}
          />
        )}
      </div>

      {!isOrderingWindowOpen() && (
        <>
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: 220,
              background: `linear-gradient(to top, ${C.bg} 40%, transparent 100%)`,
              pointerEvents: "none",
              zIndex: 205,
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.2 }}
            style={{
              position: "fixed",
              bottom: 32,
              left: 16,
              right: 16,
              zIndex: 210,
              display: "flex",
              justifyContent: "center",
              paddingBottom: "env(safe-area-inset-bottom)",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flex: 1,
                justifyContent: "center",
                padding: "14px 20px",
                background: "rgba(189, 35, 32, 0.16)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderRadius: 999,
                border: "1px solid rgba(189, 35, 32, 0.32)",
                boxShadow: "0 12px 32px rgba(189,35,32,0.18)",
                pointerEvents: "auto",
              }}
            >
              <span style={{ fontSize: 13, color: C.red, fontWeight: 800, fontFamily: C.mono }}>
                Ordering is open daily from 6 AM to 6 PM.
              </span>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
