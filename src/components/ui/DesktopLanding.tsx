"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

import { Phone } from "@phosphor-icons/react";
import { ChefSpecialVector } from "./vectors/ChefSpecialVector";
import { HomemadeSpicesVector } from "./vectors/HomemadeSpicesVector";

function GlowingBlobsBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#0d0d0d', zIndex: 0 }}>
      {/* Corner Atmospheric Glows - ABSTRACT BREATHING */}
      <motion.div 
        animate={{ 
          opacity: [0.15, 0.4, 0.15],
          scale: [1, 1.2, 0.9, 1],
          x: [0, 30, -30, 0]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        style={{ 
          position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', 
          background: 'radial-gradient(circle, rgba(189, 35, 32, 0.35) 0%, transparent 70%)', 
          filter: 'blur(80px)', pointerEvents: 'none',
          willChange: 'transform, opacity, filter',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0,0,0)'
        }} 
      />
      <motion.div 
        animate={{ 
          opacity: [0.1, 0.35, 0.1],
          scale: [0.9, 1.15, 0.85, 0.9],
          x: [0, -40, 40, 0]
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{ 
          position: 'absolute', bottom: '-10%', right: '-10%', width: '60%', height: '60%', 
          background: 'radial-gradient(circle, rgba(189, 35, 32, 0.45) 0%, transparent 70%)', 
          filter: 'blur(100px)', pointerEvents: 'none',
          willChange: 'transform, opacity, filter',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0,0,0)'
        }} 
      />

      {/* DIAGONAL STUDIO SPOTLIGHT BEAM */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: '120%',
        height: '140%',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 20%, transparent 40%)',
        pointerEvents: 'none',
        zIndex: 5
      }} />

      {/* Pulsing Red Blob (Center-ish) - SATURATED CRIMSON */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '20%',
          left: '25%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(189, 35, 32, 0.4) 0%, transparent 70%)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          willChange: 'transform, opacity, filter',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0,0,0)'
        }}
      />
    </div>
  );
}

export function DesktopLanding() {
  const domain = "https://vidyaskitchenhome.com";
  const whatsappNumber = "+91 75500 28179";

  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [chickenLoaded, setChickenLoaded] = useState(false);
  const [muttonLoaded, setMuttonLoaded] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsLargeScreen(window.innerWidth > 1024);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  if (!isLargeScreen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      backgroundColor: '#0d0d0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      color: 'white',
      fontFamily: 'var(--font-jetbrains-mono), monospace'
    }}>
      {/* Glowing Blobs Background */}
      <GlowingBlobsBackground />

      {/* Rotating Background Asset (Chicken Curry - RIGHT CENTER) */}
      <div style={{ position: 'absolute', top: '50%', right: '-250px', width: '500px', height: '500px', transform: 'translateY(-50%)', zIndex: 4 }}>
        {/* Outer Motion Div for Slide-in Performance (Safari Optimized) */}
        <motion.div
          initial={{ x: 400, opacity: 0, rotate: 180 }}
          animate={{ 
            x: chickenLoaded ? 0 : 400, 
            opacity: chickenLoaded ? 0.5 : 0,
            rotate: chickenLoaded ? 0 : 180
          }}
          transition={{ 
            x: { duration: 2, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 1.5, ease: "easeOut" },
            rotate: { duration: 2, ease: [0.16, 1, 0.3, 1] }
          }}
          style={{
            width: '100%',
            height: '100%',
            willChange: 'transform, opacity',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden'
          }}
        >
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 0 50px rgba(0,0,0,0.8)',
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)'
            }}
          >
            <Image
              src="/chicken_curry.webp"
              alt="Authentic Chicken Curry"
              fill
              style={{ objectFit: 'cover' }}
              onLoad={() => setChickenLoaded(true)}
            />
          </motion.div>
        </motion.div>

        {/* User-provided Vector: Homemade Spices (Beside Chicken Curry) */}
        <motion.div
          animate={{ 
            y: [0, -10, 0],
            rotate: [-2, 2, -2]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '80px',
            right: '480px', // Dramatically moved to completely clear the rim
            width: '180px', // Further reduced size for boutique look
            height: '160px',
            zIndex: 3,
            pointerEvents: 'none',
            justifyContent: 'center'
          }}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1.5 }}
            style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <HomemadeSpicesVector 
              style={{ width: '100%', height: '100%', opacity: 0.6, mixBlendMode: 'screen' }} 
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Rotating Background Asset (Fish Curry - LEFT CENTER) */}
      <div style={{ position: 'absolute', top: '50%', left: '-250px', width: '500px', height: '500px', transform: 'translateY(-50%)', zIndex: 4 }}>
        {/* Outer Motion Div for Slide-in Performance (Safari Optimized) */}
        <motion.div
          initial={{ x: -400, opacity: 0, rotate: -180 }}
          animate={{ 
            x: muttonLoaded ? 0 : -400, 
            opacity: muttonLoaded ? 0.5 : 0,
            rotate: muttonLoaded ? 0 : -180
          }}
          transition={{ 
            x: { duration: 2, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 1.5, ease: "easeOut" },
            rotate: { duration: 2, ease: [0.16, 1, 0.3, 1] }
          }}
          style={{
            width: '100%',
            height: '100%',
            willChange: 'transform, opacity',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden'
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 0 50px rgba(0,0,0,0.8)',
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)'
            }}
          >
            <Image
              src="/mutton_curry.webp"
              alt="Authentic Mutton Curry"
              fill
              style={{ objectFit: 'cover' }}
              onLoad={() => setMuttonLoaded(true)}
            />
          </motion.div>
        </motion.div>

        {/* User-provided Vector: Chef's Special (Beside Fish Curry) */}
        <motion.div
          animate={{ 
            x: [0, 8, 0],
            rotate: [2, -2, 2]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '60px',
            left: '480px', // Dramatically moved to the right to completely clear the rim
            width: '180px', // Further reduced size for boutique look
            height: '160px',
            zIndex: 3,
            pointerEvents: 'none'
          }}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1.5 }}
            style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChefSpecialVector 
              style={{ width: '100%', height: '100%', opacity: 0.6, mixBlendMode: 'screen' }} 
            />
          </motion.div>
        </motion.div>
      </div>

      {/* NEON RED ATMOSPHERIC BLOBS (Behind the card - Liquid Feel) */}
      <motion.div
        animate={{ 
          x: [0, 60, -60, 0], 
          y: [0, -40, 40, 0],
          scale: [1, 1.3, 0.8, 1],
          opacity: [0.5, 0.8, 0.5] // Max Bloom
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '30%',
          left: '35%',
          width: '550px',
          height: '550px',
          background: 'radial-gradient(circle, rgba(189, 35, 32, 0.45) 0%, transparent 75%)',
          filter: 'blur(90px)',
          zIndex: 55,
          pointerEvents: 'none',
          willChange: 'transform, opacity, filter',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0,0,0)'
        }}
      />
      <motion.div
        animate={{ 
          x: [0, -80, 80, 0], 
          y: [0, 50, -50, 0],
          scale: [0.8, 1.2, 0.7, 0.8],
          opacity: [0.4, 0.7, 0.4] // Max Bloom
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{
          position: 'absolute',
          top: '20%',
          right: '30%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(189, 35, 32, 0.35) 0%, transparent 75%)',
          filter: 'blur(110px)',
          zIndex: 56,
          pointerEvents: 'none',
          willChange: 'transform, opacity, filter',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0,0,0)'
        }}
      />

      {/* Main REFINED Card - Glassmorphism Style */}
      <motion.div
        initial={{ scale: 0.8, filter: 'blur(20px)', opacity: 0, y: 80 }}
        animate={{ scale: 1, filter: 'blur(0px)', opacity: 1, y: 60 }}
        transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '440px',
          padding: '24px 40px',
          background: 'linear-gradient(145deg, rgba(15, 15, 15, 0.95) 0%, rgba(5, 5, 5, 0.98) 100%)', // Obsidian Matte
          backdropFilter: 'blur(60px)', 
          WebkitBackdropFilter: 'blur(60px)',
          borderRadius: '38px', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          textAlign: 'center',
          boxShadow: `
            0 40px 100px rgba(0,0,0,1), 
            0 0 0 1px rgba(255,255,255,0.02) inset,
            0 0 80px rgba(189,35,32,0.12)
          `, // DEEP RED UNDER-GLOW
          maxHeight: '85vh',
          overflowY: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          willChange: 'transform, opacity, filter',
          WebkitBackfaceVisibility: 'hidden',
          WebkitTransform: 'translate3d(0,0,0)'
        }}
      >
        {/* LIQUID AMBIENT GLOWS (Inside the card but behind content) - WANDERING */}
        <motion.div 
          animate={{
            x: [0, 320, 100, 280, 0], // Full horizontal sweep
            y: [0, 400, 150, 450, 0], // Full vertical sweep
            scale: [1, 1.4, 0.8, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '-10%',
            left: '-10%',
            width: '60%',
            height: '40%',
            background: 'radial-gradient(circle at center, rgba(189, 35, 32, 0.35) 0%, transparent 70%)',
            filter: 'blur(70px)',
            pointerEvents: 'none',
            zIndex: 1,
            willChange: 'transform, opacity, filter',
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translate3d(0,0,0)'
          }} 
        />

        {/* PERIODIC BREATHING SILVER SHIMMER - Slow Lap with Fade In/Out */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', padding: '1.5px', pointerEvents: 'none', zIndex: 12 }}>
          <motion.div
            animate={{ 
              offsetDistance: ["0%", "100%"],
              opacity: [0, 1, 1, 0] // Fades in, stays, fades out
            } as any}
            transition={{ 
              duration: 12, // Very Slow graceful lap 
              repeat: Infinity, 
              ease: "easeInOut",
              times: [0, 0.1, 0.9, 1] // Quick fade in/out at ends
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '180px', // Bigger streak
              height: '3px',  // Thicker streak
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)',
              offsetPath: 'inset(0 round 38px)',
              offsetRotate: 'auto',
              boxShadow: '0 0 20px rgba(255,255,255,0.6)',
              zIndex: 12,
              willChange: 'transform, opacity, filter',
              WebkitBackfaceVisibility: 'hidden',
              WebkitTransform: 'translate3d(0,0,0)'
            }}
          />
        </div>

        {/* Vertical Wave 'Shining' Grid - PLAYS ONLY ONCE ON LOAD (6s SLOW) */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', padding: 'inherit', borderRadius: 'inherit' }}>
          <motion.div 
            initial={{ maskPosition: '0% -100%', WebkitMaskPosition: '0% -100%' } as any}
            animate={{ maskPosition: '0% 200%', WebkitMaskPosition: '0% 200%' } as any}
            transition={{ 
              duration: 6, // Slower Sweep
              ease: "easeInOut",
              delay: 0.5
            }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)
              `,
              backgroundSize: '8px 8px', // Denser grid
              pointerEvents: 'none',
              zIndex: 2,
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black, transparent)',
              maskImage: 'linear-gradient(to bottom, transparent, black, transparent)',
              WebkitMaskSize: '100% 200px',
              maskSize: '100% 200px',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat'
            }}
          />
        </div>

        {/* Top Brand Logo */}
        <motion.div 
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          style={{
            width: '115px', // Enlarged
            height: '115px',
            minWidth: '115px',
            minHeight: '115px',
            display: 'flex', // Restored
            alignItems: 'center', // Restored
            justifyContent: 'center', // Restored
            marginTop: '-12px', // Pushed slightly higher
            marginBottom: '4px', // Optimized spacing
            zIndex: 10,
            background: 'transparent', // Explicitly transparent
            borderRadius: '50%',
            flexShrink: 0
          }}
        >
          <Image 
            src="/VK_Logo.webp" 
            alt="Vidya's Kitchen" 
            width={85} // Larger image 
            height={85} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
            priority
          />
        </motion.div>

        {/* Header Section */}
        <div style={{ marginBottom: '16px', zIndex: 10 }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: '-0.04em',
            lineHeight: '1.4', // Increased line height for spacing
            textTransform: 'uppercase'
          }}>
            <span style={{ 
              fontSize: '14px', 
              letterSpacing: '2px', // Reduced letter spacing
              opacity: 0.4, 
              color: '#FFFFFF', 
              display: 'block', 
              marginBottom: '2px' // Reduced from 8px
            }}>Welcome to</span>
            <span style={{ color: '#BD2320' }}>Vidya&apos;s Kitchen</span>
          </h2>
        </div>

        {/* Floating QR Section with Glass Effect */}
        <div style={{
          position: 'relative',
          width: '180px',
          height: '180px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          {/* THE SCANNING LINE FLARE */}
          <motion.div
            animate={{
              top: ['0%', '100%', '0%']
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              left: '0',
              width: '100%',
              zIndex: 35,
              pointerEvents: 'none'
            }}
          >
            <div style={{
              width: '100%',
              height: '2px', // Thicker line
              background: 'linear-gradient(90deg, transparent 0%, #BD2320 50%, transparent 100%)',
              boxShadow: '0 0 30px rgba(189,35,32,1)', // More intense spread
            }} />
          </motion.div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)', // Even more subtle
            backdropFilter: 'blur(40px)', // Stronger glass
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <QRCode 
              value={domain}
              size={140}
              fgColor="#FFFFFF"
              bgColor="transparent"
              level="H"
              style={{ borderRadius: '8px' }} // Subtle corner radius on the SVG itself
            />
          </div>
        </div>

        {/* QR Instruction Text */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 1 }}
          style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            maxWidth: '420px',
            lineHeight: '1.4',
            marginTop: '8px',
            marginBottom: '12px',
            zIndex: 10,
            textTransform: 'none',
            letterSpacing: '0.01em',
            fontWeight: '400',
            whiteSpace: 'pre-line'
          }}
        >
          {"Hungry? Scan to explore our gourmet menu\nand order your favorites in seconds!"}
        </motion.p>

        {/* Action Button Row */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px', 
          width: '100%',
          marginTop: 'auto',
          zIndex: 10
        }}>
          {/* Combined "Order with Vidya Bot" Button */}
          <motion.a 
            href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=Hi!+I'd+like+to+order+from+today's+menu.`}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={false}
            animate={{
              backgroundColor: isHovered ? '#25D366' : '#FFFFFF',
              color: isHovered ? '#FFFFFF' : '#000000',
              scale: isHovered ? 1.02 : 1
            }}
            transition={{ 
              duration: 0.3,
              ease: "easeInOut"
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '18px',
              borderRadius: '16px',
              fontWeight: '900',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textDecoration: 'none'
            }}
          >
            <motion.div
              animate={{ color: isHovered ? "#FFFFFF" : "#25D366" }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <WhatsappLogo size={24} weight="fill" />
            </motion.div>
            Order with Vidya Bot
          </motion.a>
          
          <p style={{ 
            fontSize: '10px', 
            color: 'rgba(255,255,255,0.4)', 
            letterSpacing: '1px',
            fontWeight: '500'
          }}>
            Order from our daily menu or get instant support via WhatsApp
          </p>
        </div>
      </motion.div>

      {/* Subtle Footer */}
      <div style={{ 
        marginTop: '100px', // Reduced from 140px for symmetry
        zIndex: 60
      }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '32px'
          }}
        >
          <div style={{
            display: 'flex',
            gap: '32px'
          }}>
          {['Terms', 'Privacy', 'Refund Policy'].map((item) => (
            <a
              key={item}
              href={`/${item.toLowerCase().replace(' ', '-')}`}
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.2)',
                textDecoration: 'none',
                letterSpacing: '2px',
                fontWeight: '900',
                textTransform: 'uppercase',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
            >
              {item}
            </a>
          ))}
          </div>
          
          <div style={{ 
            fontSize: '12px', 
            color: 'rgba(255,255,255,0.2)',
            letterSpacing: '4px',
            fontWeight: '900',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>&copy;</span> 2026 VIDYA&apos;S KITCHEN. ALL RIGHTS RESERVED.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
