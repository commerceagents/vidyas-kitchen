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
      {/* Abstract Red Background (Inspired by Blue Reference) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 20% 20%, rgba(226,31,39,0.15) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(226,31,39,0.1) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(226,31,39,0.05) 0%, transparent 60%)',
          filter: 'blur(60px)'
        }} />
        <motion.div
          animate={{
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-10%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(226,31,39,0.08) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Main Glass Content */}
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '400px',
          padding: '48px 32px 32px',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(40px)',
          borderRadius: '40px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
          maxHeight: '85vh',
          overflow: 'hidden'
        }}
      >
        {/* Full Card Grid Layout */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.1,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
          zIndex: -1
        }} />

        <div style={{
          width: '56px',
          height: '56px',
          backgroundColor: 'white',
          borderRadius: '50%',
          padding: '3px',
          marginBottom: '20px',
          boxShadow: '0 0 15px rgba(226,31,39,0.3)',
        }}>
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={50} 
            height={50} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: '900',
          marginBottom: '12px',
          color: '#ffffff',
          letterSpacing: '-0.02em',
          lineHeight: '1.2'
        }}>
          Welcome to <br />
          <span style={{ color: '#E21F27' }}>Vidya&apos;s Kitchen</span>
        </h1>

        {/* REPLICA QR SECTION */}
        <div style={{
          position: 'relative',
          width: '240px',
          height: '240px',
          borderRadius: '32px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Glowing Top-Light Effect */}
          <div style={{
            position: 'absolute',
            top: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '140px',
            height: '80px',
            background: 'radial-gradient(circle, rgba(226,31,39,0.4) 0%, transparent 70%)',
            filter: 'blur(20px)',
            zIndex: 10
          }} />

          {/* Precision Dotted Halo (Wave Animation) */}
          <motion.div 
            animate={{ 
              opacity: [0.2, 0.6, 0.2],
              scale: [0.95, 1.05, 0.95]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: 'absolute',
              inset: '-10px',
              borderRadius: '40px',
              padding: '2px',
              // Using radial-gradient to create crisp dots
              backgroundImage: 'radial-gradient(circle, rgba(226,31,39,0.4) 1px, transparent 1px)',
              backgroundSize: '8px 8px',
              opacity: 0.5,
              zIndex: 5
            }} 
          />

          {/* QR Card Background with Inner Grid */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '24px',
            border: '1px solid rgba(226,31,39,0.2)',
            boxShadow: '0 0 40px rgba(0,0,0,0.4) inset',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
             <div style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.2,
              backgroundImage: `
                linear-gradient(rgba(226,31,39,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(226,31,39,0.3) 1px, transparent 1px)
              `,
              backgroundSize: '12px 12px'
            }} />
            
            <div style={{
              background: '#ffffff',
              padding: '10px',
              borderRadius: '12px',
              boxShadow: '0 0 30px rgba(226,31,39,0.15)',
              zIndex: 20
            }}>
              <QRCode 
                value={domain}
                size={140}
                fgColor="#E21F27"
                level="H"
              />
            </div>
          </div>
        </div>

        <p style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: '1.5',
          marginBottom: '32px',
          maxWidth: '260px',
          fontWeight: '500'
        }}>
          Scan the QR code for a beautiful experience on your mobile phone.
        </p>

        {/* White CTA Button with WhatsApp Logo */}
        <a 
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 32px',
            background: '#ffffff',
            color: '#000000',
            borderRadius: '16px',
            fontWeight: '800',
            fontSize: '15px',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            width: '100%',
            justifyContent: 'center',
            boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.background = '#f8f8f8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = '#ffffff';
          }}
        >
          <WhatsappLogo size={22} weight="fill" color="#25D366" />
          Chat with Vidya Bot
        </a>
      </motion.div>
    </div>
  );
}
