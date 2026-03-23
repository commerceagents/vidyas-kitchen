"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

function SatinFluidBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#020202', zIndex: 0 }}>
      {/* Wave 1 - Deep Red Satin */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 180, 270, 360],
          x: ['-20%', '10%', '-20%'],
          y: ['-10%', '20%', '-10%'],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-20%',
          width: '120%',
          height: '120%',
          background: 'radial-gradient(ellipse at center, rgba(226,31,39,0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
          borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
        }}
      />
      {/* Wave 2 - Royal Blue Depths */}
      <motion.div
        animate={{
          scale: [1.1, 1, 1.1],
          rotate: [360, 270, 180, 90, 0],
          x: ['20%', '-10%', '20%'],
          y: ['20%', '-10%', '20%'],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-20%',
          width: '120%',
          height: '120%',
          background: 'radial-gradient(ellipse at center, rgba(30,58,138,0.12) 0%, transparent 70%)',
          filter: 'blur(100px)',
          borderRadius: '50% 50% 50% 50% / 50% 50% 50% 50%',
        }}
      />
      {/* Wave 3 - Satin Sheen / Highlight */}
      <motion.div
        animate={{
          opacity: [0.2, 0.4, 0.2],
          x: ['-50%', '50%', '-50%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '20%',
          left: '0',
          width: '200%',
          height: '60%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
          transform: 'rotate(-45deg)',
          filter: 'blur(40px)',
          zIndex: 2
        }}
      />
      {/* Grain/Texture Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        zIndex: 3
      }} />
    </div>
  );
}

export function DesktopLanding() {
  const domain = "https://vidyaskitchenhome.com";
  const whatsappNumber = "+91 75500 28179";

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
      {/* Satin Liquid Flow Background */}
      <SatinFluidBackground />

      {/* Main REFINED Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '460px',
          padding: '40px',
          background: '#0D0D0F',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 0 100px rgba(0,0,0,0.9), 0 0 50px rgba(226,31,39,0.03)',
          maxHeight: '92vh',
          overflowY: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {/* Top Brand Logo */}
        <div style={{
          width: '100px',
          height: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '28px',
          zIndex: 10
        }}>
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={100} 
            height={100} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </div>

        {/* Header Section */}
        <div style={{ marginBottom: '28px' }}>
          <span style={{ 
            fontSize: '11px', 
            letterSpacing: '4px', 
            color: 'rgba(255,255,255,0.4)', 
            fontWeight: '700',
            display: 'block',
            marginBottom: '12px'
          }}>
            HEY BUDDY,
          </span>
          <h2 style={{
            fontSize: '30px',
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: '1.4'
          }}>
            Welcome to <br />
            <span style={{ color: '#E21F27' }}>Vidya&apos;s Kitchen</span>
          </h2>
        </div>

        {/* Floating QR Section with Glass Effect */}
        <div style={{
          position: 'relative',
          width: '220px',
          height: '220px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* THE SCANNING LINE FLARE */}
          <motion.div
            animate={{
              top: ['0%', '100%', '0%']
            }}
            transition={{
              duration: 2.5,
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
              height: '2px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(226,31,39,0.8) 20%, #E21F27 50%, rgba(226,31,39,0.8) 80%, transparent 100%)',
              boxShadow: '0 0 20px 2px rgba(226,31,39,0.5)',
            }} />
          </motion.div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            padding: '16px',
            borderRadius: '5px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 20,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <QRCode 
              value={domain}
              size={140}
              fgColor="#FFFFFF"
              bgColor="transparent"
              level="H"
            />
          </div>
        </div>

        {/* Funny Caption */}
        <p style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: '1.5',
          marginBottom: '32px',
          maxWidth: '300px',
          fontWeight: '500',
          fontStyle: 'italic'
        }}>
          &ldquo;Your phone is currently starving for a better view. Scan me to give it a digital feast!&rdquo;
        </p>

        {/* Primary CTA (White Button) */}
        <a 
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 24px',
            background: '#FFFFFF',
            color: '#101828',
            borderRadius: '16px',
            fontWeight: '800',
            fontSize: '16px',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            width: '100%',
            justifyContent: 'center',
            boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.background = '#F9FAFB';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          <WhatsappLogo size={24} weight="fill" color="#25D366" />
          Chat with Vidya Bot
        </a>
      </motion.div>

      {/* Subtle Footer Branding & Legal Links */}
      <div style={{ 
        marginTop: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        zIndex: 60
      }}>
        <div style={{
          display: 'flex',
          gap: '20px',
          opacity: 0.4
        }}>
          {['Terms', 'Privacy', 'Refund Policy', 'Contact'].map((item) => (
            <a
              key={item}
              href={`/${item.toLowerCase().replace(' ', '-')}`}
              style={{
                fontSize: '10px',
                color: 'white',
                textDecoration: 'none',
                letterSpacing: '1px',
                fontWeight: '600',
                transition: 'opacity 0.2s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '0.5')}
            >
              {item.toUpperCase()}
            </a>
          ))}
        </div>
        
        <div style={{ 
          fontSize: '9px', 
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '2px',
          fontWeight: '700'
        }}>
          POWERED BY VIDYA&apos;S KITCHEN
        </div>
      </div>
    </div>
  );
}
