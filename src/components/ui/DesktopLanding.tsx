"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo, Scan } from "@phosphor-icons/react";

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
            background: 'radial-gradient(circle, rgba(226,31,39,0.15) 0%, transparent 70%)',
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
            background: 'radial-gradient(circle, rgba(160,20,30,0.12) 0%, transparent 70%)',
            filter: 'blur(130px)',
          }}
        />
        {/* Blob 3 */}
        <motion.div
          animate={{
            x: [0, 60, -120, 0],
            y: [0, 100, 60, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            top: '35%',
            left: '35%',
            width: '550px',
            height: '550px',
            background: 'radial-gradient(circle, rgba(226,31,39,0.1) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Main Untitled UI Style Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '480px',
          padding: '40px',
          background: '#101828', // Solid Untitled UI dark background
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 24px 48px -12px rgba(16, 24, 40, 0.5)',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        {/* Top Scan Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          backgroundColor: '#1D2939',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <Scan size={32} weight="bold" color="#FFFFFF" />
        </div>

        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '30px',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '8px',
            letterSpacing: '-0.02em'
          }}>
            Welcome to Vidya&apos;s Kitchen
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#98A2B3',
            lineHeight: '24px'
          }}>
            Open your mobile camera and choose <span style={{ color: '#FFFFFF', fontWeight: '600' }}>scan barcode</span>.
          </p>
        </div>

        {/* QR Section with Scanning Line */}
        <div style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          background: '#1D2939',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.05)',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {/* Subtle Grid Backdrop */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '14px 14px',
          }} />

          {/* THE SCANNING LINE */}
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
              left: 0,
              width: '100%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent 0%, #E21F27 50%, transparent 100%)',
              boxShadow: '0 0 15px #E21F27',
              zIndex: 30,
              pointerEvents: 'none'
            }}
          />

          <div style={{
            background: '#ffffff',
            padding: '16px',
            borderRadius: '12px',
            zIndex: 20,
            boxShadow: '0 0 20px rgba(0,0,0,0.3)'
          }}>
            <QRCode 
              value={domain}
              size={180}
              fgColor="#101828"
              level="H"
            />
          </div>
        </div>

        {/* Primary CTA (White Button like current design) */}
        <a 
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            background: '#FFFFFF',
            color: '#101828',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '16px',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            width: '100%',
            justifyContent: 'center',
            marginBottom: '24px',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 12px 16px -4px rgba(16, 24, 40, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(16, 24, 40, 0.05)';
          }}
        >
          <WhatsappLogo size={24} weight="fill" color="#25D366" />
          Chat with Vidya Bot
        </a>

        {/* Manual Code Section */}
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '12px', color: '#667085', fontWeight: '500' }}>OR visit website directly</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <div style={{
            background: '#1D2939',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '14px', color: '#F2F4F7', fontWeight: '500', opacity: 0.8 }}>
              {domain.replace('https://', '')}
            </span>
            <button 
              onClick={() => navigator.clipboard.writeText(domain)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#98A2B3',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Copy
            </button>
          </div>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <div style={{ 
        marginTop: '24px', 
        fontSize: '12px', 
        color: '#667085',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 60
      }}>
        <Image src="/VK_Logo.png" alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
        Powered by Vidya&apos;s Kitchen
      </div>
    </div>
  );
}
