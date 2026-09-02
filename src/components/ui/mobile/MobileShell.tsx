"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, WarningCircle } from "@phosphor-icons/react";
import { PhoneLoginScreen } from "./PhoneLoginScreen";
import { PwaInstallBanner } from "@/components/ui/PwaInstallBanner";
import { LocationScreen } from "./LocationScreen";
import { LocationMarkedScreen } from "./LocationMarkedScreen";
import { MobileHomeScreen } from "./MobileHomeScreen";
import { CheckoutScreen } from "./CheckoutScreen";
import type { SavedPlace } from "@/lib/vk-saved-places";
import { clearUiSession, readUiSession, writeUiSession } from "@/lib/vk-ui-session";
import { isOrderInFlight } from "@/lib/order-status";

type MobileStep = "login" | "location" | "location_marked" | "home" | "checkout";

import { MENU_BY_CATEGORY, MenuItem } from "@/components/ui/mobile/mobileMenuData";
import { FestivalPricingProvider } from "./festival-pricing-context";
import {
  pickActiveFestival,
  mergeMenuDiscountOverrides,
  type FestivalRow,
  type DishDiscountRow,
} from "@/lib/menu/discount-pricing";

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
  // `cod` orders are placed but not paid for — the confirmation must not claim
  // we've taken any money, or the customer won't have cash ready at the door.
  | { kind: "success"; orderId: string; cod: boolean }
  | { kind: "error" }
  | { kind: "cancelled" };

export function MobileShell({ prefilledPhone, prefilledName, cancelOrderId, cancelPhone }: MobileShellProps) {
  // ── Sync Initial State from Storage ──────────────────────────────────────
  const [initialData] = useState(() => {
    if (typeof window === "undefined") {
      return {
        step: "login" as MobileStep,
        phone: "",
        name: "",
        location: null as LocationData | null,
        cart: {} as Record<string, number>,
        checkoutSourceDishId: null as string | null,
      };
    }

    const savedPhone = localStorage.getItem("vk_phone");
    const savedLocation = localStorage.getItem("vk_location");
    const savedName = localStorage.getItem(LS_NAME);
    const ui = readUiSession();

    let step: MobileStep = "login";
    let loc: LocationData | null = null;

    if (savedPhone) {
      if (savedLocation) {
        try {
          loc = JSON.parse(savedLocation);
          const restored = ui?.step;
          if (restored === "checkout" || restored === "home" || restored === "location") {
            step = restored;
          } else if (restored === "location_marked") {
            step = "home";
          } else {
            step = "home";
          }
        } catch {
          step = "location";
        }
      } else {
        step = "location";
      }
    } else if (prefilledPhone) {
      step = "location";
    }

    const cart =
      ui?.cart && typeof ui.cart === "object" ? ui.cart : ({} as Record<string, number>);

    return {
      step,
      phone: savedPhone || prefilledPhone || "",
      name: savedName || prefilledName || "",
      location: loc,
      cart,
      checkoutSourceDishId: ui?.checkoutSourceDishId ?? null,
    };
  });

  const [step, setStep] = useState<MobileStep>(initialData.step);
  const [phone, setPhone] = useState(initialData.phone);
  const [name, setName] = useState(initialData.name);
  const [location, setLocation] = useState<LocationData | null>(initialData.location);

  const [resumeCheckoutAfterLocation, setResumeCheckoutAfterLocation] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  /** Set while the location screen is being used to move an existing order. */
  const [editingAddressForOrder, setEditingAddressForOrder] = useState<string | null>(null);
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);
  /** Bumped on a successful save so tracking refetches instead of waiting. */
  const [addressSavedAt, setAddressSavedAt] = useState<number>(0);
  const [paymentFeedback, setPaymentFeedback] = useState<PaymentFeedback>(null);

  // ── Hoisted State for Cart & Menu ───────────────────────────────────────
  // Seeded synchronously from the static catalog so `cart` → `items` lookups
  // (e.g. on the Checkout screen) work even when the user lands directly on
  // checkout after a refresh, before MobileHomeScreen ever mounts to fetch it.
  const [items, setItems] = useState<MenuItem[]>(
    () => Object.values(MENU_BY_CATEGORY).flat() as MenuItem[]
  );
  const [cart, setCart] = useState<Record<string, number>>(initialData.cart);

  const [checkoutSourceDishId, setCheckoutSourceDishId] = useState<string | null>(
    initialData.checkoutSourceDishId
  );
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

  // Apply any Supabase price-override rows on top of the static catalog. Hoisted
  // here (rather than inside MobileHomeScreen) so it runs on every step, not just
  // when the home screen happens to be mounted.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = Object.values(MENU_BY_CATEGORY).flat() as MenuItem[];
        const res = await fetch("/api/menu/discount-settings", { cache: "no-store" });
        const json = (await res.json()) as { rows?: DishDiscountRow[] };
        if (!cancelled && Array.isArray(json.rows) && json.rows.length > 0) {
          setItems(mergeMenuDiscountOverrides(base, json.rows) as MenuItem[]);
        }
      } catch {
        /* keep the static catalog already seeded */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist shell route + cart across refresh
  useEffect(() => {
    if (step === "login") return;
    writeUiSession({
      step,
      cart,
      checkoutSourceDishId,
    });
  }, [step, cart, checkoutSourceDishId]);

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
      clearUiSession();
      window.history.replaceState({}, "", "/");
      setStep("login");
      setCart({});
      setTrackingOrderId(null);
      setPaymentFeedback(null);
      return;
    }

    const payStatus = params.get("status");
    const orderIdParam = params.get("orderId");
    const paidOk = payStatus === "success" && !!orderIdParam;
    if (paidOk && orderIdParam) {
      sessionStorage.removeItem(SS_PENDING_CHECKOUT_CART);
      sessionStorage.setItem(SS_TRACK_ORDER, orderIdParam);
      // Clear right away — don't wait on the modal's dismiss button. Otherwise a
      // refresh (or navigating away) before tapping "Continue" leaves the old
      // order's items stuck in the cart forever.
      setCart({});
      setPaymentFeedback({ kind: "success", orderId: orderIdParam, cod: params.get("method") === "cod" });
      params.delete("status");
      params.delete("orderId");
      params.delete("method");
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
    const ui = readUiSession();

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
          // Coming back from a successful payment we must NOT restore the saved
          // "checkout" route — the cart has just been emptied, so the customer
          // would land on a blank checkout. Home + a tracking id lands them on
          // the Order tab instead.
          if (paidOk) {
            setStep("home");
          } else if (ui?.step === "checkout" || ui?.step === "home" || ui?.step === "location") {
            // Keep restored route (checkout / home / location); don't force home on refresh
            setStep(ui.step);
          } else if (step !== "checkout" && step !== "home" && step !== "location") {
            setStep("home");
          }
          if (!paidOk && ui?.cart && typeof ui.cart === "object") setCart(ui.cart);
          if (ui?.checkoutSourceDishId) setCheckoutSourceDishId(ui.checkoutSourceDishId);
        } catch {
          setStep("location");
        }
      } else {
        setStep("location");
      }
    } else if (prefilledPhone) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once from URL/storage; step from initial state
  }, [prefilledPhone, prefilledName, cancelOrderId, cancelPhone]);

  /**
   * Pick up the customer's most recent in-flight order on a cold start.
   *
   * Which order is being tracked lives in sessionStorage, which Android throws
   * away when the app is swiped out of Recents. Reopening the app therefore
   * landed on "All orders" with an empty Live tab, even though an order was
   * still on its way. Runs once per launch so dismissing tracking during the
   * session isn't immediately undone.
   */
  const autoResumedTracking = useRef(false);
  useEffect(() => {
    if (autoResumedTracking.current) return;
    if (trackingOrderId) {
      autoResumedTracking.current = true;
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;

    autoResumedTracking.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/orders/history?phone=${encodeURIComponent(phone)}`);
        const data = (await res.json().catch(() => ({}))) as {
          orders?: { orderId: string; status: string }[];
        };
        if (cancelled || !Array.isArray(data.orders)) return;

        // The API already returns newest first.
        const live = data.orders.find((o) => isOrderInFlight(o.status));
        if (live) {
          sessionStorage.setItem(SS_TRACK_ORDER, live.orderId);
          setTrackingOrderId(live.orderId);
        }
      } catch {
        // Non-critical: the customer can still reach the order from All orders.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phone, trackingOrderId]);

  const clearOrderTracking = () => {
    sessionStorage.removeItem(SS_TRACK_ORDER);
    setTrackingOrderId(null);
  };

  /** Open live tracking for any past order picked from the history list. */
  const openOrderTracking = (orderId: string) => {
    sessionStorage.setItem(SS_TRACK_ORDER, orderId);
    setTrackingOrderId(orderId);
  };

  const handleSignOut = () => {
    localStorage.removeItem("vk_phone");
    localStorage.removeItem("vk_location");
    localStorage.removeItem(LS_NAME);
    sessionStorage.removeItem(SS_TRACK_ORDER);
    sessionStorage.removeItem(SS_PENDING_CHECKOUT_CART);
    clearUiSession();
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

    // Re-pointing an order that has already been placed. Until this persisted,
    // the pencil on the tracking panel only moved this device's pin — the
    // kitchen ticket and the driver's route kept the original address.
    if (editingAddressForOrder) {
      const orderId = editingAddressForOrder;
      setEditingAddressForOrder(null);
      setAddressSaveError(null);
      void (async () => {
        try {
          const res = await fetch("/api/orders/address", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, phone, address: loc.label, lat: loc.lat, lng: loc.lng }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(data.error || "Could not update the address");
          // Tracking polls every 10s, but the customer is looking at the screen
          // now and needs to see their own edit land.
          setAddressSavedAt(Date.now());
        } catch (e) {
          setAddressSaveError(e instanceof Error ? e.message : "Could not update the address");
        }
      })();
      setStep("home");
      return;
    }

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
              onEditOrderAddress={(orderId) => {
                setAddressSaveError(null);
                setEditingAddressForOrder(orderId);
                setStep("location");
              }}
              addressSaveError={addressSaveError}
              addressSavedAt={addressSavedAt}
              trackingOrderId={trackingOrderId}
              customerPhone={phone}
              onDismissOrderTracking={clearOrderTracking}
              onTrackOrder={openOrderTracking}
              onSignOut={handleSignOut}
              onProfileNameSave={(n) => {
                setName(n);
                localStorage.setItem(LS_NAME, n);
              }}
              onCheckout={(fromDishId) => {
                setReturnToCheckoutAfterBrowse(false);
                setCheckoutSourceDishId(fromDishId ?? null);
                writeUiSession({ checkoutPhase: "cart" });
                setStep("checkout");
              }}
              resumeDishDetail={resumeDishDetail}
              onResumeDishDetailConsumed={() => setResumeDishDetail(null)}
              openBrowseMenuSignal={browseMenuSignal}
              browseMenuExitToCheckout={
                returnToCheckoutAfterBrowse
                  ? () => {
                      setReturnToCheckoutAfterBrowse(false);
                      writeUiSession({ checkoutPhase: "cart" });
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

      <PwaInstallBanner active={step === "login"} />

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
                    <span style={{ color: "#1A1A1A", fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                      {paymentFeedback.cod ? "Order confirmed" : "Payment successful"}
                    </span>
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
                  paymentFeedback.cod ? (
                    <>
                      Order #{paymentFeedback.orderId.slice(0, 8)}… — please keep the cash ready for the driver. We’ll take you to
                      live tracking.
                    </>
                  ) : (
                    <>Order #{paymentFeedback.orderId.slice(0, 8)}… — we’ll take you to live tracking.</>
                  )
                ) : paymentFeedback.kind === "error" ? (
                  // We reach here after the customer came back from Razorpay, so
                  // money may well have left their account even though we failed
                  // to record it. Telling them to "try again" invites a second
                  // charge — send them to us instead.
                  <>
                    We couldn’t confirm your payment.{" "}
                    <span style={{ color: "#1A1A1A" }}>Don’t pay again</span> — if you were charged, message us on WhatsApp and
                    we’ll sort it out right away.
                  </>
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
                  if (kind === "success") {
                    setCart({});
                    setStep("home");
                  } else if (kind === "error") {
                    // Payment may have gone through, so don't drop them back on
                    // a checkout button that would charge them a second time.
                    setStep("home");
                  } else if (kind === "cancelled" && location) {
                    writeUiSession({ checkoutPhase: "cart" });
                    setStep("checkout");
                  }
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
                {paymentFeedback.kind === "success" ? "Track my order" : "Continue"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </FestivalPricingProvider>
  );
}
