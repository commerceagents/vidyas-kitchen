"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

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
      {/* Active Liquid Molten Obsidian Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {/* Blob 1 */}
        <motion.div
           animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 100, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            top: '5%',
            left: '15%',
            width: '700px',
            height: '700px',
            background: 'radial-gradient(circle, rgba(226,31,39,0.12) 0%, transparent 70%)',
            filter: 'blur(110px)',
          }}
        />
        {/* Blob 2 */}
        <motion.div
          animate={{
            x: [0, -100, 60, 0],
            y: [0, 120, -80, 0],
            scale: [1.05, 0.95, 1.2, 1.05],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '10%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(160,20,30,0.1) 0%, transparent 70%)',
            filter: 'blur(130px)',
          }}
        />
      </div>

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
          background: '#0D0D0F', // Slightly off-black for visibility
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(226,31,39,0.05)', // Glow separation
          maxHeight: '92vh',
          overflowY: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {/* Top Brand Logo - Large & No Border */}
        <div style={{
          width: '100px',
          height: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
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
        <div style={{ marginBottom: '24px' }}>
          <span style={{ 
            fontSize: '11px', 
            letterSpacing: '4px', 
            color: 'rgba(255,255,255,0.4)', 
            fontWeight: '700',
            display: 'block',
            marginBottom: '4px'
          }}>
            HEY BUDDY,
          </span>
          <h2 style={{
            fontSize: '30px',
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: '1.2'
          }}>
            Welcome to <br />
            <span style={{ color: '#E21F27' }}>Vidya&apos;s Kitchen</span>
          </h2>
        </div>

        {/* Floating QR Section with HIGH FLARE Scanning Line */}
        <div style={{
          position: 'relative',
          width: '240px',
          height: '240px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* THE SCANNING LINE FLARE SYSTEM */}
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
            background: '#ffffff',
            padding: '12px',
            borderRadius: '40px', // iOS Squircle style
            zIndex: 20,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            <QRCode 
              value={domain}
              size={150}
              fgColor="#101828"
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
