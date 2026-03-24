"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

import { Phone } from "@phosphor-icons/react";

function AmbientBreathingBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000', zIndex: 0 }}>
      {/* Centered Breathing Ambient Glow */}
      <motion.div
        animate={{
          opacity: [0.35, 0.65, 0.35],
          scale: [1, 1.08, 1],
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '120vw',
          height: '120vh',
          background: 'radial-gradient(circle at center, rgba(226,31,39,0.07) 0%, transparent 70%)',
          filter: 'blur(100px)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

const ChefSpecialVector = () => (
  <motion.svg 
    width="191" 
    height="123" 
    viewBox="0 0 191 123" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ opacity: 0.7, mixBlendMode: 'screen' }}
  >
    {/* Arrow Path */}
    <motion.path
      d="M2.96177 113.691C35.0357 115.69 119.349 117.808 69.3486 42.8082C53.774 19.4475 22.8486 16.3082 17.3486 42.8082C10.6033 75.3083 49.2081 100.285 64.3486 100.808C94.8486 101.863 103.849 54.3082 78.3486 9.30823M2.96177 113.691L11.8596 120.35M2.96177 113.691L11.3323 105.132"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 2.5, ease: "easeInOut" }}
    />
    
    {/* Text Paths Staggered */}
    {[
      "M112.551 29.3567C109.831 29.3423 107.575 30.6978 106.182 32.8804C104.79 35.063 104.381 37.892 105.024 40.8906C105.667 43.8893 107.31 46.8143 109.679 49.191C112.047 51.5676 114.951 53.2013 117.915 53.6923",
      "M129.231 35.5398L121.782 50.1504M126.96 46.1667L134.257 32.0963M126.331 43.3762L121.328 39.5222",
      "M140.236 39.8093L144.17 38.634L148.972 32.7482M140.236 39.8093L135.434 45.6951M140.236 39.8093L135.553 43.6845M140.236 39.8093L144.919 35.934",
      "M149.882 43.1884L155.656 32.3339M149.882 43.1884L153.284 49.3322M152.09 39.0181L156.402 37.0722",
      "M156.963 18.3975L154.557 24.3188",
      "M158.336 46.1245C160.038 43.5113 162.721 41.7423 165.419 41.3853C168.118 41.0282 170.612 42.1127 172.012 44.2255C173.411 46.3382 173.597 49.3009 172.502 52.0524C171.407 54.8038 169.125 57.1183 166.427 58.1408",
      "M174.453 51.5273C176.155 48.9141 178.838 47.1451 181.536 46.7881C184.234 46.431 186.729 47.5155 188.128 49.6283C189.528 51.7411 189.713 54.7037 188.618 57.4552C187.523 60.2066 185.241 62.5211 182.544 63.5435",
      "M184.453 54.5273C185.966 52.3486 188.461 51.1094 191.042 51.2526",
      "M149.431 83.1537L153.365 81.9785L158.167 76.0927M149.431 83.1537L144.629 89.0396"
    ].map((d, i) => (
      <motion.path
        key={i}
        d={d}
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 + (i * 0.1), duration: 0.5 }}
      />
    ))}
  </motion.svg>
);

const HomemadeSpicesVector = () => (
  <motion.svg 
    width="184" 
    height="142" 
    viewBox="0 0 184 142" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ opacity: 0.7, mixBlendMode: 'screen' }}
  >
    {/* Floating Bubbles */}
    {[
      { cx: 15.8208, cy: 11.4583, r: 5.62083 },
      { cx: 21.166, cy: 27.4219, r: 6.73229 },
      { cx: 33.7297, cy: 40.3533, r: 5.12708 },
      { cx: 49.9192, cy: 73.085, r: 5.12708 }
    ].map((circle, i) => (
      <motion.circle
        key={i}
        {...circle}
        stroke="white"
        strokeWidth="1"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: i * 0.2, duration: 0.8, type: "spring" }}
      />
    ))}

    {/* Text Paths Staggered */}
    {[
      "M96.062 25.1257L88.9416 39.5312M94.6288 35.8453L101.597 22.0195M92.1748 33.4005L87.218 29.5036",
      "M115.421 27.6015C114.398 25.0416 112.441 23.1611 110.155 22.5694C107.869 21.9777 105.467 22.7317 103.717 24.5828C101.966 26.434 101.031 29.1969 101.218 31.9701C101.405 34.7434 102.694 37.242 104.673 38.6575",
      "M135.253 29.8978C134.113 27.3821 132.062 25.5683 129.742 25.0441C127.421 24.5199 125.068 25.3409 123.411 27.2424"
    ].map((d, i) => (
      <motion.path
        key={i}
        d={d}
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 + (i * 0.1), duration: 0.6 }}
      />
    ))}
  </motion.svg>
);

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
      {/* Ambient Breathing Background */}
      <AmbientBreathingBackground />

      {/* Rotating Background Asset (Chicken Curry - RIGHT CENTER) */}
      <div style={{ position: 'absolute', top: '50%', right: '-250px', width: '500px', height: '500px', transform: 'translateY(-50%)', zIndex: 4 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          style={{
            width: '100%',
            height: '100%',
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

        {/* Artisanal Animation: Homemade Spices */}
        <motion.div
          animate={{ 
            y: [0, -10, 0],
            rotate: [-2, 2, -2],
            opacity: [0.5, 0.7, 0.5]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '80px',
            right: '480px',
            width: '184px',
            height: '142px',
            zIndex: 3,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <HomemadeSpicesVector />
        </motion.div>
      </div>

      {/* Rotating Background Asset (Fish Curry - LEFT CENTER) */}
      <div style={{ position: 'absolute', top: '50%', left: '-250px', width: '500px', height: '500px', transform: 'translateY(-50%)', zIndex: 4 }}>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
          style={{
            width: '100%',
            height: '100%',
            opacity: 0.5,
            pointerEvents: 'none',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 0 50px rgba(0,0,0,0.8)'
          }}
        >
          <Image 
            src="/fish_curry_generated.png" 
            alt="Fish Curry" 
            width={500}
            height={500}
            style={{ objectFit: 'cover' }}
          />
        </motion.div>

        {/* Artisanal Animation: Chef's Special */}
        <motion.div
          animate={{ 
            x: [0, 8, 0],
            rotate: [2, -2, 2],
            opacity: [0.5, 0.7, 0.5]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '60px',
            left: '480px',
            width: '191px',
            height: '123px',
            zIndex: 3,
            pointerEvents: 'none'
          }}
        >
          <ChefSpecialVector />
        </motion.div>
      </div>

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
              maskPosition: ['0% -100%', '0% 200%']
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
            } as any}
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
