"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

import { Phone } from "@phosphor-icons/react";

function GlowingBlobsBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000', zIndex: 0 }}>
      {/* Blob 1 - Red Glow (Increased Visibility) */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          x: ['-5%', '5%', '-5%'],
          y: ['-5%', '5%', '-5%'],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '15%',
          left: '15%',
          width: '700px', // Bigger
          height: '700px',
          background: 'radial-gradient(circle, rgba(226,31,39,0.18) 0%, transparent 70%)',
          filter: 'blur(100px)',
          borderRadius: '50%',
        }}
      />
      {/* Blob 2 - Dark Deep Blue Glow (Increased Visibility) */}
      <motion.div
        animate={{
          scale: [1.3, 1, 1.3],
          x: ['5%', '-5%', '5%'],
          y: ['5%', '-5%', '5%'],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          bottom: '5%',
          right: '10%',
          width: '800px', // Bigger
          height: '800px',
          background: 'radial-gradient(circle, rgba(30,58,138,0.15) 0%, transparent 70%)',
          filter: 'blur(120px)',
          borderRadius: '50%',
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
      backgroundColor: '#000000',
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
      <motion.div
        initial={{ y: '-50%', rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-250px', // Half-clipped from right
          width: '500px',
          height: '500px',
          zIndex: 4,
          opacity: 0.5,
          pointerEvents: 'none',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(0,0,0,0.8)'
        }}
      >
        <Image 
          src="/chicken_curry_generated.png" 
          alt="" 
          width={500}
          height={500}
          style={{ objectFit: 'cover' }}
        />
      </motion.div>

      {/* --- CHALK ILLUSTRATIONS (THE CHEF'S SKETCHBOOK) --- */}
      
      {/* Floating Aromatic Steam (Top Left) */}
      <motion.div
        animate={{ 
          y: [0, -15, 0],
          x: [0, 10, 0],
          rotate: [0, 2, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: '400px',
          height: '300px',
          zIndex: 3,
          opacity: 0.15,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          overflow: 'hidden'
        }}
      >
        <div style={{ width: '400px', height: '600px', position: 'relative', top: '0' }}>
          <Image 
            src="/chalk_illustrations.png" 
            alt="" 
            width={400}
            height={400}
            style={{ objectPosition: 'center top' }} // Extracting the steam
          />
        </div>
      </motion.div>

      {/* Floating Star Anise (Bottom Right) */}
      <motion.div
        animate={{ 
          y: [0, 20, 0],
          rotate: [0, 360]
        }}
        transition={{ 
          y: { duration: 15, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 100, repeat: Infinity, ease: "linear" }
        }}
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '15%',
          width: '150px',
          height: '150px',
          zIndex: 3,
          opacity: 0.2,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          overflow: 'hidden'
        }}
      >
        <div style={{ width: '150px', height: '150px', position: 'relative' }}>
          <Image 
            src="/chalk_illustrations.png" 
            alt="" 
            fill
            style={{ objectPosition: '0% 50%', objectFit: 'cover', transform: 'scale(3)' }} // Isolating Star Anise
          />
        </div>
      </motion.div>

      {/* Floating Cinnamon (Top Right) */}
      <motion.div
        animate={{ 
          x: [0, -15, 0],
          y: [0, 10, 0],
          rotate: [15, 20, 15]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '20%',
          right: '25%',
          width: '180px',
          height: '180px',
          zIndex: 3,
          opacity: 0.15,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          overflow: 'hidden'
        }}
      >
        <div style={{ width: '180px', height: '180px', position: 'relative' }}>
          <Image 
            src="/chalk_illustrations.png" 
            alt="" 
            fill
            style={{ objectPosition: '50% 75%', objectFit: 'cover', transform: 'scale(2.5)' }} // Isolating Cinnamon
          />
        </div>
      </motion.div>

      {/* Floating Herbs (Bottom Left) */}
      <motion.div
        animate={{ 
          y: [0, -25, 0],
          rotate: [-5, 5, -5]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '20%',
          width: '220px',
          height: '250px',
          zIndex: 3,
          opacity: 0.2,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          overflow: 'hidden'
        }}
      >
        <div style={{ width: '220px', height: '250px', position: 'relative' }}>
          <Image 
            src="/chalk_illustrations.png" 
            alt="" 
            fill
            style={{ objectPosition: '85% 60%', objectFit: 'cover', transform: 'scale(2.2)' }} // Isolating Herbs
          />
        </div>
      </motion.div>

      {/* Rotating Background Asset (Fish Curry - LEFT CENTER) */}
      <motion.div
        initial={{ y: '-50%', rotate: 0 }}
        animate={{ rotate: -360 }} // Counter-clockwise for variety
        transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '-250px', // Half-clipped from left
          width: '500px',
          height: '500px',
          zIndex: 4,
          opacity: 0.5,
          pointerEvents: 'none',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(0,0,0,0.8)'
        }}
      >
        <Image 
          src="/fish_curry_generated.png" 
          alt="" 
          width={500}
          height={500}
          style={{ objectFit: 'cover' }}
        />
      </motion.div>

      {/* Main REFINED Card */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 60, opacity: 1 }} // Lowered for better optical center
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '440px',
          padding: '36px 40px', // Reduced padding
          background: '#0D0D0F',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          textAlign: 'center',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          maxHeight: '85vh',
          overflowY: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {/* Red Top-Center Glow (Animated) */}
        <motion.div 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #E21F27 50%, transparent)',
            zIndex: 20
          }} 
        />
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '60px', // More vertical spread
            background: 'radial-gradient(circle at top, rgba(226,31,39,0.4) 0%, transparent 70%)', // Increased opacity
            filter: 'blur(40px)', // Increased blur for spotlight effect
            zIndex: 15
          }} 
        />

        {/* Vertical Wave 'Shining' Grid */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', padding: 'inherit', borderRadius: 'inherit' }}>
          {/* Base Gray Grid */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '10px 10px',
            pointerEvents: 'none',
            zIndex: 1,
            maskImage: 'radial-gradient(circle at center, black, transparent 95%)'
          }} />
          
          {/* Animated White Shine Grid (Wave) */}
          <motion.div 
            animate={{ 
              maskPosition: ['0% -100%', '0% 200%'],
              WebkitMaskPosition: ['0% -100%', '0% 200%']
            }}
            transition={{ 
              duration: 7, // Slowed down
              repeat: Infinity, 
              ease: "linear",
              repeatDelay: 2 // Added interval
            }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
              `,
              backgroundSize: '10px 10px',
              pointerEvents: 'none',
              zIndex: 2,
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black, transparent)',
              maskImage: 'linear-gradient(to bottom, transparent, black, transparent)',
              WebkitMaskSize: '100% 150px',
              maskSize: '100% 150px',
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
            marginBottom: '12px', // Reduced from 32px
            zIndex: 10,
            background: 'transparent', // Explicitly transparent
            borderRadius: '50%',
            flexShrink: 0
          }}
        >
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={85} // Larger image 
            height={85} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </motion.div>

        {/* Header Section */}
        <div style={{ marginBottom: '32px', zIndex: 10 }}>
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
            <span style={{ color: '#E21F27' }}>Vidya&apos;s Kitchen</span>
          </h2>
        </div>

        {/* Floating QR Section with Glass Effect */}
        <div style={{
          position: 'relative',
          width: '180px',
          height: '180px',
          marginBottom: '28px',
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
              background: 'linear-gradient(90deg, transparent 0%, #E21F27 50%, transparent 100%)',
              boxShadow: '0 0 30px rgba(226,31,39,1)', // More intense spread
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
            whileTap={{ scale: 0.98 }}
            animate={{
              backgroundColor: isHovered ? '#25D366' : '#FFFFFF',
              color: isHovered ? '#FFFFFF' : '#000000',
              scale: isHovered ? 1.02 : 1
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
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
            <WhatsappLogo size={24} weight="fill" color={isHovered ? "#FFFFFF" : "#25D366"} />
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
        paddingBottom: '60px', // Added bottom padding for symmetry
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
        zIndex: 60
      }}>
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
      </div>
    </div>
  );
}
