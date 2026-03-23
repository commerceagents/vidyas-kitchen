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

      {/* Main REFINED Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '520px', 
          padding: '40px', 
          background: '#0D0D0F',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          maxHeight: '85vh',
          overflowY: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {/* Animated Grid Overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.05, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            pointerEvents: 'none',
            zIndex: 1,
            maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
          }}
        />

        {/* Top Brand Logo */}
        <motion.div 
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          style={{
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            zIndex: 10,
            background: 'black',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={60} 
            height={60} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </motion.div>

        {/* Header Section */}
        <div style={{ marginBottom: '28px', zIndex: 10 }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: '-0.04em',
            lineHeight: '1.2',
            textTransform: 'uppercase'
          }}>
            Welcome to <br />
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
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, #E21F27 50%, transparent 100%)',
              boxShadow: '0 0 15px rgba(226,31,39,0.8)',
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

        {/* Action Buttons Row */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          width: '100%',
          marginTop: 'auto',
          zIndex: 10
        }}>
          {/* WhatsApp Button (White) */}
          <a 
            href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '16px',
              background: '#FFFFFF',
              color: '#000000',
              borderRadius: '12px',
              fontWeight: '900',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <WhatsappLogo size={20} weight="fill" color="#25D366" />
            WA Bot
          </a>

          {/* Contact Us Button (Primary Red) */}
          <a 
            href="tel:+917550028179"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '16px',
              background: '#E21F27',
              color: '#FFFFFF',
              borderRadius: '12px',
              fontWeight: '900',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Phone size={20} weight="fill" />
            Contact
          </a>
        </div>
      </motion.div>

      {/* Subtle Footer */}
      <div style={{ 
        marginTop: '80px',
        paddingBottom: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
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
          textTransform: 'uppercase'
        }}>
          © 2026 VIDYA&apos;S KITCHEN. ALL RIGHTS RESERVED.
        </div>
      </div>
    </div>
  );
}
