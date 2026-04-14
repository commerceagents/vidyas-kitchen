"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LocationData {
  label: string;
  lat: number;
  lng: number;
  inRange: boolean;
}

interface SavedPlace {
  id: string;
  label: "Home" | "Work" | "Other";
  address: string;
  lat: number;
  lng: number;
}

interface LocationScreenProps {
  onLocationSet: (loc: LocationData) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SIVAKASI_CENTER = { lat: 9.452, lng: 77.798 };
const MAX_DISTANCE_KM = 15;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Dark custom map style matching the app theme
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Spring variants ──────────────────────────────────────────────────────────
const springReveal = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 380,
      damping: 28,
      delay: i * 0.07,
    },
  }),
};

const sheetReveal = {
  hidden: { y: "100%", opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 32, delay: 0.25 },
  },
};

const topBarReveal = {
  hidden: { y: -60, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 340, damping: 28, delay: 0.1 },
  },
};

// ─── Icons ────────────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function WorkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PinIcon({ color = "#BD2320" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="9" r="2.5" fill={color} />
    </svg>
  );
}

function GPSIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ─── Map Pin Marker ───────────────────────────────────────────────────────────
function MapPin() {
  return (
    <motion.div
      initial={{ scale: 0, y: -20 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.5 }}
      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      {/* Pulse ring */}
      <motion.div
        animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        style={{
          position: "absolute",
          top: "2px",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(189,35,32,0.4)",
          pointerEvents: "none",
        }}
      />
      {/* Pin SVG */}
      <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
        <path
          d="M18 2C10.27 2 4 8.27 4 16c0 9.75 14 26 14 26S32 25.75 32 16C32 8.27 25.73 2 18 2z"
          fill="#BD2320"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <circle cx="18" cy="16" r="5" fill="white" />
        <circle cx="18" cy="16" r="3" fill="#BD2320" />
      </svg>
      {/* Drop shadow */}
      <motion.div
        animate={{ scaleX: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 16, height: 4, borderRadius: 8,
          background: "rgba(0,0,0,0.6)",
          filter: "blur(2px)", marginTop: -4,
        }}
      />
    </motion.div>
  );
}

// ─── No Token Fallback Map ────────────────────────────────────────────────────
function FallbackMap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "linear-gradient(160deg, #0d0d0d 0%, #111 40%, #0a0a0a 100%)",
      overflow: "hidden",
    }}>
      {/* Grid lines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(189,35,32,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(189,35,32,0.06) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />
      {/* Roads simulation */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <path d="M0 300 Q100 280 200 300 T400 290" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <path d="M0 450 Q150 430 400 460" stroke="rgba(255,255,255,0.04)" strokeWidth="12" fill="none" />
        <path d="M180 0 Q190 200 185 400 T175 800" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <path d="M280 0 Q290 150 285 300 T275 800" stroke="rgba(255,255,255,0.04)" strokeWidth="5" fill="none" />
        <path d="M0 200 Q200 180 400 210" stroke="rgba(189,35,32,0.12)" strokeWidth="6" fill="none" />
        <path d="M0 550 Q180 530 400 560" stroke="rgba(189,35,32,0.08)" strokeWidth="4" fill="none" />
      </svg>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "35%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 300, height: 300,
        background: "radial-gradient(circle, rgba(189,35,32,0.12) 0%, transparent 70%)",
        filter: "blur(40px)", borderRadius: "50%",
      }} />
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function LocationScreen({ onLocationSet }: LocationScreenProps) {
  const [viewState, setViewState] = useState({
    longitude: SIVAKASI_CENTER.lng,
    latitude: SIVAKASI_CENTER.lat,
    zoom: 13,
  });
  const [pinCoords, setPinCoords] = useState(SIVAKASI_CENTER);
  const [searchText, setSearchText] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [savedPlaces] = useState<SavedPlace[]>([
    { id: "home", label: "Home", address: "Add home address", lat: 0, lng: 0 },
    { id: "work", label: "Work", address: "Add work address", lat: 0, lng: 0 },
  ]);
  const [selectedSaved, setSelectedSaved] = useState<string | null>(null);
  const mapLoaded = useRef(false);

  const handleGPS = useCallback(() => {
    setIsDetecting(true);
    if (!navigator.geolocation) {
      setIsDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setViewState((v) => ({ ...v, longitude, latitude, zoom: 15 }));
        setPinCoords({ lat: latitude, lng: longitude });
        setIsDetecting(false);
        setSelectedSaved(null);
      },
      () => setIsDetecting(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleSavedSelect = (place: SavedPlace) => {
    if (place.lat === 0) return; // not yet set
    setSelectedSaved(place.id);
    setViewState((v) => ({ ...v, longitude: place.lng, latitude: place.lat, zoom: 15 }));
    setPinCoords({ lat: place.lat, lng: place.lng });
  };

  const handleConfirm = () => {
    const label = selectedSaved
      ? savedPlaces.find((p) => p.id === selectedSaved)?.label || "Saved Location"
      : searchText.trim() || "Current Location";
    const dist = getDistanceKm(pinCoords.lat, pinCoords.lng, SIVAKASI_CENTER.lat, SIVAKASI_CENTER.lng);
    onLocationSet({
      label,
      lat: pinCoords.lat,
      lng: pinCoords.lng,
      inRange: dist <= MAX_DISTANCE_KM || label === "Current Location",
    });
  };

  const handleSkip = () => {
    onLocationSet({ label: "Sivakasi", lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true });
  };

  const hasToken = MAPBOX_TOKEN.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", overflow: "hidden" }}>

      {/* ── FULL SCREEN MAP ── */}
      {hasToken ? (
        <Map
          {...viewState}
          onMove={(e) => setViewState(e.viewState)}
          mapStyle={MAP_STYLE}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          onLoad={() => { mapLoaded.current = true; }}
          attributionControl={false}
        >
          <Marker longitude={pinCoords.lng} latitude={pinCoords.lat} anchor="bottom">
            <MapPin />
          </Marker>
          <NavigationControl position="bottom-right" />
        </Map>
      ) : (
        <FallbackMap>
          {/* Static pin in center when no token */}
          <div style={{
            position: "absolute", top: "38%", left: "50%",
            transform: "translate(-50%, -100%)",
          }}>
            <MapPin />
          </div>
        </FallbackMap>
      )}

      {/* Map bottom fade — blends map into sheet */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "45%",
        background: "linear-gradient(to top, #0a0a0a 20%, transparent 100%)",
        pointerEvents: "none",
        zIndex: 5,
      }} />

      {/* ── TOP BAR ── glass sqircle pill */}
      <motion.div
        variants={topBarReveal}
        initial="hidden"
        animate="show"
        style={{
          position: "absolute",
          top: 16, left: 16, right: 16,
          zIndex: 20,
          background: "rgba(14,14,14,0.75)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Logo dot */}
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: "rgba(189,35,32,0.15)",
          border: "1px solid rgba(189,35,32,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#BD2320">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" fill="white" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
            Delivering to
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 700, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {searchText || "Set your location"}
          </p>
        </div>
        {/* GPS button */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleGPS}
          style={{
            background: isDetecting ? "rgba(189,35,32,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isDetecting ? "rgba(189,35,32,0.4)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 12,
            padding: "7px 10px",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            color: isDetecting ? "#BD2320" : "rgba(255,255,255,0.6)",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
            flexShrink: 0,
          }}
        >
          <motion.span
            animate={isDetecting ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 1, repeat: isDetecting ? Infinity : 0, ease: "linear" }}
            style={{ display: "flex" }}
          >
            <GPSIcon />
          </motion.span>
          {isDetecting ? "..." : "GPS"}
        </motion.button>
      </motion.div>

      {/* ── BOTTOM GLASS SHEET ── */}
      <motion.div
        variants={sheetReveal}
        initial="hidden"
        animate="show"
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          zIndex: 20,
          background: "rgba(12,12,12,0.88)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderRadius: "28px 28px 0 0",
          border: "1px solid rgba(255,255,255,0.07)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
          padding: "20px 20px 36px",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.12)",
          margin: "0 auto 20px",
        }} />

        {/* Search bar */}
        <motion.div
          custom={0}
          variants={springReveal}
          initial="hidden"
          animate="show"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.05)",
            border: `1.5px solid ${searchFocused ? "rgba(189,35,32,0.5)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 16,
            padding: "12px 14px",
            marginBottom: 16,
            transition: "border-color 0.2s",
            boxShadow: searchFocused ? "0 0 0 3px rgba(189,35,32,0.08)" : "none",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.3)", display: "flex", flexShrink: 0 }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search area, street, landmark..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#fff", fontSize: 14, fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          />
          <AnimatePresence>
            {searchText.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearchText("")}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "none",
                  borderRadius: 8, width: 22, height: 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 14,
                  flexShrink: 0,
                }}
              >
                ×
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Saved places row */}
        <motion.div
          custom={1}
          variants={springReveal}
          initial="hidden"
          animate="show"
          style={{ marginBottom: 20 }}
        >
          <p style={{
            margin: "0 0 10px", fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
          }}>
            Saved Places
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {savedPlaces.map((place, i) => {
              const isSelected = selectedSaved === place.id;
              return (
                <motion.button
                  key={place.id}
                  custom={i + 1}
                  variants={springReveal}
                  initial="hidden"
                  animate="show"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleSavedSelect(place)}
                  style={{
                    flex: 1,
                    background: isSelected ? "rgba(189,35,32,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${isSelected ? "rgba(189,35,32,0.4)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 14,
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ color: isSelected ? "#BD2320" : "rgba(255,255,255,0.4)", display: "flex" }}>
                    {place.label === "Home" ? <HomeIcon /> : <WorkIcon />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, color: isSelected ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                      {place.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {place.address}
                    </p>
                  </div>
                </motion.button>
              );
            })}

            {/* "Other" spot */}
            <motion.button
              custom={3}
              variants={springReveal}
              initial="hidden"
              animate="show"
              whileTap={{ scale: 0.94 }}
              style={{
                width: 52,
                background: "rgba(255,255,255,0.04)",
                border: "1.5px solid rgba(255,255,255,0.07)",
                borderRadius: 14,
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                color: "rgba(255,255,255,0.3)",
                padding: "10px 8px",
              }}
            >
              <span style={{ fontSize: 16 }}>+</span>
              <span style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Other</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Use current location row */}
        <motion.button
          custom={3}
          variants={springReveal}
          initial="hidden"
          animate="show"
          whileTap={{ scale: 0.97 }}
          onClick={handleGPS}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1.5px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "12px 14px",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "rgba(189,35,32,0.1)",
            border: "1px solid rgba(189,35,32,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ color: "#BD2320", display: "flex" }}><GPSIcon /></span>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 700 }}>Use current location</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Detect via GPS</p>
          </div>
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>›</span>
        </motion.button>

        {/* Confirm CTA */}
        <motion.div
          custom={4}
          variants={springReveal}
          initial="hidden"
          animate="show"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleConfirm}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #BD2320 0%, #8B1A18 100%)",
              border: "none", borderRadius: 16,
              padding: "16px",
              cursor: "pointer",
              color: "#fff", fontSize: 14, fontWeight: 800,
              letterSpacing: "0.08em", textTransform: "uppercase",
              boxShadow: "0 4px 20px rgba(189,35,32,0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 12,
            }}
          >
            <span style={{ display: "flex" }}><PinIcon color="#fff" /></span>
            Confirm Location
          </motion.button>

          <button
            onClick={handleSkip}
            style={{
              background: "none", border: "none",
              color: "rgba(255,255,255,0.25)",
              fontSize: 11, letterSpacing: "0.1em",
              textTransform: "uppercase", fontWeight: 600,
              cursor: "pointer", width: "100%", padding: 4,
            }}
          >
            Skip for now
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
