"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { TYPO } from "@/components/ui/mobile/mobile-typography";

/**
 * Android draws its own launch screen — our icon centred on the manifest's
 * background colour — before any of this code runs. Neither suppressing it nor
 * changing the size it draws the icon at is ours to control, so the only way to
 * avoid a jarring cut is to open at the size the OS left off and shrink.
 *
 * Measured off a device, the launch icon renders as a circle ~56% of the
 * viewport width, dead centre. We start there and shrink immediately — no pause
 * first. Holding the big logo still for a beat sold the illusion better but
 * left an oversized logo sitting on screen, which read as clumsy; moving from
 * the first frame keeps the continuity without the dwell.
 */
const ANDROID_ICON_VW = 0.557;
const ANDROID_ICON_MAX = 300;
const LOADER_LOGO = 120;
const SHRINK_DURATION = 0.62;

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
                // Held back until the logo has shrunk inside it, otherwise the
                // ring is drawn across the middle of the still-large artwork.
                initial={{ strokeDashoffset: 471.24, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: 1 }}
                transition={{
                  strokeDashoffset: { duration: 3.5, ease: "easeInOut" },
                  opacity: { delay: SHRINK_DURATION * 0.6, duration: 0.35 },
                }}
                strokeLinecap="round"
              />
            </svg>

            {/* Starts as the circle Android's launch screen left on screen and
                shrinks into the loader, so the two screens read as one object.
                Android masks the icon to a circle, so this is a pure size
                change — no shape or colour shift to give the seam away. */}
            <motion.div
              initial={{ width: tileSize, height: tileSize }}
              animate={{ width: LOADER_LOGO, height: LOADER_LOGO }}
              transition={{ duration: SHRINK_DURATION, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                zIndex: 20,
              }}
            >
              <motion.div
                animate={{ opacity: imageLoaded ? 1 : 0.35 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
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
