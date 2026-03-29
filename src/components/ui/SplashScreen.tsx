"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const [showPulse, setShowPulse] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Pulse circle completion at 3.5s
    const pulseTimer = setTimeout(() => setShowPulse(true), 3500);
    // Final exit at 4.8s
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) setTimeout(onComplete, 800); 
    }, 4800);
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
          key="refined-splash-v4"
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
          {/* Main Visual Group */}
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
                  
                  {/* Glitter Particles Effect - Shimmering burst BEHIND logo */}
                  {[...Array(50)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                      animate={{ 
                        opacity: [0, 1, 0.8, 1, 0],
                        scale: [0, 1.2, 0.8, 1.1, 0],
                        x: (Math.random() - 0.5) * 450,
                        y: (Math.random() - 0.5) * 450,
                      }}
                      transition={{ 
                        duration: 1.6, 
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
                stroke="#E21F27"
                strokeWidth="3"
                strokeDasharray="471.24"
                initial={{ strokeDashoffset: 471.24 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 3.5, ease: "easeInOut" }}
                strokeLinecap="round"
              />
            </svg>

            {/* Logo Wrapper - Stays solid */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                backgroundColor: 'black',
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
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.5 }}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)',
                  zIndex: 25, pointerEvents: 'none'
                }}
              />

              <div style={{ position: 'relative', width: '80%', height: '80%', borderRadius: '50%', overflow: 'hidden' }}>
                <Image 
                  src="/VK_Logo.webp" alt="Vidya's Kitchen" fill
                  style={{ objectFit: 'contain' }} priority
                />
              </div>
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
                fontSize: '11px',
                fontWeight: '900',
                letterSpacing: '0.8em',
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg, #333333 0%, #ffffff 50%, #333333 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
                textAlign: 'center',
                fontFamily: 'var(--font-jetbrains-mono)'
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
