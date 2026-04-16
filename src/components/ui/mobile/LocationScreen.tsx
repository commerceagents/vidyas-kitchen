"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Map, { Marker } from "react-map-gl/mapbox";
import { House, Briefcase, MapPin as MapPinIcon } from "@phosphor-icons/react";
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

interface GeoFeature {
  place_name: string;
  center: [number, number];
}

interface LocationScreenProps {
  onLocationSet: (loc: LocationData) => void;
}
type TipTone = "info" | "warn" | "success";

// ─── Constants ────────────────────────────────────────────────────────────────
const SIVAKASI_CENTER = { lat: 9.452, lng: 77.798 };
const MAX_DISTANCE_KM = 15;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";
const LS_SAVED_PLACES = "vk_saved_places";

const DEFAULT_PLACES: SavedPlace[] = [
  { id: "home", label: "Home", address: "Add home address", lat: 0, lng: 0 },
  { id: "work", label: "Work", address: "Add work address", lat: 0, lng: 0 },
  { id: "other", label: "Other", address: "Add other address", lat: 0, lng: 0 },
];


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

function loadSavedPlaces(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(LS_SAVED_PLACES);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedPlace[];
      return DEFAULT_PLACES.map((base) => parsed.find((p) => p.id === base.id) || base);
    }
  } catch {}
  return DEFAULT_PLACES;
}

function savePlaces(places: SavedPlace[]) {
  try { localStorage.setItem(LS_SAVED_PLACES, JSON.stringify(places)); } catch {}
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

function OtherIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s7-7.75 7-13a7 7 0 10-14 0c0 5.25 7 13 7 13z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="8.5" r="2.3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4h8v2M9 10v7M15 10v7M6 6l1 14h10l1-14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function RecenterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Map Pin Marker — neon glow ───────────────────────────────────────────────
function MapPin() {
  return (
    <motion.div
      initial={{ scale: 0, y: -20 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.5 }}
      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      {/* Expanding neon rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: [1, 3.5 + i * 1.2], opacity: [0.5 - i * 0.1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: i * 0.55 }}
          style={{
            position: "absolute",
            top: "8px",
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "1.5px solid rgba(189,35,32,0.7)",
            pointerEvents: "none",
          }}
        />
      ))}
      {/* Pin SVG with neon drop-shadow */}
      <svg
        width="36" height="44" viewBox="0 0 36 44" fill="none"
        style={{ filter: "drop-shadow(0 0 6px rgba(189,35,32,0.95)) drop-shadow(0 0 18px rgba(189,35,32,0.55))", position: "relative", zIndex: 1 }}
      >
        <path
          d="M18 2C10.27 2 4 8.27 4 16c0 9.75 14 26 14 26S32 25.75 32 16C32 8.27 25.73 2 18 2z"
          fill="#BD2320"
          stroke="#ff6b6b"
          strokeWidth="1"
        />
        <circle cx="18" cy="16" r="5" fill="white" />
        <circle cx="18" cy="16" r="3" fill="#BD2320" />
      </svg>
      {/* Drop shadow */}
      <motion.div
        animate={{ scaleX: [1, 1.3, 1], opacity: [0.4, 0.15, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 16, height: 4, borderRadius: 8,
          background: "rgba(0,0,0,0.7)",
          filter: "blur(3px)", marginTop: -4,
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
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(189,35,32,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(189,35,32,0.06) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <path d="M0 300 Q100 280 200 300 T400 290" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <path d="M0 450 Q150 430 400 460" stroke="rgba(255,255,255,0.04)" strokeWidth="12" fill="none" />
        <path d="M180 0 Q190 200 185 400 T175 800" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <path d="M280 0 Q290 150 285 300 T275 800" stroke="rgba(255,255,255,0.04)" strokeWidth="5" fill="none" />
        <path d="M0 200 Q200 180 400 210" stroke="rgba(189,35,32,0.12)" strokeWidth="6" fill="none" />
        <path d="M0 550 Q180 530 400 560" stroke="rgba(189,35,32,0.08)" strokeWidth="4" fill="none" />
      </svg>
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
    pitch: 58,
    bearing: -18,
  });
  const [pinCoords, setPinCoords] = useState(SIVAKASI_CENTER);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<GeoFeature[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(DEFAULT_PLACES);
  const [selectedSaved, setSelectedSaved] = useState<string | null>(null);
  const [addingPlace, setAddingPlace] = useState<SavedPlace | null>(null);
  const [floatingTip, setFloatingTip] = useState<{ text: string; tone: TipTone; id: number } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(320);
  const sheetHeightRef = useRef(320); // always up-to-date inside async callbacks
  const mapRef = useRef<{ getMap: () => mapboxgl.Map } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved places from localStorage on mount
  useEffect(() => {
    setSavedPlaces(loadSavedPlaces());
  }, []);

  // Keep recenter button and padding ref synced with actual drawer height.
  useEffect(() => {
    const measure = () => {
      if (sheetRef.current) {
        const h = sheetRef.current.offsetHeight;
        setSheetHeight(h);
        sheetHeightRef.current = h;
        // Tell Mapbox about the UI overlay so all flyTo/easeTo
        // automatically centers within the visible area above the drawer.
        const map = mapRef.current?.getMap();
        if (map) {
          map.setPadding({ top: 80, bottom: h + 20, left: 0, right: 0 });
        }
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (sheetRef.current) observer.observe(sheetRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const showTip = useCallback((text: string, tone: TipTone = "info") => {
    const id = Date.now();
    setFloatingTip({ text, tone, id });
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setFloatingTip(null), 2200);
  }, []);

  // Geocoding search with debounce
  const handleSearchChange = useCallback((val: string) => {
    setSearchText(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (val.length < 3) { setSuggestions([]); return; }
    searchDebounce.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${MAPBOX_TOKEN}&country=IN&limit=5&proximity=${SIVAKASI_CENTER.lng},${SIVAKASI_CENTER.lat}`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch {}
    }, 350);
  }, []);

  const resolveAddress = useCallback(async (lat: number, lng: number) => {
    if (!MAPBOX_TOKEN) return "Pinned location";
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,place,neighborhood&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      const feature = data?.features?.[0];
      return feature?.place_name?.trim() || "Pinned location";
    } catch {
      return "Pinned location";
    }
  }, []);

  const handleSuggestionSelect = (feature: GeoFeature) => {
    const [lng, lat] = feature.center;
    setSearchText(feature.place_name);
    setSuggestions([]);
    setPinCoords({ lat, lng });
    setSelectedSaved(null);

    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [lng, lat],
        zoom: TARGET_ZOOM,
        speed: 1.2,
        curve: 1,
        essential: true,
      });
    } else {
      setViewState((v) => ({ ...v, longitude: lng, latitude: lat, zoom: TARGET_ZOOM }));
    }
  };

  const TARGET_ZOOM = 18;

  const handleGPS = useCallback(async () => {
    setIsDetecting(true);
    if (!navigator.geolocation) { setIsDetecting(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPinCoords({ lat: latitude, lng: longitude });
        setSelectedSaved(null);
        setSearchText("Locating address...");
        const map = mapRef.current?.getMap();
        if (map) {
          // map.setPadding() already tells Mapbox to center within visible area
          map.flyTo({
            center: [longitude, latitude],
            zoom: TARGET_ZOOM,
            curve: 1.42,  // bird's-eye: zooms out, shows journey, lands
            speed: 0.8,   // slightly slower for more "butter"
            essential: true,
          });
          // REMOVED immediate setViewState here — it was causing the abrupt jump.
          // Mapbox will emit 'move' events during flyTo which onMove will catch.
        } else {
          setViewState((v) => ({ ...v, longitude, latitude, zoom: TARGET_ZOOM }));
        }
        const addr = await resolveAddress(latitude, longitude);
        setSearchText(addr);
        setIsDetecting(false);
      },
      () => setIsDetecting(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [resolveAddress]);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [pinCoords.lng, pinCoords.lat],
        zoom: TARGET_ZOOM,
        speed: 1.2,
        curve: 1,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    } else {
      setViewState((v) => ({
        ...v,
        longitude: pinCoords.lng,
        latitude: pinCoords.lat,
        zoom: TARGET_ZOOM,
      }));
    }
  }, [pinCoords]);

  const handleMapPinSet = useCallback(async (lat: number, lng: number) => {
    setPinCoords({ lat, lng });
    setSelectedSaved(null);
    // Keep addingPlace — user is moving the pin to set their saved location
    setSuggestions([]);
    setSearchText("Locating address...");
    const addr = await resolveAddress(lat, lng);
    setSearchText(addr);
  }, [resolveAddress]);

  const handleSavedSelect = (place: SavedPlace) => {
    // Tapping same card while in adding mode → cancel
    if (addingPlace?.id === place.id) {
      setAddingPlace(null);
      return;
    }

    if (place.lat === 0) {
      // Enter "add address" mode — just activate it, CTA makes it obvious
      setSelectedSaved(null);
      setAddingPlace(place);
      setSuggestions([]);
      // If there's already a resolved address on the pin, hint the user
      const hasResolved =
        searchText.length > 0 &&
        searchText !== "Locating address..." &&
        searchText !== "Set your location" &&
        searchText !== "Pinned location";
      if (hasResolved) {
        showTip(`Tap "Save as ${place.label}" to use current pin`, "info");
      }
      return;
    }

    // Place already has an address
    if (selectedSaved === place.id) {
      // Tapping again deselects silently
      setSelectedSaved(null);
      setAddingPlace(null);
      return;
    }

    // Select and navigate to saved place
    setSelectedSaved(place.id);
    setAddingPlace(null);
    setPinCoords({ lat: place.lat, lng: place.lng });
    setSearchText(place.address);
    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: TARGET_ZOOM,
        speed: 1.2,
        curve: 1,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    } else {
      setViewState((v) => ({ ...v, longitude: place.lng, latitude: place.lat, zoom: TARGET_ZOOM }));
    }
  };

  const handleSavePlace = () => {
    if (!addingPlace) return;
    if (
      !searchText.trim() ||
      searchText === "Locating address..." ||
      searchText === "Pinned location"
    ) {
      showTip("Move the pin to a named location first", "warn");
      return;
    }
    const label = searchText.trim();
    const duplicate = savedPlaces.find((p) => {
      if (p.id === addingPlace.id || p.lat === 0) return false;
      const sameAddress = p.address.trim().toLowerCase() === label.toLowerCase();
      const nearSamePoint = getDistanceKm(p.lat, p.lng, pinCoords.lat, pinCoords.lng) < 0.05;
      return sameAddress || nearSamePoint;
    });
    if (duplicate) {
      showTip(`Already saved as ${duplicate.label}. Choose another address`, "warn");
      return;
    }
    const updated = savedPlaces.map((p) =>
      p.id === addingPlace.id
        ? { ...p, address: label, lat: pinCoords.lat, lng: pinCoords.lng }
        : p
    );
    setSavedPlaces(updated);
    savePlaces(updated);
    setSelectedSaved(addingPlace.id);
    showTip(`${addingPlace.label} saved!`, "success");
    setAddingPlace(null);
  };

  const handleDeletePlace = (place: SavedPlace) => {
    const resetAddress =
      place.id === "home"
        ? "Add home address"
        : place.id === "work"
        ? "Add work address"
        : "Add other address";
    const updated = savedPlaces.map((p) =>
      p.id === place.id ? { ...p, address: resetAddress, lat: 0, lng: 0 } : p
    );
    setSavedPlaces(updated);
    savePlaces(updated);
    if (selectedSaved === place.id) setSelectedSaved(null);
    if (addingPlace?.id === place.id) setAddingPlace(null);
    if (searchText === place.address) setSearchText("");
    showTip(`${place.label} cleared`, "info");
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
      inRange: dist <= MAX_DISTANCE_KM,
    });
  };

  const handleSkip = () => {
    onLocationSet({ label: "Sivakasi", lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true });
  };

  const hasToken = MAPBOX_TOKEN.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", overflow: "hidden" }}>
      {/* Floating status tooltip (small, cute, bottom-centered) */}
      <AnimatePresence>
        {floatingTip && (
          <motion.div
            key={floatingTip.id}
            initial={{ opacity: 0, y: 20, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{
              position: "fixed",
              bottom: 100,
              left: 0,
              right: 0,
              margin: "0 auto",
              width: "fit-content",
              maxWidth: "80vw",
              zIndex: 9999,
              padding: "10px 20px",
              borderRadius: 24,
              background: "rgba(18,18,18,0.96)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${
                floatingTip.tone === "warn"
                  ? "rgba(189,35,32,0.6)"
                  : floatingTip.tone === "success"
                  ? "rgba(34,197,94,0.5)"
                  : "rgba(255,255,255,0.15)"
              }`,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.01em",
              textAlign: "center",
              boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              whiteSpace: "nowrap",
              overflow: "visible",
            }}
          >
            {floatingTip.tone === "warn" && <span style={{ color: "#BD2320" }}>!</span>}
            {floatingTip.text}

            {/* Burst particles — invisible until they exit the pill, then pop and fly */}
            {[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => {
              const angle = (i / 12) * 2 * Math.PI;
              const near = 18;  // start just outside pill edge
              const far  = 44 + (i % 4) * 12;
              const color =
                floatingTip.tone === "warn"
                  ? "rgba(189,35,32,0.95)"
                  : floatingTip.tone === "success"
                  ? "rgba(34,197,94,0.95)"
                  : "rgba(255,255,255,0.9)";
              return (
                <motion.span
                  key={`dot-${floatingTip.id}-${i}`}
                  initial={{ opacity: 0, x: Math.cos(angle) * near, y: Math.sin(angle) * near, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    scale:   [0, 1.1, 0.9, 0.1],
                    x: [Math.cos(angle) * near, Math.cos(angle) * far],
                    y: [Math.sin(angle) * near, Math.sin(angle) * far],
                  }}
                  transition={{
                    duration: 0.55,
                    times: [0, 0.15, 0.65, 1],
                    ease: "easeOut",
                    delay: (i % 4) * 0.03,
                  }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3,
                    height: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3,
                    borderRadius: "50%",
                    background: color,
                    pointerEvents: "none",
                    marginLeft: "-2px",
                    marginTop: "-2px",
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FULL SCREEN MAP ── */}
      {hasToken ? (
        <Map
          ref={mapRef as React.Ref<unknown> & React.RefObject<{ getMap: () => mapboxgl.Map }>}
          {...viewState}
          onMove={(e) => setViewState(e.viewState)}
          mapStyle={MAP_STYLE}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          maxPitch={75}
          minPitch={20}
          onClick={(e) => handleMapPinSet(e.lngLat.lat, e.lngLat.lng)}
          onLoad={(e) => {
            try {
              const map = e.target;
              // Set padding so all camera ops respect the drawer overlay
              map.setPadding({ top: 80, bottom: sheetHeightRef.current + 20, left: 0, right: 0 });
              const style = map.getStyle();
              const layers = style.layers || [];
              const labelLayer = layers.find(
                (layer) =>
                  layer.type === "symbol" &&
                  typeof (layer as { layout?: { "text-field"?: unknown } }).layout?.["text-field"] !== "undefined"
              );

              if (!map.getLayer("vk-3d-buildings")) {
                map.addLayer(
                  {
                    id: "vk-3d-buildings",
                    source: "composite",
                    "source-layer": "building",
                    filter: ["==", "extrude", "true"],
                    type: "fill-extrusion",
                    minzoom: 14,
                    paint: {
                      "fill-extrusion-color": [
                        "interpolate",
                        ["linear"],
                        ["get", "height"],
                        0,
                        "#121212",
                        60,
                        "#1a1214",
                        140,
                        "#231416",
                        280,
                        "#2e1719",
                      ],
                      "fill-extrusion-height": ["get", "height"],
                      "fill-extrusion-base": ["get", "min_height"],
                      "fill-extrusion-opacity": 0.95,
                    },
                  },
                  labelLayer?.id
                );
              }
            } catch {}
          }}
          attributionControl={false}
        >
          <Marker
            longitude={pinCoords.lng}
            latitude={pinCoords.lat}
            anchor="bottom"
            draggable
            onDragEnd={(e) => handleMapPinSet(e.lngLat.lat, e.lngLat.lng)}
          >
            <MapPin />
          </Marker>
        </Map>
      ) : (
        <FallbackMap>
          <div style={{
            position: "absolute", top: "38%", left: "50%",
            transform: "translate(-50%, -100%)",
          }}>
            <MapPin />
          </div>
        </FallbackMap>
      )}

      {/* Red-black tint over map for brand tone */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 42%, rgba(189,35,32,0.08) 0%, rgba(0,0,0,0) 48%), linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.2) 35%, rgba(0,0,0,0.48) 100%)",
        }}
      />

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
      </motion.div>

      {/* ── FLOATING RECENTER BUTTON ── sits above bottom sheet */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 28, delay: 0.45 }}
        whileTap={{ scale: 0.88 }}
        onClick={handleRecenter}
        style={{
          position: "absolute",
          right: 18,
          bottom: sheetHeight + 14,
          zIndex: 25,
          background: "rgba(14,14,14,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          width: 44, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          color: "rgba(255,255,255,0.7)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}
      >
        <RecenterIcon />
      </motion.button>

      {/* ── BOTTOM GLASS SHEET ── */}
      <motion.div
        ref={sheetRef}
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
          padding: "20px 0 36px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.12)",
          margin: "0 auto 20px",
          flexShrink: 0,
        }} />

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", scrollbarWidth: "none" }}>
          {/* Search bar + suggestions */}
          <motion.div
            custom={0}
            variants={springReveal}
            initial="hidden"
            animate="show"
            style={{ marginBottom: 16, position: "relative" }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.05)",
                border: `1.5px solid ${searchFocused ? "rgba(189,35,32,0.5)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: suggestions.length > 0 ? "16px 16px 0 0" : 16,
                padding: "12px 14px",
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
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
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
                    onClick={() => { setSearchText(""); setSuggestions([]); }}
                    style={{
                      background: "rgba(255,255,255,0.08)", border: "none",
                      borderRadius: 10, width: 26, height: 26,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Geocoding suggestions dropdown */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{
                    background: "rgba(18,18,18,0.98)",
                    border: "1.5px solid rgba(189,35,32,0.25)",
                    borderTop: "none",
                    borderRadius: "0 0 16px 16px",
                    overflow: "hidden",
                  }}
                >
                  {suggestions.map((f, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSuggestionSelect(f)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", background: "none", border: "none",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        padding: "11px 14px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "rgba(189,35,32,0.6)", flexShrink: 0, display: "flex" }}>
                        <PinIcon color="#BD2320" />
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 600 }}>
                          {f.place_name.split(",")[0]}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.place_name.split(",").slice(1).join(",").trim()}
                        </p>
                      </div>
                    </button>
                  ))}
                </motion.div>
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
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {savedPlaces.map((place, i) => {
                const isSelected = selectedSaved === place.id;
                const isAdding = addingPlace?.id === place.id;
                const isUnset = place.lat === 0;
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
                      flex: "0 0 160px",
                      background: isAdding
                        ? "rgba(189,35,32,0.1)"
                        : isSelected
                        ? "rgba(189,35,32,0.12)"
                        : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${isAdding ? "rgba(189,35,32,0.5)" : isSelected ? "rgba(189,35,32,0.4)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 14,
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                      textAlign: "left",
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    <span style={{ color: isAdding || isSelected ? "#BD2320" : "rgba(255,255,255,0.4)", display: "flex" }}>
                      {place.label === "Home" ? <House size={18} weight="duotone" /> : place.label === "Work" ? <Briefcase size={18} weight="duotone" /> : <MapPinIcon size={18} weight="duotone" />}
                    </span>
                    <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                      <p style={{ margin: 0, fontSize: 12, color: isAdding || isSelected ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                        {place.label}
                      </p>
                      <p style={{ 
                        margin: 0, 
                        fontSize: 10, 
                        color: isAdding ? "rgba(189,35,32,0.8)" : isUnset ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.3)", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap",
                        maxWidth: "100px"
                      }}>
                        {isAdding ? "Setting location…" : isUnset ? "Tap to add" : place.address}
                      </p>
                    </div>
                    {!isUnset && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlace(place);
                        }}
                        style={{
                          marginLeft: 4,
                          width: 28,
                          height: 28,
                          borderRadius: 9,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.06)",
                          color: "rgba(255,255,255,0.5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                        aria-label={`Delete ${place.label} address`}
                      >
                        <DeleteIcon />
                      </button>
                    )}
                  </motion.button>
                );
              })}
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
              <motion.span
                animate={isDetecting ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 1, repeat: isDetecting ? Infinity : 0, ease: "linear" }}
                style={{ color: "#BD2320", display: "flex" }}
              >
                <GPSIcon />
              </motion.span>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 700 }}>
                {isDetecting ? "Detecting location…" : "Use current location"}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Detect via GPS</p>
            </div>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>›</span>
          </motion.button>
        </div>

        {/* Confirm / Save CTA (Fixed at bottom) */}
        <motion.div
          custom={4}
          variants={springReveal}
          initial="hidden"
          animate="show"
          style={{ padding: "12px 20px 0", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          {addingPlace ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSavePlace}
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
                position: "relative",
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear", repeatDelay: 2 }}
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                  skewX: -20,
                }}
              />
              Save as {addingPlace.label}
            </motion.button>
          ) : (
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
                marginBottom: 24,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear", repeatDelay: 2 }}
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                  skewX: -20,
                }}
              />
              <span style={{ display: "flex" }}><PinIcon color="#fff" /></span>
              Confirm Location
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
