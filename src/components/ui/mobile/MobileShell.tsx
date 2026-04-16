"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneLoginScreen } from "./PhoneLoginScreen";
import { LocationScreen } from "./LocationScreen";
import { DeliveryCheckScreen } from "./DeliveryCheckScreen";

type MobileStep = "login" | "location" | "delivery_check" | "home";

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
    setStep("delivery_check");
  };

  const handleProceedToHome = () => {
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

        {step === "delivery_check" && location && (
          <motion.div key="check" className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <DeliveryCheckScreen
              locationLabel={location.label}
              inRange={location.inRange}
              onProceed={handleProceedToHome}
              phone={phone}
              displayName={name}
            />
          </motion.div>
        )}

        {step === "home" && (
          <motion.div key="home" className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {/* Mobile Home Placeholder — Next phase */}
            <div className="flex flex-col items-center justify-center h-full text-white px-8 text-center">
              <div className="mb-4 w-12 h-12 rounded-full bg-[#BD2320]/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#BD2320">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" fill="white" />
                </svg>
              </div>
              {location && (
                <div className="flex items-center gap-1.5 mb-6 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#BD2320] animate-pulse" />
                  <span className="text-white/70 text-sm">{location.label}</span>
                </div>
              )}
              <h2 className="text-2xl font-bold mb-2">Home is coming next!</h2>
              <p className="text-white/40 text-sm">The full menu & ordering experience is being built.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
