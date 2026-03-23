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
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

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
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#FFFFFF',
      fontFamily: 'var(--font-jetbrains-mono), monospace',
    }}>
      <style>{`
        ::selection { background: #FFFFFF; color: #000000; }
        ::-moz-selection { background: #FFFFFF; color: #000000; }
        * { scroll-behavior: smooth; }
        .back-link:hover { color: #FFFFFF !important; }
        .back-link:hover svg { color: #FFFFFF !important; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* FIXED Top Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '24px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        zIndex: 1000,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '81px'
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
              color: 'rgba(255,255,255,0.4)',
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '0.15em',
              transition: 'all 0.3s ease'
            }}
            className="back-link"
          >
            <ArrowLeft size={18} weight="bold" />
            Back to Home
          </Link>
        </motion.div>
        <div style={{ 
          fontSize: '10px', 
          fontWeight: '900', 
          letterSpacing: '0.4em', 
          color: 'rgba(255,255,255,0.15)', 
          textTransform: 'uppercase',
          textAlign: 'right'
        }}>
          Vidya&apos;s Kitchen Legal
        </div>
      </header>

      {/* FIXED Left Sidebar */}
      <aside style={{
        width: '320px',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        padding: '0 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'fixed',
        top: '81px',
        left: 0,
        bottom: 0,
        zIndex: 100
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
                    transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                    color: activeTab === tab.id ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
                    transform: activeTab === tab.id ? 'translateX(8px)' : 'translateX(0)'
                  }}
                  className="hover:text-white"
                >
                  {activeTab === tab.id && <span style={{ marginRight: '8px', color: '#FFFFFF' }}>—</span>}
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* FIXED Right Sidebar */}
      <aside style={{
        width: '320px',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        padding: '0 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'fixed',
        top: '81px',
        right: 0,
        bottom: 0,
        zIndex: 100
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: '900',
          letterSpacing: '0.3em',
          color: 'rgba(255,255,255,0.15)',
          textTransform: 'uppercase',
          marginBottom: '40px'
        }}>
          On this page
        </div>
        <nav className="hide-scrollbar" style={{ overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {content[activeTab].toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(item.id);
                    if (el) {
                      const top = el.getBoundingClientRect().top + window.pageYOffset - 120;
                      window.scrollTo({ top, behavior: 'smooth' });
                    }
                  }}
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    textDecoration: 'none',
                    color: activeSection === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
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

      {/* Main Content Area - Flows Naturally */}
      <main style={{
        marginLeft: '320px',
        marginRight: '320px',
        padding: '160px 100px 100px',
        minHeight: '100vh',
      }}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ 
            maxWidth: '800px', 
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '80px', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h1 style={{
              fontSize: '56px',
              fontWeight: '900',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '20px',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              textAlign: 'center',
              width: '100%',
              display: 'block',
              whiteSpace: 'nowrap'
            }}>
              {content[activeTab].title}
            </h1>
            <p style={{
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '0.25em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              textAlign: 'center',
              width: '100%',
              display: 'block'
            }}>
              Last Updated: March 23, 2026
            </p>
          </div>
          
          <div style={{ color: 'rgba(255,255,255,0.5)', lineHeight: '2.2', fontSize: '18px', width: '100%' }}>
            {content[activeTab].body}
          </div>

          <footer style={{
            marginTop: '100px',
            paddingTop: '60px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            paddingBottom: '80px',
            width: '100%'
          }}>
            <Image 
              src="/VK_Logo.png" 
              alt="Vidya's Kitchen" 
              width={48} 
              height={48} 
              style={{ borderRadius: '50%', opacity: 0.8 }}
            />
            <p style={{
              fontSize: '10px',
              fontWeight: '900',
              letterSpacing: '0.3em',
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
              textAlign: 'center'
            }}>
              &copy; 2026 Vidya&apos;s Kitchen. All rights reserved.
            </p>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}
