"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const [showPulse, setShowPulse] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Pulse circle completion at 3.5s
    const pulseTimer = setTimeout(() => setShowPulse(true), 3500);
    // Sudden logo burst at 3.9s
    const burstTimer = setTimeout(() => setShowBurst(true), 3900);
    // Final exit at 5.2s
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) setTimeout(onComplete, 800); 
    }, 5200);
    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(timer);
    };
  }, [onComplete]);

  if (!mounted) return null;

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="refined-splash-v2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            backgroundColor: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100dvh',
            margin: 0,
            padding: 0,
            overflow: 'hidden'
          }}
        >
          {/* Main Visual Group - Reduced container size for smaller gap */}
          <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Outer Pulsing Glow (Behind Logo) */}
            <AnimatePresence>
              {showPulse && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ 
                      scale: [1, 1.5], 
                      opacity: [0, 1, 0] 
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      position: 'absolute',
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(226, 31, 39, 1) 0%, rgba(226, 31, 39, 0) 80%)',
                      filter: 'blur(15px)',
                      zIndex: 10
                    }}
                  />
                  
                  {/* Glitter Particles Effect - Shimmering burst */}
                  {[...Array(35)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ 
                        opacity: 0, 
                        scale: 0,
                        x: 0,
                        y: 0
                      }}
                      animate={{ 
                        opacity: [0, 1, 0.8, 1, 0],
                        scale: [0, 1.2, 0.8, 1.1, 0],
                        x: (Math.random() - 0.5) * 350,
                        y: (Math.random() - 0.5) * 350,
                      }}
                      transition={{ 
                        duration: 1.5, 
                        ease: [0.16, 1, 0.3, 1],
                        delay: Math.random() * 0.2
                      }}
                      style={{
                        position: 'absolute',
                        width: Math.random() * 3 + 1 + 'px',
                        height: Math.random() * 3 + 1 + 'px',
                        borderRadius: '50%',
                        backgroundColor: '#E21F27',
                        boxShadow: '0 0 10px rgba(226, 31, 39, 0.9)',
                        zIndex: 15
                      }}
                    />
                  ))}
                </>
              )}
            </AnimatePresence>

            {/* Completion Ripple Wave */}
            <AnimatePresence>
              {showPulse && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ 
                    scale: 1.3, 
                    opacity: 0 
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    position: 'absolute',
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: '1px solid rgba(139, 31, 39, 0.6)',
                    zIndex: 10
                  }}
                />
              )}
            </AnimatePresence>

            {/* Circular Progress Ring - Reduced radius to 75 for boutique look */}
            <svg 
              style={{ position: 'absolute', top: 0, left: 0, width: '200px', height: '200px', transform: 'rotate(-90deg)' }} 
              viewBox="0 0 200 200"
            >
              <motion.circle
                cx="100"
                cy="100"
                r="75"
                fill="transparent"
                stroke="#E21F27"
                strokeWidth="3"
                strokeDasharray="471.24" /* 2 * PI * 75 */
                initial={{ strokeDashoffset: 471.24 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 3.5, ease: "easeInOut" }}
                strokeLinecap="round"
              />
            </svg>

            {/* Logo Burst Swarm */}
            <AnimatePresence>
              {showBurst && (
                <div style={{ position: 'absolute', zIndex: 30 }}>
                  {[...Array(60)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 0.8 }}
                      animate={{ 
                        x: (Math.random() - 0.5) * 600,
                        y: (Math.random() - 0.5) * 600,
                        opacity: 0,
                        scale: 0
                      }}
                      transition={{ 
                        duration: 1.2, 
                        ease: [0.16, 1, 0.3, 1],
                        delay: Math.random() * 0.1
                      }}
                      style={{
                        position: 'absolute',
                        width: Math.random() * 4 + 2 + 'px',
                        height: Math.random() * 4 + 2 + 'px',
                        borderRadius: '50%',
                        backgroundColor: '#E21F27',
                        boxShadow: '0 0 10px rgba(226, 31, 39, 0.9)',
                      }}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Logo Wrapper - Fades and bursts out */}
            <motion.div
              animate={{ 
                opacity: showBurst ? 0 : 1,
                scale: showBurst ? 1.4 : 1,
                filter: showBurst ? 'blur(10px)' : 'blur(0px)'
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{
                position: 'relative',
                width: '120px', // Reduced size
                height: '120px',
                backgroundColor: 'black', // Black background
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 50px rgba(0,0,0,1)',
                overflow: 'hidden',
                zIndex: 20
              }}
            >
              {/* Shine Overlay Effect */}
              <motion.div
                animate={{
                  x: ['-200%', '200%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                  delay: 0.5
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)',
                  zIndex: 25,
                  pointerEvents: 'none'
                }}
              />

              <div style={{ position: 'relative', width: '80%', height: '80%', borderRadius: '50%', overflow: 'hidden' }}>
                <Image 
                  src="/VK_Logo.webp" 
                  alt="Vidya's Kitchen" 
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
            </motion.div>
          </div>

          {/* Loading Text - Fades out with burst */}
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
              animate={{ 
                opacity: showBurst ? 0 : 1,
                y: showBurst ? 10 : 0
              }}
              transition={{
                opacity: { delay: 0.5, duration: 1 },
                backgroundPosition: { duration: 4, repeat: Infinity, ease: "linear" }
              }}
              style={{
                fontSize: '12px',
                fontWeight: '900',
                letterSpacing: '0.8em',
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg, #333333 0%, #ffffff 50%, #333333 100%)', // Silver shimmer
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
                textAlign: 'center'
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
