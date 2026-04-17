import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, CaretDown, WarningCircle, X, MapPinArea } from "@phosphor-icons/react";

interface LocationLite {
  label: string;
  inRange: boolean;
}

interface MobileHomeScreenProps {
  displayName: string;
  location: LocationLite | null;
  onChangeLocation?: () => void;
}

/** Obsidian Glass Effect — matches the "Liquid Glass" theme */
const GLASS_PILL =
  "bg-neutral-900/80 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]";

const LABEL_HEADER = "text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400";

export function MobileHomeScreen({ displayName, location, onChangeLocation }: MobileHomeScreenProps) {
  void displayName;

  const [open, setOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [open, close]);

  const label = location?.label?.trim() || "Set delivery location";
  const inRange = location?.inRange ?? true;

  // Auto-show warning if out of range, but allow dismissal
  useEffect(() => {
    if (!inRange) setShowWarning(true);
  }, [inRange]);

  return (
    <div className="vk-mobile-ui relative h-full w-full bg-black text-white">
      {/* ─── FIXED HEADER AREA ────────────────────────────────────────────────── */}
      <div
        ref={rootRef}
        className="absolute left-0 right-0 z-40 flex flex-col items-center gap-4 px-6 pt-[max(20px,env(safe-area-inset-top))]"
      >
        {/* Main Location Pill */}
        <motion.button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          whileTap={{ scale: 0.97 }}
          className={`relative flex w-auto min-w-[200px] max-w-[90vw] flex-col items-center rounded-[32px] px-8 py-5 transition-all duration-300 ${GLASS_PILL} ${
            open ? "border-red-500/40 ring-4 ring-red-500/10" : ""
          }`}
        >
          <span className={LABEL_HEADER}>Location</span>
          <div className="mt-2 flex w-full items-center justify-center gap-3">
            <MapPin size={22} weight="fill" className="text-[#e31e24] drop-shadow-[0_0_10px_rgba(227,30,36,0.6)]" />
            <span className="min-w-0 flex-1 truncate text-center text-[17px] font-bold tracking-tight text-white">
              {label}
            </span>
            <motion.div
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <CaretDown size={14} weight="bold" className="text-neutral-500" />
            </motion.div>
          </div>
        </motion.button>

        {/* ─── PROXIMITY ALERT (The "Floating Status" from reference) ────────── */}
        <AnimatePresence>
          {!inRange && showWarning && !open && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.94 }}
              className={`flex w-full max-w-[340px] items-center gap-4 rounded-[24px] px-6 py-4 ${GLASS_PILL} border-red-500/30 shadow-[0_12px_40px_rgba(189,35,32,0.15)]`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-[#e31e24]">
                <MapPinArea size={26} weight="duotone" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-bold leading-tight text-white">Is this the right address?</p>
                <p className="mt-0.5 text-[12px] font-medium text-neutral-400">It looks a little far from you.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowWarning(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── DROPDOWN MENU ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {open && (
            <motion.div
              id={menuId}
              role="dialog"
              aria-label="Delivery location"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={`w-full max-w-[320px] rounded-[32px] p-8 ${GLASS_PILL} border-white/10`}
            >
              <p className={LABEL_HEADER}>Delivering to</p>
              <p className="mt-3 text-[20px] font-extrabold leading-tight tracking-tight text-white">{label}</p>

              <div className="mt-6 flex items-center gap-3 rounded-[18px] bg-white/5 px-4 py-3.5 ring-1 ring-white/5">
                <div
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    inRange ? "bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]" : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                  }`}
                />
                <span className="text-[13px] font-bold text-neutral-400">
                  {inRange ? "Inside delivery zone" : "Confirm address manually"}
                </span>
              </div>

              {onChangeLocation && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onChangeLocation();
                  }}
                  className="mt-8 w-full rounded-[20px] bg-[#e31e24] py-4 text-center text-[14px] font-extrabold text-white shadow-[0_8px_25px_rgba(227,30,36,0.35)] active:scale-95 transition-all"
                >
                  Change delivery address
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Backdrop overlay for open state */}
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close location menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-md"
            onClick={close}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
