"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneLoginScreen } from "./PhoneLoginScreen";
import { LocationScreen } from "./LocationScreen";
import { LocationMarkedScreen } from "./LocationMarkedScreen";
import { MobileHomeScreen } from "./MobileHomeScreen";
import { CheckoutScreen } from "./CheckoutScreen";

type MobileStep = "login" | "location" | "location_marked" | "home" | "checkout";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
}

interface LocationData {
  label: string;
  lat: number;
  lng: number;
  inRange: boolean;
}

interface MobileShellProps {
  prefilledPhone?: string;
  prefilledName?: string;
}

const LS_NAME = "vk_display_name";

export function MobileShell({ prefilledPhone, prefilledName }: MobileShellProps) {
  const [step, setStep] = useState<MobileStep>("login");
  const [phone, setPhone] = useState(prefilledPhone || "");
  const [name, setName] = useState(prefilledName || "");
  const [location, setLocation] = useState<LocationData | null>(null);

  // ── Hoisted State for Cart & Menu ───────────────────────────────────────
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart]   = useState<Record<string, number>>({});

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  // Restore session from localStorage
  useEffect(() => {
    // ?reset=true clears all cached session data (useful for testing)
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "true") {
      localStorage.removeItem("vk_phone");
      localStorage.removeItem("vk_location");
      localStorage.removeItem(LS_NAME);
      window.history.replaceState({}, "", "/");
      setStep("login");
      return;
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
  }, [prefilledPhone, prefilledName]);

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
    setStep("location_marked");
  };

  const handleLocationMarkedDone = () => {
    setStep("home");
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] mobile-shell">
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
              onCheckout={() => setStep("checkout")}
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
              onBack={() => setStep("home")}
              onAddMore={() => setStep("home")}
              onPlaceOrder={() => setCart({})}
              phone={phone}
              customerName={name}
              cart={cart}
              items={items}
              updateQty={updateQty}
              locationLabel={location.label}
              onChangeLocation={() => setStep("location")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
