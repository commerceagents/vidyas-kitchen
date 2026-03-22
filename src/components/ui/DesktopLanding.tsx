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
      {/* Liquid Molten Obsidian Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {/* Blob 1 */}
        <motion.div
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -80, 120, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            top: '10%',
            left: '20%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(226,31,39,0.12) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Blob 2 */}
        <motion.div
          animate={{
            x: [0, -120, 80, 0],
            y: [0, 150, -100, 0],
            scale: [1.1, 0.9, 1.3, 1.1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '15%',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(160,20,30,0.1) 0%, transparent 70%)',
            filter: 'blur(120px)',
          }}
        />
        {/* Blob 3 */}
        <motion.div
          animate={{
            x: [0, 80, -150, 0],
            y: [0, 120, 80, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            top: '40%',
            left: '40%',
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(226,31,39,0.08) 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
        {/* Blob 4 */}
        <motion.div
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(226,31,39,0.04) 0%, transparent 60%)',
            filter: 'blur(60px)'
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
          border: '0.5px solid rgba(255, 255, 255, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
          maxHeight: '85vh',
          overflow: 'hidden'
        }}
      >
        {/* Shining Futuristic Effect Overlay */}
        <motion.div
          animate={{
            x: ['-200%', '200%'],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '50%',
            height: '100%',
            background: 'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 55%, transparent 100%)',
            transform: 'skewX(-20deg)',
            zIndex: 5,
            pointerEvents: 'none'
          }}
        />

        {/* Smaller Glowing Grid */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.15,
          backgroundImage: `
            linear-gradient(rgba(226,31,39,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(226,31,39,0.4) 1px, transparent 1px)
          `,
          backgroundSize: '12px 12px',
          pointerEvents: 'none',
          zIndex: -1,
          filter: 'drop-shadow(0 0 1px rgba(226,31,39,0.3))'
        }} />

        {/* Larger Logo Container */}
        <div style={{
          width: '72px',
          height: '72px',
          backgroundColor: 'white',
          borderRadius: '50%',
          padding: '4px',
          marginBottom: '24px',
          boxShadow: '0 0 20px rgba(226,31,39,0.4)',
          zIndex: 10
        }}>
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={64} 
            height={64} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <span style={{ 
            fontSize: '10px', 
            letterSpacing: '3px', 
            color: 'rgba(255,255,255,0.4)', 
            fontWeight: '800',
            display: 'block',
            marginBottom: '4px'
          }}>
            HEY BUDDY,
          </span>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '900',
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: '1.2'
          }}>
            Welcome to <br />
            <span style={{ color: '#E21F27' }}>Vidya&apos;s Kitchen</span>
          </h1>
        </div>

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

          {/* QR Card Background with Inner Micro-Grid */}
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
              opacity: 0.25,
              backgroundImage: `
                linear-gradient(rgba(226,31,39,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(226,31,39,0.5) 1px, transparent 1px)
              `,
              backgroundSize: '6px 6px',
              filter: 'drop-shadow(0 0 1px rgba(226,31,39,0.4))'
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
