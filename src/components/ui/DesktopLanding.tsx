"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

import { Phone } from "@phosphor-icons/react";

function GlowingBlobsBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#020202', zIndex: 0 }}>
      {/* Blob 1 - Red Glow */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          x: ['-10%', '10%', '-10%'],
          y: ['-10%', '10%', '-10%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '20%',
          left: '20%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(226,31,39,0.1) 0%, transparent 70%)',
          filter: 'blur(80px)',
          borderRadius: '50%',
        }}
      />
      {/* Blob 2 - Dark Deep Blue Glow */}
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          x: ['10%', '-10%', '10%'],
          y: ['10%', '-10%', '10%'],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(30,58,138,0.08) 0%, transparent 70%)',
          filter: 'blur(100px)',
          borderRadius: '50%',
        }}
      />
      {/* Texture Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.15, // Subtle glow
        pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 80%)',
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
          width: '500px', // Wider card
          padding: '32px 40px', // Slightly reduced vertical padding
          background: '#0D0D0F',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 0 100px rgba(0,0,0,0.9)',
          maxHeight: '88vh', // Reduced height
          overflowY: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {/* Top Brand Logo */}
        <div style={{
          width: '80px', // Slightly smaller logo
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          zIndex: 10
        }}>
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={80} 
            height={80} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </div>

        {/* Header Section */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: '1.3'
          }}>
            Welcome to <br />
            <span style={{ color: '#E21F27' }}>Vidya&apos;s Kitchen</span>
          </h2>
        </div>

        {/* Floating QR Section with Glass Effect */}
        <div style={{
          position: 'relative',
          width: '200px', // Adjusted size
          height: '200px',
          marginBottom: '24px',
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
              boxShadow: '0 0 15px 1px rgba(226,31,39,0.4)',
            }} />
          </motion.div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            padding: '12px',
            borderRadius: '12px',
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
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          lineHeight: '1.5',
          marginBottom: '28px',
          maxWidth: '300px',
          fontWeight: '500',
          fontStyle: 'italic'
        }}>
          &ldquo;Your phone is currently starving for a better view. Scan me to give it a digital feast!&rdquo;
        </p>

        {/* Action Buttons Row */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          width: '100%',
          marginTop: 'auto' 
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
              gap: '10px',
              padding: '14px',
              background: '#FFFFFF',
              color: '#101828',
              borderRadius: '16px',
              fontWeight: '800',
              fontSize: '15px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
            }}
          >
            <WhatsappLogo size={22} weight="fill" color="#25D366" />
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
              gap: '10px',
              padding: '14px',
              background: '#E21F27',
              color: '#FFFFFF',
              borderRadius: '16px',
              fontWeight: '800',
              fontSize: '15px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 20px rgba(226,31,39,0.2)'
            }}
          >
            <Phone size={22} weight="fill" />
            Contact
          </a>
        </div>
      </motion.div>

      {/* Subtle Footer Branding & Legal Links */}
      <div style={{ 
        marginTop: '32px',
        paddingBottom: '32px', // Added padding
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
          {['Terms', 'Privacy', 'Refund Policy'].map((item) => (
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
