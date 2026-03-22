"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Faster loading duration: 4 seconds total
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) setTimeout(onComplete, 800); 
    }, 4000);
    return () => clearTimeout(timer);
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
            {/* Circular Progress Ring - Reduced radius to 95 for tighter fit */}
            <svg 
              style={{ position: 'absolute', top: 0, left: 0, width: '200px', height: '200px', transform: 'rotate(-90deg)' }} 
              viewBox="0 0 200 200"
            >
              <circle
                cx="100"
                cy="100"
                r="95"
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="2"
              />
              <motion.circle
                cx="100"
                cy="100"
                r="95"
                fill="transparent"
                stroke="#E21F27"
                strokeWidth="4"
                strokeDasharray="596.9" /* 2 * PI * 95 */
                initial={{ strokeDashoffset: 596.9 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 3.5, ease: "easeInOut" }}
                strokeLinecap="round"
              />
            </svg>

            {/* Logo Wrapper - Grayscale to Color Transition */}
            <motion.div
              initial={{ opacity: 0, filter: 'grayscale(100%)' }}
              animate={{ opacity: 1, filter: 'grayscale(0%)' }}
              transition={{ 
                opacity: { duration: 1 },
                filter: { delay: 1.5, duration: 2, ease: "easeInOut" } 
              }}
              style={{
                position: 'relative',
                width: '160px',
                height: '160px',
                backgroundColor: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 40px rgba(226,31,39,0.25)',
                overflow: 'hidden',
                zIndex: 20
              }}
            >
              <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                <Image 
                  src="/VK_Logo.png" 
                  alt="Vidya's Kitchen" 
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
            </motion.div>
          </div>

          {/* Loading Text - "LOADING" with shimmer effect in primary color */}
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
                backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" }
              }}
              style={{
                fontSize: '14px',
                fontWeight: '900',
                letterSpacing: '0.6em',
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg, #E21F27 0%, #ffffff 50%, #E21F27 100%)',
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
