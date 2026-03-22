"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { WhatsappLogo } from "@phosphor-icons/react";

export function DesktopLanding() {
  const domain = "https://vidyaskitchenhome.com";
  const whatsappNumber = "+91 95122 19780";

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      backgroundColor: '#050505',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      color: 'white',
      fontFamily: 'inherit'
    }}>
      {/* Liquid Glow Backdrop */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <motion.div
          animate={{
            x: [0, 100, -100, 0],
            y: [0, -50, 50, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            top: '10%',
            left: '20%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(226,31,39,0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <motion.div
          animate={{
            x: [0, -120, 120, 0],
            y: [0, 80, -80, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '25%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(226,31,39,0.1) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Large soft arc at bottom like reference */}
        <div style={{
          position: 'absolute',
          bottom: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '400px',
          borderRadius: '50% 50% 0 0',
          background: 'radial-gradient(ellipse at top, rgba(226,31,39,0.2) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
      </div>

      {/* Logo at Top Center */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        style={{
          position: 'absolute',
          top: '40px',
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: 'white',
          borderRadius: '50%',
          padding: '4px',
          boxShadow: '0 0 20px rgba(226,31,39,0.3)'
        }}>
          <Image 
            src="/VK_Logo.png" 
            alt="Vidya's Kitchen" 
            width={72} 
            height={72} 
            style={{ borderRadius: '50%', objectFit: 'contain' }}
          />
        </div>
      </motion.div>

      {/* Main Glass Content */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        style={{
          position: 'relative',
          zIndex: 60,
          width: '420px',
          padding: '48px 32px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(24px)',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}
      >
        <span style={{
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '12px'
        }}>
          Hey buddy,
        </span>
        
        <h1 style={{
          fontSize: '32px',
          fontWeight: '800',
          marginBottom: '24px',
          background: 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: '1.2'
        }}>
          Welcome to <br />
          <span style={{ color: '#E21F27', WebkitTextFillColor: '#E21F27' }}>Vidya&apos;s Kitchen</span>
        </h1>

        {/* QR Code Section */}
        <div style={{
          position: 'relative',
          padding: '24px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '24px',
          marginBottom: '24px',
          border: '1px solid rgba(226,31,39,0.2)'
        }}>
          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '16px',
            boxShadow: '0 0 20px rgba(226,31,39,0.2)'
          }}>
            <QRCode 
              value={domain}
              size={180}
              fgColor="#000000"
              level="H"
            />
          </div>
          {/* Subtle glow behind QR */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle, rgba(226,31,39,0.1) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: -1
          }} />
        </div>

        <p style={{
          fontSize: '15px',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: '1.6',
          marginBottom: '32px',
          maxWidth: '300px'
        }}>
          Look, akka, you can&apos;t really taste a virtual mutton biryani on a big monitor. Scan this to unlock the proper kitchen experience on your phone!
        </p>

        {/* WhatsApp Button */}
        <a 
          href={`https://wa.me/919512219780`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 24px',
            backgroundColor: 'white',
            color: '#000',
            borderRadius: '16px',
            fontWeight: '700',
            fontSize: '15px',
            textDecoration: 'none',
            transition: 'transform 0.2s ease',
            width: '100%',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(255,255,255,0.1)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <WhatsappLogo size={24} weight="fill" color="#25D366" />
          Chat with Vidya Bot
        </a>
        
        <span style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          marginTop: '16px'
        }}>
          {whatsappNumber} • Order easily via WhatsApp
        </span>
      </motion.div>

      {/* Footer Branding */}
      <div style={{
        position: 'absolute',
        bottom: '32px',
        zIndex: 60,
        opacity: 0.5,
        fontSize: '12px',
        letterSpacing: '0.1em'
      }}>
        VIDYA&apos;S KITCHEN • PREMIUM HOME CATERING
      </div>
    </div>
  );
}
