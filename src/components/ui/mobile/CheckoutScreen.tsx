"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  MapPin,
  Lightning,
  Money,
  Sun,
  ForkKnife,
  Moon,
  CaretDown,
  BowlFood,
  UserPlus,
  CircleNotch,
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
import { COD_MAX_ORDER_VALUE, isCodAllowedForTotal } from "@/lib/cod-policy";
import { parseRecipeTag } from "@/lib/dish-name";
import { DELIVERY_ZONE, isInsideDeliveryZone } from "@/lib/delivery-zone";
import { normalizeOfferCode } from "@/lib/offers";

/** Discount the server decided on — mirrors AppliedOffer from lib/offers. */
type AppliedOfferView = {
  offerId: string;
  code: string | null;
  label: string;
  amount: number;
};

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
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [completed, setCompleted] = useState(false);
  /** Once they've grabbed the handle they know it slides; stop suggesting it. */
  const [touched, setTouched] = useState(false);
  const startXRef = useRef(0);
  const HANDLE = 50;
  const PAD = 4;
  const locked = disabled || loading;

  // A slider gives no clue that it isn't an ordinary button, so the handle
  // leans right every few seconds to say "drag me". Long gaps and a small
  // travel keep it a hint rather than a distraction, and it stops for good the
  // moment the customer touches it.
  const hinting = !reduceMotion && !locked && !completed && !dragging && !touched && offsetX === 0;

  const getMaxOffset = useCallback(() => {
    if (!trackRef.current) return 200;
    return Math.max(0, trackRef.current.offsetWidth - HANDLE - PAD * 2);
  }, []);

  const handleStart = (clientX: number) => {
    if (locked || completed) return;
    setTouched(true);
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
      // Swiping is the intended gesture, but it can't be the only way to buy:
      // keyboard and screen-reader users need to reach the same action, so the
      // track doubles as a plain button for them.
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-label={label}
      aria-disabled={locked}
      onKeyDown={(e) => {
        if (locked || completed) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        setTouched(true);
        setCompleted(true);
        setOffsetX(getMaxOffset());
        onConfirm();
      }}
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
        cursor: locked ? "not-allowed" : "grab",
      }}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => { if (dragging) handleMove(e.clientX); }}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging) handleEnd(); }}
    >
      {/* Trail left behind the handle. Sized to the distance actually swiped —
          previously it was always at least as wide as the handle itself, which
          drew a pale outline around the knob before anything had been dragged. */}
      {showHandle && offsetX > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${offsetX + PAD * 2}px`,
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
        <motion.div
          animate={hinting ? { x: [0, 10, 0] } : { x: 0 }}
          transition={
            hinting
              ? { duration: 0.9, times: [0, 0.4, 1], ease: "easeInOut", repeat: Infinity, repeatDelay: 2.8 }
              : { duration: 0.2 }
          }
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
        </motion.div>
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
  locationInRange?: boolean;
  recipientDrop?: { label: string; lat: number; lng: number; inRange: boolean } | null;
  onPickRecipientAddress?: () => void;
  onSetRecipientDrop?: (loc: { label: string; lat: number; lng: number; inRange: boolean }) => void;
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
  locationInRange = true,
  recipientDrop = null,
  onPickRecipientAddress,
  onSetRecipientDrop,
}: CheckoutScreenProps) {
  const [phase, setPhase] = useState<CheckoutPhase>(() => {
    const saved = readUiSession()?.checkoutPhase;
    return saved === "schedule" ? "schedule" : "cart";
  });
  const [phaseDir, setPhaseDir] = useState<1 | -1>(1);
  const [paymentMethod, setPaymentMethod] = useState("online");
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
  const [promoInput, setPromoInput] = useState("");
  const [appliedOffer, setAppliedOffer] = useState<AppliedOfferView | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  // Mirrors activeCode. Kept in a ref so re-checking on cart change doesn't
  // list the code as an effect dependency and re-trigger itself.
  const appliedCodeRef = useRef<string | null>(null);
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

  const cartLines = useMemo(
    () => cartEntries.map((it) => ({ menuItemId: it.variantId, quantity: it.quantity })),
    [cartEntries],
  );

  /**
   * The server owns the discount. We re-ask it whenever the cart changes so the
   * total on screen is always the total checkout will charge — including auto
   * festival offers the customer never typed anything for.
   */
  const checkOffer = useCallback(
    async (code: string | null) => {
      if (cartLines.length === 0) {
        setAppliedOffer(null);
        setPromoError(null);
        return;
      }
      setPromoChecking(true);
      try {
        const res = await fetch("/api/offers/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code ?? "", phone, lines: cartLines }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          applied?: AppliedOfferView | null;
        };
        setAppliedOffer(data.applied ?? null);
        if (data.ok === false) {
          setPromoError(data.error ?? "That code isn't valid.");
          appliedCodeRef.current = null;
          setActiveCode(null);
        } else {
          setPromoError(null);
        }
      } catch {
        setPromoError("Could not check that code right now.");
      } finally {
        setPromoChecking(false);
      }
    },
    [cartLines, phone],
  );

  useEffect(() => {
    void checkOffer(appliedCodeRef.current);
  }, [checkOffer]);

  const applyPromo = useCallback(async () => {
    const code = normalizeOfferCode(promoInput);
    if (!code) {
      setPromoError("Enter a code first.");
      return;
    }
    appliedCodeRef.current = code;
    setActiveCode(code);
    await checkOffer(code);
  }, [promoInput, checkOffer]);

  const removePromo = useCallback(async () => {
    appliedCodeRef.current = null;
    setActiveCode(null);
    setPromoInput("");
    setPromoError(null);
    await checkOffer(null);
  }, [checkOffer]);

  const itemTotal = cartEntries.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const discount = Math.min(appliedOffer?.amount ?? 0, itemTotal);
  const discountedItems = Math.max(0, itemTotal - discount);
  const packagingFee = 20;
  const deliveryFee = 35;
  const tax = Math.round(discountedItems * 0.05);
  const otherCharges = packagingFee + tax;
  const grandTotal = discountedItems + packagingFee + deliveryFee + tax;
  const codBlockedByTotal = !isCodAllowedForTotal(grandTotal);
  const recipientIncomplete =
    forSomeoneElse &&
    (!recipientName.trim() ||
      recipientPhone.replace(/\D/g, "").length < 10 ||
      !recipientDrop?.label ||
      !isInsideDeliveryZone(recipientDrop.lat, recipientDrop.lng));
  const orderCtaDisabled = placing || slotKind == null || !isOrderingWindowOpen() || recipientIncomplete;

  // Adding items can push the cart past the COD ceiling after it was selected.
  useEffect(() => {
    if (codBlockedByTotal && paymentMethod === "cod") setPaymentMethod("online");
  }, [codBlockedByTotal, paymentMethod]);
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
      if (!recipientDrop?.label || !isInsideDeliveryZone(recipientDrop.lat, recipientDrop.lng)) {
        setCheckoutError(`Pin ${recipientNameTrim || "their"} address in ${DELIVERY_ZONE.name}.`);
        return;
      }
    } else if (!locationInRange) {
      setCheckoutError(
        `We deliver in ${DELIVERY_ZONE.name}. Pin a drop-off there, or send this to someone else.`,
      );
      return;
    }
    const dropLabel = forSomeoneElse ? recipientDrop!.label : locationLabel;
    const dropLat = forSomeoneElse ? recipientDrop!.lat : deliveryLat;
    const dropLng = forSomeoneElse ? recipientDrop!.lng : deliveryLng;
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
          deliveryAddress: dropLabel,
          deliveryDate: deliveryDateYmd,
          deliverySlot: slotKind,
          paymentMethod,
          ...(activeCode ? { promoCode: activeCode } : {}),
          ...(forSomeoneElse
            ? { recipientName: recipientNameTrim, recipientPhone: recipientPhoneDigits }
            : {}),
          lines: cartEntries.map((it) => ({
            menuItemId: it.variantId,
            quantity: it.quantity,
            variant: it.weight,
            weightLabel: it.weightLabel,
          })),
          ...(typeof dropLat === "number" &&
          typeof dropLng === "number" &&
          Number.isFinite(dropLat) &&
          Number.isFinite(dropLng)
            ? { deliveryLat: dropLat, deliveryLng: dropLng }
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
        window.location.assign(`/?status=success&orderId=${data.orderId}&method=cod`);
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
                    Offers
                  </h3>
                  <div
                    style={{
                      background: C.surface,
                      borderRadius: 22,
                      padding: 18,
                      border: `1px solid ${C.border}`,
                      boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                     <AnimatePresence mode="wait">
                      {activeCode && appliedOffer ? (
                        <motion.div
                          key="applied"
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: "12px 14px",
                              borderRadius: 14,
                              background: "rgba(22,140,80,0.08)",
                              border: "1px solid rgba(22,140,80,0.18)",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: "#12784A",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {appliedOffer.label}
                              </p>
                              <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>
                                You save ₹{discount.toLocaleString("en-IN")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void removePromo()}
                              style={{
                                flexShrink: 0,
                                background: "none",
                                border: "none",
                                padding: "6px 2px",
                                fontFamily: C.mono,
                                fontSize: 12,
                                fontWeight: 800,
                                color: C.red,
                                cursor: "pointer",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          {!appliedOffer.code && (
                            <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>
                              Your running offer saves more than {activeCode}, so we kept it.
                            </p>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="input"
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                            <input
                              value={promoInput}
                              onChange={(e) => {
                                setPromoInput(e.target.value.toUpperCase());
                                if (promoError) setPromoError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void applyPromo();
                              }}
                              placeholder="Promo code"
                              autoCapitalize="characters"
                              autoCorrect="off"
                              spellCheck={false}
                              aria-label="Promo code"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: 46,
                                padding: "0 14px",
                                borderRadius: 14,
                                border: `1px solid ${promoError ? "rgba(189,35,32,0.4)" : C.border}`,
                                background: "rgba(0,0,0,0.03)",
                                fontFamily: C.mono,
                                fontSize: 14,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                color: C.text,
                                outline: "none",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void applyPromo()}
                              disabled={promoChecking || promoInput.trim().length === 0}
                              style={{
                                flexShrink: 0,
                                height: 46,
                                minWidth: 84,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 14,
                                border: "none",
                                background: promoInput.trim() ? C.red : "rgba(0,0,0,0.12)",
                                color: C.white,
                                fontFamily: C.mono,
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: promoInput.trim() ? (promoChecking ? "wait" : "pointer") : "default",
                                transition: "background 0.2s",
                              }}
                            >
                              {promoChecking ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <CircleNotch weight="bold" size={18} />
                                </motion.div>
                              ) : (
                                "Apply"
                              )}
                            </button>
                          </div>
                          <AnimatePresence>
                            {promoError && (
                              <motion.p
                                initial={{ opacity: 0, y: -5, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -5, height: 0 }}
                                style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, color: C.red }}
                              >
                                {promoError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                      {discount > 0 && appliedOffer && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, gap: 12 }}>
                          <span
                            style={{
                              color: "#12784A",
                              fontWeight: 700,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {appliedOffer.label}
                          </span>
                          <span style={{ fontWeight: 800, color: "#12784A", flexShrink: 0 }}>
                            −₹{discount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
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

              <h3 style={{ ...TYPO.sectionTitle, margin: "0 0 12px", opacity: 0.72 }}>
                {forSomeoneElse ? "Recipient drop-off" : "Delivery to"}
              </h3>
              <div
                style={{
                  background: C.surface,
                  borderRadius: 20,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: `1px solid ${
                    forSomeoneElse
                      ? recipientDrop
                        ? C.border
                        : "rgba(189,35,32,0.28)"
                      : locationInRange
                        ? C.border
                        : "rgba(245,158,11,0.45)"
                  }`,
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
                    {forSomeoneElse
                      ? recipientDrop?.label || `Pin their ${DELIVERY_ZONE.name} address`
                      : locationLabel}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: C.muted, fontWeight: 600 }}>
                    {forSomeoneElse
                      ? recipientDrop
                        ? "Driver navigates here and calls them"
                        : `Required — must be in ${DELIVERY_ZONE.name}`
                      : locationInRange
                        ? "Home-style meal, delivered to your pin"
                        : `You're outside ${DELIVERY_ZONE.name} — send to someone there`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={forSomeoneElse ? onPickRecipientAddress : onChangeLocation}
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
                  {forSomeoneElse && !recipientDrop ? "Pin" : "Change"}
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
                      onClick={() => {
                        const loc = {
                          label: place.address,
                          lat: place.lat,
                          lng: place.lng,
                          inRange: isInsideDeliveryZone(place.lat, place.lng),
                        };
                        if (forSomeoneElse) {
                          if (!loc.inRange) {
                            setCheckoutError(`That saved place is outside ${DELIVERY_ZONE.name}.`);
                            return;
                          }
                          onSetRecipientDrop?.(loc);
                          setCheckoutError(null);
                          return;
                        }
                        onSelectSavedLocation(place);
                      }}
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
                      Pin their {DELIVERY_ZONE.name} address above. The driver navigates to that pin and calls them — not where you are.
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
              <div style={{ display: "flex", gap: 10 }}>
                {(
                  [
                    {
                      id: "online",
                      label: "Pay Online",
                      sub: "UPI · Card · more",
                      icon: <Lightning size={22} weight="fill" color="rgba(0,0,0,0.7)" />,
                      disabled: false,
                    },
                    {
                      id: "cod",
                      label: "Pay at the door",
                      sub: codBlockedByTotal ? `Up to ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}` : "Cash or UPI",
                      icon: <Money size={22} weight="regular" color="rgba(0,0,0,0.7)" />,
                      disabled: codBlockedByTotal,
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
                        flex: 1,
                        padding: "14px 14px",
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

              {codBlockedByTotal && (
                <p style={{ margin: "10px 2px 0", fontSize: 11.5, fontWeight: 600, color: C.muted, lineHeight: 1.45 }}>
                  Cash on delivery is available on orders up to ₹
                  {COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}.
                </p>
              )}

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
