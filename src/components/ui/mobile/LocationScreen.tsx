"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Sivakasi bounding box (rough ~20km radius)
const SIVAKASI_CENTER = { lat: 9.4531, lng: 77.7979 };
const MAX_DISTANCE_KM = 25;

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const area =
      data.address?.suburb ||
      data.address?.town ||
      data.address?.city ||
      data.address?.village ||
      data.address?.county ||
      "Your Location";
    const state = data.address?.state || "";
    return state ? `${area}, ${state}` : area;
  } catch {
    return "Your Location";
  }
}

type LocationState = "idle" | "requesting" | "detecting" | "success" | "denied" | "outside";

interface LocationScreenProps {
  onLocationSet: (location: { label: string; lat: number; lng: number; inRange: boolean }) => void;
}

export function LocationScreen({ onLocationSet }: LocationScreenProps) {
  const [state, setState] = useState<LocationState>("idle");
  const [locationLabel, setLocationLabel] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");

  const detectLocation = () => {
    if (!navigator.geolocation) { setState("denied"); return; }
    setState("requesting");
    setTimeout(() => setState("detecting"), 600);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        setLocationLabel(label);
        const dist = getDistanceKm(latitude, longitude, SIVAKASI_CENTER.lat, SIVAKASI_CENTER.lng);
        setState("success");
        setTimeout(() => {
          onLocationSet({ label, lat: latitude, lng: longitude, inRange: dist <= MAX_DISTANCE_KM });
        }, 1800);
      },
      () => setState("denied"),
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    onLocationSet({ label: manualInput.trim(), lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true });
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Blurred hero background */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-110"
        style={{
          backgroundImage: "url('/images/hero-spread.png')",
          filter: "blur(20px) brightness(0.25)",
        }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#0a0a0a]/70" />

      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#E21F27] opacity-10 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center">

        <AnimatePresence mode="wait">
          {/* IDLE — Ask permission */}
          {(state === "idle" || state === "denied") && !manualMode && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              {/* Pin icon */}
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full bg-[#E21F27]/15 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-[#E21F27]/25 flex items-center justify-center">
                    <LocationPinIcon size={32} />
                  </div>
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#E21F27]/30"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              </div>

              <h2 className="text-white text-2xl font-bold mb-3">
                {state === "denied" ? "Location access denied" : "What's your location?"}
              </h2>
              <p className="text-white/50 text-sm leading-relaxed mb-8 max-w-xs">
                {state === "denied"
                  ? "Please allow location access in your browser settings, or enter your area manually."
                  : "We'll check if we deliver to your area and set your address for faster checkout."}
              </p>

              <motion.button
                onClick={detectLocation}
                whileTap={{ scale: 0.96 }}
                className="w-full bg-[#E21F27] text-white font-semibold py-4 rounded-2xl mb-4 text-base"
              >
                Detect My Location
              </motion.button>

              <button
                onClick={() => setManualMode(true)}
                className="text-white/40 text-sm"
              >
                Enter location manually
              </button>
            </motion.div>
          )}

          {/* REQUESTING / DETECTING */}
          {(state === "requesting" || state === "detecting") && (
            <motion.div
              key="detecting"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-8">
                {/* Pulsing rings */}
                {[1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-[#E21F27]/40"
                    style={{ margin: `-${i * 16}px` }}
                    animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.8, delay: i * 0.3 }}
                  />
                ))}
                <div className="w-24 h-24 rounded-full bg-[#E21F27]/20 flex items-center justify-center">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  >
                    <LocationPinIcon size={36} />
                  </motion.div>
                </div>
              </div>

              <h2 className="text-white text-xl font-bold mb-2">Finding your location</h2>
              <p className="text-white/40 text-sm">
                {state === "requesting" ? "Requesting GPS access..." : "Pinpointing your area..."}
              </p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {state === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <motion.div
                className="w-24 h-24 rounded-full bg-[#E21F27]/20 flex items-center justify-center mb-6"
                animate={{ scale: [0.8, 1.05, 1] }}
                transition={{ duration: 0.5 }}
              >
                <motion.svg
                  width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="#E21F27" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <motion.path d="M5 13l4 4L19 7" />
                </motion.svg>
              </motion.div>

              <h2 className="text-white text-xl font-bold mb-2">Location found!</h2>
              <p className="text-white/60 text-sm mb-1">Delivering to</p>
              <p className="text-white text-lg font-semibold">{locationLabel}</p>
            </motion.div>
          )}

          {/* MANUAL INPUT */}
          {manualMode && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
              className="w-full flex flex-col items-center"
            >
              <button
                onClick={() => setManualMode(false)}
                className="flex items-center gap-1 text-white/40 text-sm mb-6 self-start"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <LocationPinIcon size={32} className="mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">Enter your area</h2>
              <p className="text-white/40 text-sm mb-6">Type your locality in Sivakasi</p>

              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="e.g. Vivekananda Nagar, Sivakasi"
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-2xl px-4 py-4 text-white text-base outline-none focus:border-[#E21F27]/50 placeholder:text-white/25 mb-4"
              />

              <motion.button
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-[#E21F27] text-white font-semibold py-4 rounded-2xl disabled:opacity-40"
              >
                Confirm Location
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LocationPinIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="#E21F27"
      />
      <circle cx="12" cy="9" r="2.5" fill="white" />
    </svg>
  );
}
