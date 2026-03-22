"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

export function DesktopLanding() {
  const domain = "https://vidyaskitchenhome.com";
  const whatsappNumber = "+91 75500 28179";

  // Handle mobile detection within the component as a safety layer
  const [isLargeScreen, setIsLargeScreen] = useState(false);

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
      backgroundColor: '#020202',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      color: 'white',
      fontFamily: 'inherit'
    }}>
      {/* SVG Liquid Filter Definition */}
      <svg style={{ position: 'fixed', top: -100, left: -100, width: 0, height: 0 }}>
        <filter id="molten-bg">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="1" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="50" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* Liquid Molten Backdrop */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            inset: '-10%',
            filter: 'url(#molten-bg) blur(30px)',
            background: 'radial-gradient(circle at 30% 30%, rgba(226,31,39,0.18) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(226,31,39,0.12) 0%, transparent 50%)',
          }}
        />
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)' 
        }} />
      </div>

      {/* Main Glass Content */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '380px',
          padding: '40px 32px 32px',
          background: 'rgba(255, 255, 255, 0.01)',
          backdropFilter: 'blur(30px)',
          borderRadius: '40px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
          maxHeight: '90vh'
        }}
      >
        <div style={{
          width: '60px',
          height: '60px',
          backgroundColor: 'white',
          borderRadius: '50%',
          padding: '4px',
          marginBottom: '24px',
          boxShadow: '0 0 20px rgba(226,31,39,0.4)',
        }}>
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={52} 
            height={52} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: '900',
          marginBottom: '16px',
          color: '#ffffff',
          letterSpacing: '-0.02em',
          lineHeight: '1.1'
        }}>
          Welcome to <br />
          <span style={{ color: '#E21F27' }}>Vidya&apos;s Kitchen</span>
        </h1>

        {/* REPLICA QR SECTION */}
        <div style={{
          position: 'relative',
          width: '260px',
          height: '260px',
          background: 'rgba(226,31,39,0.02)',
          borderRadius: '32px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {/* Glowing Top Light */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '60px',
            background: 'radial-gradient(circle, rgba(226,31,39,0.6) 0%, transparent 70%)',
            filter: 'blur(15px)',
            zIndex: 10
          }} />

          {/* Grid Pattern Backdrop */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.15,
            backgroundImage: `
              linear-gradient(rgba(226,31,39,0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(226,31,39,0.4) 1px, transparent 1px)
            `,
            backgroundSize: '16px 16px',
            backgroundPosition: 'center'
          }} />

          {/* Pulsating Dotted Wave Border */}
          <motion.div 
            animate={{ 
              opacity: [0.3, 0.7, 0.3],
              scale: [0.98, 1.02, 0.98]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: 'absolute',
              inset: '20px',
              borderRadius: '24px',
              border: '2px dotted rgba(226,31,39,0.4)',
              boxShadow: '0 0 20px rgba(226,31,39,0.1) inset'
            }} 
          />

          <div style={{
            background: '#ffffff',
            padding: '12px',
            borderRadius: '16px',
            boxShadow: '0 0 30px rgba(226,31,39,0.2)',
            zIndex: 20
          }}>
            <QRCode 
              value={domain}
              size={160}
              fgColor="#E21F27"
              level="H"
            />
          </div>
        </div>

        <p style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.7)',
          lineHeight: '1.6',
          marginBottom: '28px',
          maxWidth: '280px',
          fontWeight: '500'
        }}>
          Scan the QR Code to experience our delicious home-cooked meals!
        </p>

        {/* Premium Action Button */}
        <a 
          href={`https://wa.me/917550028179`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 32px',
            background: 'linear-gradient(135deg, #E21F27 0%, #b3141b 100%)',
            color: '#fff',
            borderRadius: '16px',
            fontWeight: '800',
            fontSize: '15px',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            width: '100%',
            justifyContent: 'center',
            boxShadow: '0 10px 20px rgba(226,31,39,0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 15px 30px rgba(226,31,39,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 20px rgba(226,31,39,0.3)';
          }}
        >
          <WhatsappLogo size={22} weight="fill" />
          Order via WhatsApp
        </a>
      </motion.div>
    </div>
  );
}
