"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, WarningCircle } from "@phosphor-icons/react";
import { PhoneLoginScreen } from "./PhoneLoginScreen";
import { LocationScreen } from "./LocationScreen";
import { LocationMarkedScreen } from "./LocationMarkedScreen";
import { MobileHomeScreen } from "./MobileHomeScreen";
import { CheckoutScreen } from "./CheckoutScreen";
import type { SavedPlace } from "@/lib/vk-saved-places";

type MobileStep = "login" | "location" | "location_marked" | "home" | "checkout";

import { MenuItem } from "@/components/ui/mobile/mobileMenuData";
import { FestivalPricingProvider } from "./festival-pricing-context";
import { pickActiveFestival, type FestivalRow } from "@/lib/menu/discount-pricing";

interface LocationData {
  label: string;
  lat: number;
  lng: number;
  inRange: boolean;
}

interface MobileShellProps {
  prefilledPhone?: string;
  prefilledName?: string;
  cancelOrderId?: string;
  cancelPhone?: string;
}

const LS_NAME = "vk_display_name";
const SS_TRACK_ORDER = "vk_track_order";
/** Snapshot cart before opening Razorpay so cancel/error can restore after full page reload. */
const SS_PENDING_CHECKOUT_CART = "vk_pending_checkout_cart";

type PaymentFeedback =
  | null
  | { kind: "success"; orderId: string }
  | { kind: "error" }
  | { kind: "cancelled" };

export function MobileShell({ prefilledPhone, prefilledName, cancelOrderId, cancelPhone }: MobileShellProps) {
  // ── Sync Initial State from Storage ──────────────────────────────────────
  const [initialData] = useState(() => {
    if (typeof window === "undefined") return { step: "login" as MobileStep, phone: "", name: "", location: null as LocationData | null };
    
    const savedPhone = localStorage.getItem("vk_phone");
    const savedLocation = localStorage.getItem("vk_location");
    const savedName = localStorage.getItem(LS_NAME);
    
    let step: MobileStep = "login";
    let loc: LocationData | null = null;
    
    if (savedPhone) {
      if (savedLocation) {
        try { loc = JSON.parse(savedLocation); step = "home"; } 
        catch { step = "location"; }
      } else {
        step = "location";
      }
    } else if (prefilledPhone) {
      step = "location";
    }

    return { 
      step, 
      phone: savedPhone || prefilledPhone || "", 
      name: savedName || prefilledName || "", 
      location: loc 
    };
  });

  const [step, setStep] = useState<MobileStep>(initialData.step);
  const [phone, setPhone] = useState(initialData.phone);
  const [name, setName] = useState(initialData.name);
  const [location, setLocation] = useState<LocationData | null>(initialData.location);
  
  const [resumeCheckoutAfterLocation, setResumeCheckoutAfterLocation] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<PaymentFeedback>(null);

  // ── Hoisted State for Cart & Menu ───────────────────────────────────────
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart]   = useState<Record<string, number>>({});

  const [checkoutSourceDishId, setCheckoutSourceDishId] = useState<string | null>(null);
  const [resumeDishDetail, setResumeDishDetail] = useState<{ id: string; nonce: number } | null>(null);
  const [browseMenuSignal, setBrowseMenuSignal] = useState(0);
  /** True after “Add more” from checkout — Browse Menu back should return to checkout. */
  const [returnToCheckoutAfterBrowse, setReturnToCheckoutAfterBrowse] = useState(false);

  const [activeFestival, setActiveFestival] = useState<FestivalRow | null>(null);

  const updateQty = (key: string, delta: number) => {
    setCart(prev => {
      const current = prev[key] || 0;
      const next = Math.max(0, current + delta);
      
      const copy = { ...prev };
      if (next === 0) {
        delete copy[key];
      } else {
        copy[key] = next;
      }
      return copy;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/menu/festivals", { cache: "no-store" });
        const j = (await res.json()) as { rows?: FestivalRow[] };
        const list = j.rows ?? [];
        if (!cancelled) setActiveFestival(list.length ? pickActiveFestival(list) : null);
      } catch {
        if (!cancelled) setActiveFestival(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    // ?reset=true clears all cached session data (useful for testing)
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "true") {
      localStorage.removeItem("vk_phone");
      localStorage.removeItem("vk_location");
      localStorage.removeItem(LS_NAME);
      sessionStorage.removeItem(SS_TRACK_ORDER);
      sessionStorage.removeItem(SS_PENDING_CHECKOUT_CART);
      window.history.replaceState({}, "", "/");
      setStep("login");
      setTrackingOrderId(null);
      setPaymentFeedback(null);
      return;
    }

    const payStatus = params.get("status");
    const orderIdParam = params.get("orderId");
    if (payStatus === "success" && orderIdParam) {
      sessionStorage.removeItem(SS_PENDING_CHECKOUT_CART);
      sessionStorage.setItem(SS_TRACK_ORDER, orderIdParam);
      setPaymentFeedback({ kind: "success", orderId: orderIdParam });
      params.delete("status");
      params.delete("orderId");
      const rest = params.toString();
      window.history.replaceState({}, "", rest ? `/?${rest}` : "/");
    } else if (payStatus === "error") {
      try {
        const raw = sessionStorage.getItem(SS_PENDING_CHECKOUT_CART);
        if (raw) {
          const parsed = JSON.parse(raw) as { cart?: Record<string, number> };
          if (parsed.cart && typeof parsed.cart === "object") setCart(parsed.cart);
        }
      } catch {
        /* noop */
      }
      sessionStorage.removeItem(SS_PENDING_CHECKOUT_CART);
      setPaymentFeedback({ kind: "error" });
      params.delete("status");
      const rest = params.toString();
      window.history.replaceState({}, "", rest ? `/?${rest}` : "/");
    } else if (payStatus === "cancelled") {
      try {
        const raw = sessionStorage.getItem(SS_PENDING_CHECKOUT_CART);
        if (raw) {
          const parsed = JSON.parse(raw) as { cart?: Record<string, number> };
          if (parsed.cart && typeof parsed.cart === "object") setCart(parsed.cart);
        }
      } catch {
        /* noop */
      }
      sessionStorage.removeItem(SS_PENDING_CHECKOUT_CART);
      setPaymentFeedback({ kind: "cancelled" });
      params.delete("status");
      const rest = params.toString();
      window.history.replaceState({}, "", rest ? `/?${rest}` : "/");
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const deepTrack = params.get("track");
    if (deepTrack && uuidRe.test(deepTrack)) {
      sessionStorage.setItem(SS_TRACK_ORDER, deepTrack);
      setTrackingOrderId(deepTrack);
      params.delete("track");
      const rest = params.toString();
      window.history.replaceState({}, "", rest ? `/?${rest}` : "/");
    }

    const savedPhone = localStorage.getItem("vk_phone");
    const savedLocation = localStorage.getItem("vk_location");
    const savedName = localStorage.getItem(LS_NAME);

    if (prefilledName?.trim()) {
      setName(prefilledName.trim());
      localStorage.setItem(LS_NAME, prefilledName.trim());
    } else if (savedName) {
      setName(savedName);
    }

    if (savedPhone) {
      setPhone(savedPhone);
      if (savedLocation) {
        try {
          const loc = JSON.parse(savedLocation) as LocationData;
          setLocation(loc);
          setStep("home"); // Returning user → home (use ?reset=true while testing to clear session)
        } catch {
          setStep("location");
        }
      } else {
        setStep("location");
      }
    } else if (prefilledPhone) {
      // Came from WhatsApp with phone in URL param
      setPhone(prefilledPhone);
      localStorage.setItem("vk_phone", prefilledPhone);
      if (prefilledName) {
        setName(prefilledName);
        localStorage.setItem(LS_NAME, prefilledName);
      }
      setStep("location");
    }

    const track = sessionStorage.getItem(SS_TRACK_ORDER);
    if (track) setTrackingOrderId(track);

    if (cancelOrderId) {
      sessionStorage.setItem(SS_TRACK_ORDER, cancelOrderId);
      setTrackingOrderId(cancelOrderId);
      if (cancelPhone) {
        setPhone(cancelPhone);
        localStorage.setItem("vk_phone", cancelPhone);
      }
      setStep("home");
    }
  }, [prefilledPhone, prefilledName, cancelOrderId, cancelPhone]);

  const clearOrderTracking = () => {
    sessionStorage.removeItem(SS_TRACK_ORDER);
    setTrackingOrderId(null);
  };

  const handleSignOut = () => {
    localStorage.removeItem("vk_phone");
    localStorage.removeItem("vk_location");
    localStorage.removeItem(LS_NAME);
    sessionStorage.removeItem(SS_TRACK_ORDER);
    sessionStorage.removeItem(SS_PENDING_CHECKOUT_CART);
    setPhone("");
    setName("");
    setLocation(null);
    setTrackingOrderId(null);
    setCart({});
    setStep("login");
  };

  const handleVerified = (verifiedPhone: string, displayName: string) => {
    setPhone(verifiedPhone);
    setName(displayName);
    localStorage.setItem("vk_phone", verifiedPhone);
    localStorage.setItem(LS_NAME, displayName);
    setStep("location");
  };

  const handleLocationSet = (loc: LocationData) => {
    setLocation(loc);
    localStorage.setItem("vk_location", JSON.stringify(loc));
    if (resumeCheckoutAfterLocation) {
      setResumeCheckoutAfterLocation(false);
      setStep("checkout");
      return;
    }
    setStep("location_marked");
  };

  const handleLocationMarkedDone = () => {
    setStep("home");
  };

  return (
    <FestivalPricingProvider active={activeFestival}>
    <div className="fixed inset-0 bg-[#F5F5F7] mobile-shell">
      <AnimatePresence mode="wait">
        {step === "login" && (
          <motion.div key="login" className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <PhoneLoginScreen onVerified={handleVerified} prefilledPhone={prefilledPhone} displayName={prefilledName?.trim() || name} />
          </motion.div>
        )}

        {step === "location" && (
          <motion.div
            key="location"
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 1.35, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.4, 0, 1, 1] } }}
          >
            <LocationScreen onLocationSet={handleLocationSet} />
          </motion.div>
        )}

        {step === "location_marked" && location && (
          <motion.div
            key="location-marked"
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <LocationMarkedScreen label={location.label} onDone={handleLocationMarkedDone} />
          </motion.div>
        )}

        {step === "home" && (
          <motion.div key="home" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
            <MobileHomeScreen
              displayName={name}
              location={location}
              onChangeLocation={() => setStep("location")}
              trackingOrderId={trackingOrderId}
              customerPhone={phone}
              onDismissOrderTracking={clearOrderTracking}
              onSignOut={handleSignOut}
              onProfileNameSave={(n) => {
                setName(n);
                localStorage.setItem(LS_NAME, n);
              }}
              onCheckout={(fromDishId) => {
                setReturnToCheckoutAfterBrowse(false);
                setCheckoutSourceDishId(fromDishId ?? null);
                setStep("checkout");
              }}
              resumeDishDetail={resumeDishDetail}
              onResumeDishDetailConsumed={() => setResumeDishDetail(null)}
              openBrowseMenuSignal={browseMenuSignal}
              browseMenuExitToCheckout={
                returnToCheckoutAfterBrowse
                  ? () => {
                      setReturnToCheckoutAfterBrowse(false);
                      setStep("checkout");
                    }
                  : undefined
              }
              items={items}
              setItems={setItems}
              cart={cart}
              updateQty={updateQty}
            />
          </motion.div>
        )}
        {step === "checkout" && location && (
          <motion.div
            key="checkout"
            className="w-full h-full"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <CheckoutScreen
              onBack={() => {
                const sid = checkoutSourceDishId;
                setCheckoutSourceDishId(null);
                setStep("home");
                if (sid) setResumeDishDetail({ id: sid, nonce: Date.now() });
              }}
              onAddMore={() => {
                setReturnToCheckoutAfterBrowse(true);
                setStep("home");
                setBrowseMenuSignal((n) => n + 1);
              }}
              phone={phone}
              customerName={name}
              deliveryLat={location.lat}
              deliveryLng={location.lng}
              cart={cart}
              items={items}
              updateQty={updateQty}
              locationLabel={location.label}
              onChangeLocation={() => {
                setResumeCheckoutAfterLocation(true);
                setStep("location");
              }}
              onSelectSavedLocation={(place) => {
                const loc: LocationData = {
                  label: place.address,
                  lat: place.lat,
                  lng: place.lng,
                  inRange: true,
                };
                setLocation(loc);
                localStorage.setItem("vk_location", JSON.stringify(loc));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paymentFeedback && (
          <motion.div
            key="payment-feedback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 500,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{
                maxWidth: 340,
                width: "100%",
                borderRadius: 24,
                padding: "28px 24px",
                background: "rgba(255,255,255,0.97)",
                border: "1px solid rgba(0,0,0,0.06)",
                textAlign: "center",
                fontFamily: "var(--font-outfit), system-ui, sans-serif",
              }}
            >
              {paymentFeedback.kind === "success" ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                    style={{
                      width: 56,
                      height: 56,
                      margin: "0 auto 16px",
                      borderRadius: "50%",
                      background: "rgba(34,197,94,0.14)",
                      border: "1.5px solid rgba(34,197,94,0.45)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={28} weight="bold" color="#22c55e" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.35 }}
                    style={{
                      margin: "0 auto 8px",
                      display: "inline-block",
                      padding: "8px 18px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(34,197,94,0.45)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  >
                    <span style={{ color: "#1A1A1A", fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Payment successful</span>
                  </motion.div>
                </>
              ) : paymentFeedback.kind === "error" ? (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    margin: "0 auto 16px",
                    borderRadius: "50%",
                    background: "rgba(239,68,68,0.12)",
                    border: "2px solid rgba(239,68,68,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={40} weight="bold" color="#f87171" />
                </div>
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    margin: "0 auto 16px",
                    borderRadius: "50%",
                    background: "rgba(251,191,36,0.12)",
                    border: "2px solid rgba(251,191,36,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <WarningCircle size={40} weight="bold" color="#fbbf24" />
                </div>
              )}
              {paymentFeedback.kind !== "success" ? (
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#1A1A1A" }}>
                  {paymentFeedback.kind === "error" ? "Payment failed" : "Checkout closed"}
                </h2>
              ) : null}
              <p
                style={{
                  margin: paymentFeedback.kind === "success" ? "16px 0 0" : "12px 0 0",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "rgba(0,0,0,0.55)",
                  fontWeight: 600,
                }}
              >
                {paymentFeedback.kind === "success" ? (
                  <>Order #{paymentFeedback.orderId.slice(0, 8)}… — check the Order tab for live updates.</>
                ) : paymentFeedback.kind === "error" ? (
                  <>Something went wrong completing payment. Your cart is unchanged — try again from checkout.</>
                ) : (
                  <>
                    You left the payment screen before paying — <span style={{ color: "#1A1A1A" }}>no order was placed</span> in the
                    kitchen. Your cart is still here; open checkout when you’re ready.
                  </>
                )}
              </p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const kind = paymentFeedback?.kind;
                  if (kind === "success") setCart({});
                  else if ((kind === "error" || kind === "cancelled") && location) setStep("checkout");
                  setPaymentFeedback(null);
                }}
                style={{
                  marginTop: 22,
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: "none",
                  background: "linear-gradient(135deg, #BD2320 0%, #8B1A18 100%)",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Continue
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </FestivalPricingProvider>
  );
}
