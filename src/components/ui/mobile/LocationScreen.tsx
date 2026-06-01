"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Map, { Marker } from "react-map-gl/mapbox";
import { House, Briefcase, MapPin as PhMapPin, Trash, MagnifyingGlass, Crosshair, NavigationArrow, WarningCircle } from "@phosphor-icons/react";

import "mapbox-gl/dist/mapbox-gl.css";
import { type SavedPlace, loadSavedPlaces, savePlaces, DEFAULT_SAVED_PLACES } from "@/lib/vk-saved-places";
import { TYPO } from "@/components/ui/mobile/mobile-typography";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LocationData {
  label: string;
  lat: number;
  lng: number;
  inRange: boolean;
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
const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

/** Location screen typography — shared scale */
const LOC = {
  tip: { ...TYPO.caption, color: "#1A1A1A", letterSpacing: "0.01em", textAlign: "center" as const },
  eyebrow: { ...TYPO.caption, margin: 0, fontSize: 11, color: "rgba(0,0,0,0.45)", letterSpacing: "0.02em", lineHeight: 1.25 },
  placeName: {
    ...TYPO.bodyMedium,
    margin: 0,
    color: "#1A1A1A",
    letterSpacing: "0.02em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  searchInput: { ...TYPO.input, flex: 1, background: "transparent", border: "none", outline: "none" },
  suggestTitle: { ...TYPO.caption, margin: 0, color: "#1A1A1A" },
  suggestSub: {
    ...TYPO.eyebrow,
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.02em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  sectionEyebrow: {
    ...TYPO.micro,
    margin: "0 0 10px",
    color: "rgba(0,0,0,0.4)",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  savedLabel: { ...TYPO.chip, margin: 0 },
  savedSub: {
    ...TYPO.micro,
    margin: 0,
    fontWeight: 600,
    letterSpacing: "0.02em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: "100px",
  },
  gpsTitle: { ...TYPO.caption, margin: 0, color: "#1A1A1A", fontWeight: 700 },
  gpsSub: { ...TYPO.eyebrow, margin: 0, fontSize: 11, color: "rgba(0,0,0,0.4)" },
  error: { ...TYPO.eyebrow, margin: 0, fontSize: 11, color: "rgba(0,0,0,0.65)", lineHeight: 1.4 },
  cta: { ...TYPO.bodySm, color: "#fff", fontWeight: 800, letterSpacing: "0.02em" },
  modalTitle: { ...TYPO.cardTitle, margin: "0 0 8px", fontWeight: 900 },
  modalBody: { ...TYPO.caption, margin: "0 0 6px", color: "rgba(0,0,0,0.55)", lineHeight: 1.55 },
  modalSub: { ...TYPO.chip, margin: "0 0 24px", color: "rgba(0,0,0,0.4)", fontWeight: 600 },
  modalBtnPrimary: { ...TYPO.caption, color: "#fff", fontWeight: 800 },
  modalBtnSecondary: { ...TYPO.caption, color: "rgba(0,0,0,0.6)", fontWeight: 700 },
} as const;

/** Insets passed with the camera so the map never paints “unpadded” then snaps when overlays mount. */
const MAP_PAD_TOP = 80;
const MAP_PAD_BOTTOM_EXTRA = 20;
/** Must match initial `sheetHeight` so padding matches before the first layout measure. */
const INITIAL_SHEET_FALLBACK_H = 320;

/** Camera easings — GPS route uses slower / “heavier” curves than normal taps. */
function easeSmootherstep(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
/** Double smoothstep — very soft accel/decel (“laggy” smooth). */
function easeLaggySmooth(t: number) {
  const s = t * t * (3 - 2 * t);
  return s * s * (3 - 2 * s);
}
function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

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
  return <House size={16} weight="regular" color="currentColor" />;
}

function WorkIcon() {
  return <Briefcase size={16} weight="regular" color="currentColor" />;
}

function OtherIcon() {
  return <PhMapPin size={16} weight="regular" color="currentColor" />;
}

function DeleteIcon() {
  return <Trash size={14} weight="regular" color="currentColor" />;
}

function GPSIcon() {
  return <NavigationArrow size={18} weight="fill" color="currentColor" />;
}

function SearchIcon() {
  return <MagnifyingGlass size={16} weight="regular" color="currentColor" />;
}

function RecenterIcon() {
  return <Crosshair size={18} weight="regular" color="currentColor" />;
}

function PinIcon({ color = "#BD2320" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 9.923c0 4.852 4.244 8.864 6.123 10.402c.27.22.405.332.606.388c.156.044.386.044.542 0c.201-.056.336-.167.606-.388C14.756 18.787 19 14.775 19 9.923a6.9 6.9 0 0 0-2.05-4.895A7.04 7.04 0 0 0 12 3a7.04 7.04 0 0 0-4.95 2.028A6.88 6.88 0 0 0 5 9.923" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="9.9" r="2.5" fill={color} />
    </svg>
  );
}


// ─── Map Pin Marker — neon glow ───────────────────────────────────────────────
function MapPin() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26, delay: 0.12 }}
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
      background: "linear-gradient(160deg, #F5F5F7 0%, #EEEEF0 40%, #F5F5F7 100%)",
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
        <path d="M0 300 Q100 280 200 300 T400 290" stroke="rgba(0,0,0,0.06)" strokeWidth="8" fill="none" />
        <path d="M0 450 Q150 430 400 460" stroke="rgba(0,0,0,0.04)" strokeWidth="12" fill="none" />
        <path d="M180 0 Q190 200 185 400 T175 800" stroke="rgba(0,0,0,0.06)" strokeWidth="8" fill="none" />
        <path d="M280 0 Q290 150 285 300 T275 800" stroke="rgba(0,0,0,0.04)" strokeWidth="5" fill="none" />
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
    padding: {
      top: MAP_PAD_TOP,
      bottom: INITIAL_SHEET_FALLBACK_H + MAP_PAD_BOTTOM_EXTRA,
      left: 0,
      right: 0,
    },
  });
  const [pinCoords, setPinCoords] = useState(SIVAKASI_CENTER);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<GeoFeature[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(DEFAULT_SAVED_PLACES);
  const [selectedSaved, setSelectedSaved] = useState<string | null>(null);
  const [addingPlace, setAddingPlace] = useState<SavedPlace | null>(null);
  const [floatingTip, setFloatingTip] = useState<{ text: string; tone: TipTone; id: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [outOfRangeModal, setOutOfRangeModal] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(INITIAL_SHEET_FALLBACK_H);
  const sheetHeightRef = useRef(INITIAL_SHEET_FALLBACK_H); // always up-to-date inside async callbacks
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraAnimRef = useRef<number | null>(null);
  /** Bumped when cancelling camera work so in-flight RAF does not fire `onComplete`. */
  const cameraGenRef = useRef(0);
  const viewStateRef = useRef(viewState);
  const TARGET_ZOOM = 18;

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  const stopCameraAnimation = useCallback(() => {
    cameraGenRef.current += 1;
    if (cameraAnimRef.current !== null) {
      cancelAnimationFrame(cameraAnimRef.current);
      cameraAnimRef.current = null;
    }
  }, []);

  type AnimateCameraOptions = {
    easing?: (t: number) => number;
    /** Fires only if this segment was not cancelled by `stopCameraAnimation`. */
    onComplete?: () => void;
  };

  const animateCameraTo = useCallback(
    (
      lng: number,
      lat: number,
      duration = 1400,
      targetZoom = TARGET_ZOOM,
      options?: AnimateCameraOptions
    ) => {
      stopCameraAnimation();
      const gen = cameraGenRef.current;
      const from = viewStateRef.current;
      const start = performance.now();
      const ease = options?.easing ?? easeSmootherstep;
      const step = (now: number) => {
        if (gen !== cameraGenRef.current) {
          cameraAnimRef.current = null;
          return;
        }
        const t = Math.min(1, (now - start) / duration);
        const eased = ease(t);
        setViewState((v) => ({
          ...v,
          longitude: from.longitude + (lng - from.longitude) * eased,
          latitude: from.latitude + (lat - from.latitude) * eased,
          zoom: from.zoom + (targetZoom - from.zoom) * eased,
        }));
        if (t < 1) {
          cameraAnimRef.current = requestAnimationFrame(step);
        } else {
          cameraAnimRef.current = null;
          if (gen === cameraGenRef.current) options?.onComplete?.();
        }
      };
      cameraAnimRef.current = requestAnimationFrame(step);
    },
    [stopCameraAnimation]
  );

  /**
   * “Detect location” — one uninterrupted glide to the pin (no midpoint stop),
   * then slow zoom-in. Glide length scales slightly with distance so long hops stay fluid.
   */
  const animateCameraRoute = useCallback(
    (lng: number, lat: number) => {
      const from = viewStateRef.current;
      const travelZoom = Math.max(13.2, TARGET_ZOOM - 3.05);
      const distKm = getDistanceKm(from.latitude, from.longitude, lat, lng);
      const glideMs = Math.min(20000, Math.max(8200, 7600 + distKm * 130));

      animateCameraTo(lng, lat, glideMs, travelZoom, {
        easing: easeLaggySmooth,
        onComplete: () => {
          animateCameraTo(lng, lat, 7200, TARGET_ZOOM, { easing: easeOutCubic });
        },
      });
    },
    [animateCameraTo]
  );

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
        // Keep padding in React viewState (same source as Map props) so the camera
        // never renders one frame without insets then jumps when setPadding runs.
        setViewState((v) => ({
          ...v,
          padding: {
            top: MAP_PAD_TOP,
            bottom: h + MAP_PAD_BOTTOM_EXTRA,
            left: 0,
            right: 0,
          },
        }));
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

  useEffect(() => {
    return () => stopCameraAnimation();
  }, [stopCameraAnimation]);

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
      if (!MAPBOX_TOKEN) {
        setSuggestions([]);
        return;
      }
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${MAPBOX_TOKEN}&country=IN&limit=5&proximity=${SIVAKASI_CENTER.lng},${SIVAKASI_CENTER.lat}`;
        const res = await fetch(url);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch {
        setSuggestions([]);
      }
    }, 350);
  }, []);

  const resolveAddress = useCallback(async (lat: number, lng: number) => {
    if (!MAPBOX_TOKEN) return "Pinned location";
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,place,neighborhood&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return "Pinned location";
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
    animateCameraTo(lng, lat, 1600);
  };

  const handleGPS = useCallback(async () => {
    setIsDetecting(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("GPS not supported on this browser.");
      setIsDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPinCoords({ lat: latitude, lng: longitude });
        setSelectedSaved(null);
        setSearchText("Locating address...");
        animateCameraRoute(longitude, latitude);
        const addr = await resolveAddress(latitude, longitude);
        setSearchText(addr);
        setIsDetecting(false);
      },
      (err) => {
        setIsDetecting(false);
        if (err.code === 1) {
          setGpsError("Location access denied. Please allow it in your browser settings.");
        } else if (err.code === 2) {
          setGpsError("Unable to detect location. Try searching your area instead.");
        } else if (err.code === 3) {
          setGpsError("Location timed out. Please try again or search manually.");
        } else {
          setGpsError("Could not get your location. Try searching manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [animateCameraRoute, resolveAddress]);

  const handleRecenter = useCallback(() => {
    animateCameraTo(pinCoords.lng, pinCoords.lat, 1500);
  }, [animateCameraTo, pinCoords]);

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
    animateCameraTo(place.lng, place.lat, 1700);
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
    const dist = getDistanceKm(pinCoords.lat, pinCoords.lng, SIVAKASI_CENTER.lat, SIVAKASI_CENTER.lng);
    if (dist > MAX_DISTANCE_KM) {
      setOutOfRangeModal(true);
      return;
    }
    const label = selectedSaved
      ? savedPlaces.find((p) => p.id === selectedSaved)?.label || "Saved Location"
      : searchText.trim() || "Current Location";
    onLocationSet({ label, lat: pinCoords.lat, lng: pinCoords.lng, inRange: true });
  };

  const handleSkip = () => {
    onLocationSet({ label: "Sivakasi", lat: SIVAKASI_CENTER.lat, lng: SIVAKASI_CENTER.lng, inRange: true });
  };

  const hasToken = MAPBOX_TOKEN.length > 0;

  return (
    <>
    <div style={{ position: "fixed", inset: 0, background: "#F5F5F7", overflow: "hidden" }}>
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
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${
                floatingTip.tone === "warn"
                  ? "rgba(189,35,32,0.6)"
                  : floatingTip.tone === "success"
                  ? "rgba(34,197,94,0.5)"
                  : "rgba(0,0,0,0.1)"
              }`,
              color: "#1A1A1A",
              ...LOC.tip,
              boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
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
                  : "rgba(0,0,0,0.5)";
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
          {...viewState}
          onMove={(e) =>
            setViewState((prev) => {
              const p = e.viewState.padding;
              return {
                ...e.viewState,
                padding: {
                  top: p?.top ?? prev.padding.top,
                  bottom: p?.bottom ?? prev.padding.bottom,
                  left: p?.left ?? prev.padding.left,
                  right: p?.right ?? prev.padding.right,
                },
              };
            })
          }
          mapStyle={MAP_STYLE}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          maxPitch={75}
          minPitch={20}
          onClick={(e) => handleMapPinSet(e.lngLat.lat, e.lngLat.lng)}
          onLoad={(e) => {
            try {
              const map = e.target;
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
                        "#E8E8EA",
                        60,
                        "#E0DDE0",
                        140,
                        "#D8D4D6",
                        280,
                        "#D0CACC",
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
            "radial-gradient(circle at 50% 42%, rgba(189,35,32,0.05) 0%, rgba(255,255,255,0) 48%), linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 35%, rgba(255,255,255,0.35) 100%)",
        }}
      />

      {/* Map bottom fade — blends map into sheet */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "45%",
        background: "linear-gradient(to top, #F5F5F7 20%, transparent 100%)",
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
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: 22,
          border: "1px solid rgba(0,0,0,0.06)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(255,255,255,0.5) inset",
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: "rgba(189,35,32,0.15)",
          border: "1px solid rgba(189,35,32,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <PhMapPin size={16} weight="fill" color="#BD2320" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={LOC.eyebrow}>
            Delivering to
          </p>
          <p style={LOC.placeName}>
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
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 14,
          width: 44, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          color: "rgba(0,0,0,0.6)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
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
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRadius: "28px 28px 0 0",
          border: "1px solid rgba(0,0,0,0.06)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.5) inset",
          padding: "20px 0 36px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(0,0,0,0.12)",
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
                background: "rgba(0,0,0,0.03)",
                border: `1.5px solid ${searchFocused ? "rgba(189,35,32,0.5)" : "rgba(0,0,0,0.08)"}`,
                borderRadius: suggestions.length > 0 ? "16px 16px 0 0" : 16,
                padding: "12px 14px",
                transition: "border-color 0.2s",
                boxShadow: searchFocused ? "0 0 0 3px rgba(189,35,32,0.08)" : "none",
              }}
            >
              <span style={{ color: "rgba(0,0,0,0.35)", display: "flex", flexShrink: 0 }}>
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
                  ...LOC.searchInput,
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
                      background: "rgba(0,0,0,0.06)", border: "none",
                      borderRadius: 10, width: 26, height: 26,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "rgba(0,0,0,0.4)", fontSize: 18,
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
                    background: "rgba(255,255,255,0.98)",
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
                        borderTop: i > 0 ? "1px solid rgba(0,0,0,0.05)" : "none",
                        padding: "11px 14px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "rgba(189,35,32,0.6)", flexShrink: 0, display: "flex" }}>
                        <PinIcon color="#BD2320" />
                      </span>
                      <div>
                        <p style={LOC.suggestTitle}>
                          {f.place_name.split(",")[0]}
                        </p>
                        <p style={LOC.suggestSub}>
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
            <p style={LOC.sectionEyebrow}>
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
                        ? "rgba(189,35,32,0.08)"
                        : isSelected
                        ? "rgba(189,35,32,0.08)"
                        : "rgba(0,0,0,0.03)",
                      border: `1.5px solid ${isAdding ? "rgba(189,35,32,0.5)" : isSelected ? "rgba(189,35,32,0.4)" : "rgba(0,0,0,0.07)"}`,
                      borderRadius: 14,
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                      textAlign: "left",
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    <span style={{ color: isAdding || isSelected ? "#BD2320" : "rgba(0,0,0,0.4)", display: "flex" }}>
                      {place.label === "Home" ? (
                        <HomeIcon />
                      ) : place.label === "Work" ? (
                        <WorkIcon />
                      ) : (
                        <OtherIcon />
                      )}
                    </span>
                    <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                      <p style={{ ...LOC.savedLabel, color: isAdding || isSelected ? "#1A1A1A" : "rgba(0,0,0,0.7)" }}>
                        {place.label}
                      </p>
                      <p style={{ 
                        ...LOC.savedSub,
                        color: isAdding ? "rgba(189,35,32,0.8)" : isUnset ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.4)", 
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
                          border: "1px solid rgba(0,0,0,0.08)",
                          background: "rgba(0,0,0,0.04)",
                          color: "rgba(0,0,0,0.4)",
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
              background: "rgba(0,0,0,0.03)",
              border: "1.5px solid rgba(0,0,0,0.07)",
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
              <p style={LOC.gpsTitle}>
                {isDetecting ? "Detecting location…" : "Use current location"}
              </p>
              <p style={LOC.gpsSub}>Detect via GPS</p>
            </div>
            <span style={{ color: "rgba(0,0,0,0.25)", fontSize: 18 }}>›</span>
          </motion.button>
        </div>

        {/* GPS Error Banner */}
        <AnimatePresence>
          {gpsError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{
                margin: "0 20px 12px",
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(189,35,32,0.1)",
                border: "1px solid rgba(189,35,32,0.3)",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <WarningCircle size={14} weight="bold" color="#BD2320" style={{ flexShrink: 0 }} />
              <p style={LOC.error}>{gpsError}</p>
              <button onClick={() => setGpsError(null)} style={{ background: "none", border: "none", color: "rgba(0,0,0,0.35)", cursor: "pointer", padding: 0, marginLeft: "auto", fontSize: 16, flexShrink: 0 }}>×</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm / Save CTA (Fixed at bottom) */}
        <motion.div
          custom={4}
          variants={springReveal}
          initial="hidden"
          animate="show"
          style={{ padding: "12px 20px 0", flexShrink: 0 }}
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
                color: "#fff", ...LOC.cta,
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
                color: "#fff", ...LOC.cta,
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
              Confirm Location
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </div>

      {/* ── Out-of-range delivery modal ──────────────────── */}
      <AnimatePresence>
        {outOfRangeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              padding: "0 16px 32px",
            }}
            onClick={() => setOutOfRangeModal(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 400,
                background: "rgba(255,255,255,0.98)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                borderRadius: 28,
                border: "1px solid rgba(189,35,32,0.2)",
                padding: "28px 24px 24px",
                boxShadow: "0 24px 60px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(255,255,255,0.5) inset",
                fontFamily: "var(--font-jetbrains-mono), monospace",
              }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(189,35,32,0.12)", border: "1px solid rgba(189,35,32,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <PhMapPin size={24} weight="fill" color="#BD2320" />
              </div>
              <h2 style={LOC.modalTitle}>Outside delivery area</h2>
              <p style={LOC.modalBody}>
                We currently only deliver within <span style={{ color: "#1A1A1A", fontWeight: 700 }}>Sivakasi, Tamil Nadu</span> — within 15 km of our kitchen.
              </p>
              <p style={LOC.modalSub}>The location you picked is outside our delivery zone.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setOutOfRangeModal(false);
                    setSearchText("");
                    setSuggestions([]);
                    setPinCoords(SIVAKASI_CENTER);
                    animateCameraTo(SIVAKASI_CENTER.lng, SIVAKASI_CENTER.lat, 1400);
                  }}
                  style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #BD2320 0%, #8B1A18 100%)", border: "none", borderRadius: 14, ...LOC.modalBtnPrimary, cursor: "pointer", boxShadow: "0 4px 16px rgba(189,35,32,0.4)" }}
                >
                  Search in Sivakasi
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setOutOfRangeModal(false)}
                  style={{ width: "100%", padding: "13px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, ...LOC.modalBtnSecondary, cursor: "pointer" }}
                >
                  Change location
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
