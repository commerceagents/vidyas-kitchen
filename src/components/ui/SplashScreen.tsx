"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { TYPO } from "@/components/ui/mobile/mobile-typography";

/**
 * Android draws its own launch screen — our icon centred on the manifest's
 * background colour — before any of this code runs, and there is no way to
 * suppress it. Measured off a device, it renders the icon at ~56% of the
 * viewport width, dead centre. Starting our logo at those exact dimensions and
 * then morphing it into the loader makes the handover invisible: it reads as
 * one screen that comes to life rather than two screens in a row.
 */
const ANDROID_ICON_VW = 0.557;
const ANDROID_ICON_MAX = 300;
/** Artwork occupies this much of a maskable icon — see scripts/generate-icons.py. */
const MASKABLE_ART = 0.8;
const LOADER_LOGO = 120;
/** Let the tile sit still briefly so it reads as the same object Android drew. */
const MORPH_DELAY = 0.45;
const MORPH_DURATION = 0.75;

export function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const [showPulse, setShowPulse] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Only ever rendered client-side (page.tsx decides in a layout effect), so
  // reading the viewport during the first render is safe.
  const [tileSize] = useState(() =>
    typeof window === "undefined"
      ? 220
      : Math.min(Math.round(window.innerWidth * ANDROID_ICON_VW), ANDROID_ICON_MAX),
  );

  useEffect(() => {
    const pulseTimer = setTimeout(() => setShowPulse(true), 3500);
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) setTimeout(onComplete, 800);
    }, 4800);
    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(timer);
    };
  }, [onComplete]);

  useEffect(() => {
    const fallback = setTimeout(() => setImageLoaded(true), 400);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="refined-splash-v4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          className="vk-splash-screen"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100dvh',
            padding: 0,
            overflow: 'hidden'
          }}
        >
          <style>{`
            .vk-splash-screen {
              background-color: #F5F5F7;
            }
            @media (min-width: 1024px) {
              .vk-splash-screen {
                background-color: #0d0d0d;
              }
            }
          `}</style>
          {/* Atmospheric Lighting - Corner Glows */}
          <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(189, 35, 32, 0.08) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(189, 35, 32, 0.06) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '20%', right: '0%', width: '30%', height: '30%', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

          {/* Main Visual Group */}
          <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* Outer Pulsing Glow (Behind Logo) */}
            <AnimatePresence>
              {showPulse && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.5], opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      position: 'absolute',
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(189, 35, 32, 0.8) 0%, rgba(189, 35, 32, 0) 80%)',
                      filter: 'blur(15px)',
                      zIndex: 10
                    }}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Circular Progress Ring */}
            <svg 
              style={{ position: 'absolute', top: 0, left: 0, width: '200px', height: '200px', transform: 'rotate(-90deg)' }} 
              viewBox="0 0 200 200"
            >
              <motion.circle
                cx="100"
                cy="100"
                r="75"
                fill="transparent"
                stroke="#BD2320"
                strokeWidth="3"
                strokeDasharray="471.24"
                // Held back until the tile has shrunk past it, otherwise the
                // ring is drawn across the middle of the still-large logo.
                initial={{ strokeDashoffset: 471.24, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: 1 }}
                transition={{
                  strokeDashoffset: { duration: 3.5, ease: "easeInOut" },
                  opacity: { delay: MORPH_DELAY + MORPH_DURATION * 0.7, duration: 0.35 },
                }}
                strokeLinecap="round"
              />
            </svg>

            {/* Picks up exactly where Android's launch screen left off: the same
                red tile, at the same size, which then shrinks into the loader. */}
            <motion.div
              initial={{
                width: tileSize,
                height: tileSize,
                borderRadius: '24%',
                backgroundColor: '#BD2320',
              }}
              animate={{
                width: LOADER_LOGO,
                height: LOADER_LOGO,
                borderRadius: '50%',
                backgroundColor: 'rgba(189, 35, 32, 0)',
              }}
              transition={{
                delay: MORPH_DELAY,
                duration: MORPH_DURATION,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                zIndex: 20,
              }}
            >
              <motion.div
                // Grows from the maskable icon's safe zone to fill the circle,
                // so the artwork lands at the loader's proportions.
                initial={{ width: `${MASKABLE_ART * 100}%`, height: `${MASKABLE_ART * 100}%`, opacity: imageLoaded ? 1 : 0.35 }}
                animate={{ width: '100%', height: '100%', opacity: 1 }}
                transition={{
                  delay: MORPH_DELAY,
                  duration: MORPH_DURATION,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  position: 'relative',
                  borderRadius: '50%',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src="/VK_Logo.webp"
                  alt="Vidya's Kitchen"
                  fill
                  sizes="300px"
                  className="vk-logo-circle"
                  style={{ objectFit: 'cover', borderRadius: '50%' }}
                  priority
                  onLoad={() => setImageLoaded(true)}
                />
              </motion.div>
            </motion.div>
          </div>

          {/* Loading Text - Restored Silver Shimmering Effect */}
          <div style={{
            position: 'absolute',
            bottom: '80px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                backgroundPosition: ['200% center', '-200% center']
              }}
              transition={{
                opacity: { delay: 0.5, duration: 1 },
                backgroundPosition: { duration: 4, repeat: Infinity, ease: "linear" }
              }}
              style={{
                ...TYPO.loading,
                background: 'linear-gradient(90deg, #cccccc 0%, #BD2320 50%, #cccccc 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
                textAlign: 'center',
              }}
            >
              LOADING
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
