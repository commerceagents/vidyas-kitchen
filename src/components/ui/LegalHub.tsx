"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Phone } from "@phosphor-icons/react";
import Link from "next/link";
import Image from "next/image";

type Tab = "terms" | "privacy" | "refund";

interface LegalHubProps {
  initialTab?: Tab;
}

const content = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "March 23, 2026",
    toc: [
      { id: "acceptance", label: "1. Acceptance of Terms" },
      { id: "description", label: "2. Service Description" },
      { id: "obligations", label: "3. User Obligations" },
      { id: "pricing", label: "4. Pricing and Payment" },
      { id: "liability", label: "5. Limitation of Liability" },
      { id: "law", label: "6. Governing Law" },
    ],
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully as they contain important information about your legal rights, remedies and obligations. By accessing or using the Vidya&apos;s Kitchen Platform, you agree to comply with and be bound by these Terms.</p>
        
        <section id="acceptance" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Acceptance of Terms</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>By accessing Vidya&apos;s Kitchen services via our website or WhatsApp bot, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
        </section>

        <section id="description" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Service Description</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>Vidya&apos;s Kitchen provides home-cooked meal catering and delivery services. All orders are subject to availability and acceptance by us.</p>
        </section>

        <section id="obligations" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. User Obligations</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>Users must provide accurate information for order delivery and payment. Any misuse of the WhatsApp bot or website to place fraudulent orders is strictly prohibited.</p>
        </section>

        <section id="pricing" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>4. Pricing and Payment</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>All prices are listed in Indian Rupees (INR). Payments must be made via the secure Razorpay links provided after order confirmation. Orders will only be processed once payment is confirmed.</p>
        </section>

        <section id="liability" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>5. Limitation of Liability</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>Vidya&apos;s Kitchen is not liable for indirect, incidental, or consequential damages arising from the use of our services or the consumption of our products beyond the order value.</p>
        </section>

        <section id="law" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>6. Governing Law</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>These terms are governed by the laws of India, and any disputes will be subject to the exclusive jurisdiction of the courts in Sivakasi, Tamil Nadu.</p>
        </section>
      </div>
    )
  },
  privacy: {
    title: "Privacy Policy",
    lastUpdated: "March 23, 2026",
    toc: [
      { id: "collection", label: "1. Information We Collect" },
      { id: "usage", label: "2. How We Use Information" },
      { id: "sharing", label: "3. Data Sharing" },
    ],
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>At Vidya&apos;s Kitchen, we value your privacy. This policy explains how we collect and use your data when you interact with our platform.</p>
        
        <section id="collection" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Information We Collect</h2>
          <ul style={{ listStyle: 'disc', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>
            <li><strong>WhatsApp Details:</strong> Name and phone number provided when interacting with our bot.</li>
            <li><strong>Order Content:</strong> Items ordered, delivery preferences, and special instructions.</li>
            <li><strong>Payment Info:</strong> We use Razorpay for payment processing and do not store your credit card details.</li>
          </ul>
        </section>

        <section id="usage" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. How We Use Information</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>Your data is used solely to provide and improve our services, including processing orders, sending payment links, and responding to your queries on WhatsApp.</p>
        </section>

        <section id="sharing" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Data Sharing</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>We do not sell or rent your personal information. Data is shared only with Razorpay to facilitate payments.</p>
        </section>
      </div>
    )
  },
  refund: {
    title: "Refund Policy",
    lastUpdated: "March 23, 2026",
    toc: [
      { id: "cancellation", label: "1. Order Cancellation" },
      { id: "eligibility", label: "2. Refund Eligibility" },
      { id: "process", label: "3. Refund Process" },
    ],
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>As we prepare fresh home-cooked meals, our refund and cancellation policies are strict to ensure quality and minimize waste.</p>
        
        <section id="cancellation" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Order Cancellation</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>Cancellations are only permitted within 15 minutes of placing the order. Once food preparation has started, we cannot accept cancellations.</p>
        </section>

        <section id="eligibility" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Refund Eligibility</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>Refunds are issued if:</p>
          <ul style={{ listStyle: 'disc', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>
            <li>The delivered food is spoiled.</li>
            <li>Wrong items were delivered.</li>
            <li>Order was not delivered due to our error.</li>
          </ul>
        </section>

        <section id="process" style={{ scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Refund Process</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: '1.8' }}>To request a refund, please contact us on WhatsApp with photos of the issue within 1 hour of delivery. Approved refunds will be processed via Razorpay within 5-7 business days.</p>
        </section>
      </div>
    )
  }
};

export function LegalHub({ initialTab = "terms" }: LegalHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const skipSplash = () => localStorage.setItem('skip_splash', 'true');
    const backBtn = document.getElementById('back-to-home');
    if (backBtn) backBtn.addEventListener('click', skipSplash);

    // Scroll Spy Implementation
    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -80% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    // Observe all sections
    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      backBtn?.removeEventListener('click', skipSplash);
      observer.disconnect();
    };
  }, [activeTab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "terms", label: "Terms of Service" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "refund", label: "Refund Policy" },
  ];

  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#000000',
      color: '#FFFFFF',
      fontFamily: 'var(--font-jetbrains-mono), monospace',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden' // Main container doesn't scroll
    }}>
      <style>{`
        ::selection { background: #FFFFFF; color: #000000; }
        ::-moz-selection { background: #FFFFFF; color: #000000; }
        * { scroll-behavior: smooth; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* FIXED Top Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '24px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between', // Corrected from 'between'
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(20px)',
        zIndex: 100,
        flexShrink: 0
      }}>
        <motion.div
          whileHover={{ x: -4 }}
          transition={{ duration: 0.2 }}
        >
          <Link 
            href="/" 
            id="back-to-home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '0.15em',
              transition: 'color 0.3s ease'
            }}
            className="hover:text-white"
          >
            <ArrowLeft size={18} weight="bold" />
            Back to Home
          </Link>
        </motion.div>
        <div style={{ 
          fontSize: '10px', 
          fontWeight: '900', 
          letterSpacing: '0.4em', 
          color: 'rgba(255,255,255,0.2)', 
          textTransform: 'uppercase',
          textAlign: 'right'
        }}>
          Vidya&apos;s Kitchen Legal
        </div>
      </header>

      {/* Scrollable Layout Container */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        maxWidth: '1600px', 
        margin: '0 auto', 
        width: '100%',
        height: 'calc(100vh - 81px)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Left Sidebar - FIXED */}
        <aside style={{
          width: '320px',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          padding: '60px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          flexShrink: 0
        }}>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '900',
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                      transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                      color: activeTab === tab.id ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                      transform: activeTab === tab.id ? 'translateX(10px)' : 'translateX(0)'
                    }}
                    className="hover:text-white"
                  >
                    {activeTab === tab.id && <span style={{ marginRight: '8px' }}>—</span>}
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Center Content - SCROLLABLE */}
        <main className="hide-scrollbar" style={{
          flex: 1,
          padding: '80px 100px',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          overflowY: 'auto',
          scrollBehavior: 'smooth'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ maxWidth: '700px', margin: '0 auto' }}
            >
              <h1 style={{
                fontSize: '72px',
                fontWeight: '900',
                letterSpacing: '-0.05em',
                lineHeight: '0.85',
                marginBottom: '20px',
                textTransform: 'uppercase',
                color: '#FFFFFF'
              }}>
                {content[activeTab].title}
              </h1>
              <p style={{
                fontSize: '11px',
                fontWeight: '900',
                letterSpacing: '0.25em',
                color: 'rgba(255,255,255,0.25)',
                marginBottom: '100px',
                textTransform: 'uppercase'
              }}>
                Last Updated: March 23, 2026
              </p>
              
              <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '2' }}>
                {content[activeTab].body}
              </div>

              {/* Dynamic Footer Inside Scroll Area */}
              <footer style={{
                marginTop: '150px',
                paddingTop: '60px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                paddingBottom: '100px'
              }}>
                <Image 
                  src="/VK_Logo.png" 
                  alt="Vidya's Kitchen" 
                  width={32} 
                  height={32} 
                  style={{ borderRadius: '50%', opacity: 0.5 }}
                />
                <p style={{
                  fontSize: '10px',
                  fontWeight: '900',
                  letterSpacing: '0.3em',
                  color: 'rgba(255,255,255,0.2)',
                  textTransform: 'uppercase',
                  textAlign: 'center'
                }}>
                  &copy; 2026 Vidya&apos;s Kitchen. All rights reserved.
                </p>
              </footer>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right Sidebar - FIXED (ToC) */}
        <aside style={{
          width: '320px',
          padding: '60px 48px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '900',
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.2)',
            textTransform: 'uppercase',
            marginBottom: '40px'
          }}>
            On this page
          </div>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {content[activeTab].toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      color: activeSection === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                      transition: 'all 0.3s ease',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'block'
                    }}
                    className="hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
