"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

interface DeliveryCheckScreenProps {
  locationLabel: string;
  inRange: boolean;
  onProceed: () => void;
  phone: string;
}

export function DeliveryCheckScreen({ locationLabel, inRange, onProceed, phone }: DeliveryCheckScreenProps) {
  // Auto-proceed if in range after short delay
  useEffect(() => {
    if (inRange) {
      const t = setTimeout(onProceed, 2200);
      return () => clearTimeout(t);
    }
  }, [inRange, onProceed]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 text-center overflow-hidden">
      {/* Background glow */}
      <div
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] blur-[90px] rounded-full pointer-events-none transition-all duration-700 ${
          inRange ? "bg-[#E21F27] opacity-10" : "bg-[#ff9900] opacity-8"
        }`}
      />

      {inRange ? (
        // IN RANGE — Green tick, auto-proceed
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated check circle */}
          <motion.div
            className="w-28 h-28 rounded-full bg-[#E21F27]/15 flex items-center justify-center mb-7"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          >
            <motion.svg
              width="52" height="52" viewBox="0 0 24 24" fill="none"
              stroke="#E21F27" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <motion.path
                d="M5 13l4 4L19 7"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              />
            </motion.svg>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-white/50 text-sm mb-1">Delivering to</p>
            <h2 className="text-white text-xl font-bold mb-3">{locationLabel}</h2>
            <div className="inline-flex items-center gap-2 bg-[#E21F27]/10 border border-[#E21F27]/20 rounded-full px-4 py-1.5 mb-8">
              <div className="w-2 h-2 rounded-full bg-[#E21F27] animate-pulse" />
              <span className="text-[#E21F27] text-sm font-medium">Delivery Available</span>
            </div>
            <p className="text-white/30 text-xs">Taking you to the menu...</p>
          </motion.div>

          {/* Loading bar */}
          <motion.div
            className="absolute bottom-16 left-8 right-8 h-0.5 bg-white/5 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-[#E21F27] rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2 }}
            />
          </motion.div>
        </motion.div>
      ) : (
        // OUT OF RANGE
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Sad pin */}
          <motion.div
            className="w-28 h-28 rounded-full bg-white/5 flex items-center justify-center mb-7"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
              <circle cx="12" cy="9" r="2.5" fill="white" fillOpacity="0.4" />
              <path d="M9 21h6" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.div>

          <h2 className="text-white text-2xl font-bold mb-3">Not in your area yet</h2>
          <p className="text-white/40 text-sm leading-relaxed mb-2 max-w-xs">
            <span className="text-white/60 font-medium">{locationLabel}</span> is outside our current delivery zone.
          </p>
          <p className="text-white/30 text-sm mb-8 max-w-xs">
            We currently deliver exclusively within <span className="text-white/50">Sivakasi, Tamil Nadu</span>.
            Expanding soon!
          </p>

          <motion.button
            whileTap={{ scale: 0.97 }}
            className="w-full bg-white/5 border border-white/10 text-white font-semibold py-4 rounded-2xl mb-3 text-base"
            onClick={() => {
              // Save notify interest — UI only for now
              alert(`We'll notify ${phone} when we expand to your area!`);
            }}
          >
            Notify Me When We Expand
          </motion.button>

          <button
            onClick={onProceed}
            className="text-white/30 text-sm"
          >
            Browse menu anyway →
          </button>
        </motion.div>
      )}
    </div>
  );
}
