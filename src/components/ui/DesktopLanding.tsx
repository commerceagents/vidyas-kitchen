"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

function NeuralBackground() {
  const points = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5
    }));
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {points.map((point) => (
        <motion.div
          key={point.id}
          initial={{ opacity: 0.1, x: `${point.x}%`, y: `${point.y}%` }}
          animate={{
            opacity: [0.1, 0.4, 0.1],
            y: [`${point.y}%`, `${point.y - 5}%`, `${point.y}%`],
          }}
          transition={{
            duration: point.duration,
            repeat: Infinity,
            delay: point.delay,
            ease: "easeInOut"
          }}
          style={{
            position: 'absolute',
            width: point.size,
            height: point.size,
            backgroundColor: '#E21F27',
            borderRadius: '50%',
            boxShadow: '0 0 10px rgba(226,31,39,0.5)',
          }}
        />
      ))}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 0%, rgba(2,2,2,0.8) 100%)',
        zIndex: 1
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
      {/* AI Neural Phase Background */}
      <NeuralBackground />

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
          boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(226,31,39,0.05)',
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
            marginBottom: '12px' // Increased gap below HEY BUDDY
          }}>
            HEY BUDDY,
          </span>
          <h2 style={{
            fontSize: '30px',
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: '1.4' // Increased line height
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
            background: 'rgba(255, 255, 255, 0.08)', // Glass effect
            backdropFilter: 'blur(12px)',
            padding: '16px',
            borderRadius: '5px', // Subtle corners
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
              fgColor="#FFFFFF" // White for glass contrast
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

      {/* Subtle Footer Branding */}
      <div style={{ 
        marginTop: '20px', 
        fontSize: '11px', 
        color: 'rgba(255,255,255,0.2)',
        letterSpacing: '1px',
        fontWeight: '600',
        zIndex: 60
      }}>
        POWERED BY VIDYA&apos;S KITCHEN
      </div>
    </div>
  );
}
