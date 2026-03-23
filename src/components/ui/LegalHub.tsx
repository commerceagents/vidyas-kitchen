"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Phone } from "@phosphor-icons/react";
import Link from "next/link";

type Tab = "terms" | "privacy" | "refund";

interface LegalHubProps {
  initialTab?: Tab;
}

const content = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "January 21, 2019",
    toc: [
      { id: "acceptance", label: "1. Acceptance of Terms" },
      { id: "description", label: "2. Service Description" },
      { id: "obligations", label: "3. User Obligations" },
      { id: "pricing", label: "4. Pricing and Payment" },
      { id: "liability", label: "5. Limitation of Liability" },
      { id: "law", label: "6. Governing Law" },
    ],
    body: (
      <div className="space-y-12">
        <p className="text-slate-400 text-lg leading-8">Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully as they contain important information about your legal rights, remedies and obligations. By accessing or using the Vidya&apos;s Kitchen Platform, you agree to comply with and be bound by these Terms.</p>
        
        <section id="acceptance" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">1. Acceptance of Terms</h2>
          <p className="text-slate-400 text-lg leading-8">By accessing Vidya&apos;s Kitchen services via our website or WhatsApp bot, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
        </section>

        <section id="description" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">2. Service Description</h2>
          <p className="text-slate-400 text-lg leading-8">Vidya&apos;s Kitchen provides home-cooked meal catering and delivery services. All orders are subject to availability and acceptance by us.</p>
        </section>

        <section id="obligations" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">3. User Obligations</h2>
          <p className="text-slate-400 text-lg leading-8">Users must provide accurate information for order delivery and payment. Any misuse of the WhatsApp bot or website to place fraudulent orders is strictly prohibited.</p>
        </section>

        <section id="pricing" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">4. Pricing and Payment</h2>
          <p className="text-slate-400 text-lg leading-8">All prices are listed in Indian Rupees (INR). Payments must be made via the secure Razorpay links provided after order confirmation. Orders will only be processed once payment is confirmed.</p>
        </section>

        <section id="liability" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">5. Limitation of Liability</h2>
          <p className="text-slate-400 text-lg leading-8">Vidya&apos;s Kitchen is not liable for indirect, incidental, or consequential damages arising from the use of our services or the consumption of our products beyond the order value.</p>
        </section>

        <section id="law" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">6. Governing Law</h2>
          <p className="text-slate-400 text-lg leading-8">These terms are governed by the laws of India, and any disputes will be subject to the exclusive jurisdiction of the courts in Sivakasi, Tamil Nadu.</p>
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
      <div className="space-y-12">
        <p className="text-slate-400 text-lg leading-8">At Vidya&apos;s Kitchen, we value your privacy. This policy explains how we collect and use your data when you interact with our platform.</p>
        
        <section id="collection" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">1. Information We Collect</h2>
          <ul className="list-disc ml-6 space-y-4 text-slate-400 text-lg leading-8">
            <li><strong>WhatsApp Details:</strong> Name and phone number provided when interacting with our bot.</li>
            <li><strong>Order Content:</strong> Items ordered, delivery preferences, and special instructions.</li>
            <li><strong>Payment Info:</strong> We use Razorpay for payment processing and do not store your credit card details.</li>
          </ul>
        </section>

        <section id="usage" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">2. How We Use Information</h2>
          <p className="text-slate-400 text-lg leading-8">Your data is used solely to provide and improve our services, including processing orders, sending payment links, and responding to your queries on WhatsApp.</p>
        </section>

        <section id="sharing" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">3. Data Sharing</h2>
          <p className="text-slate-400 text-lg leading-8">We do not sell or rent your personal information. Data is shared only with Razorpay to facilitate payments.</p>
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
      <div className="space-y-12">
        <p className="text-slate-400 text-lg leading-8">As we prepare fresh home-cooked meals, our refund and cancellation policies are strict to ensure quality and minimize waste.</p>
        
        <section id="cancellation" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">1. Order Cancellation</h2>
          <p className="text-slate-400 text-lg leading-8">Cancellations are only permitted within 15 minutes of placing the order. Once food preparation has started, we cannot accept cancellations.</p>
        </section>

        <section id="eligibility" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">2. Refund Eligibility</h2>
          <p className="text-slate-400 text-lg leading-8">Refunds are issued if:</p>
          <ul className="list-disc ml-6 space-y-4 text-slate-400 text-lg leading-8">
            <li>The delivered food is spoiled.</li>
            <li>Wrong items were delivered.</li>
            <li>Order was not delivered due to our error.</li>
          </ul>
        </section>

        <section id="process" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-white mb-6">3. Refund Process</h2>
          <p className="text-slate-400 text-lg leading-8">To request a refund, please contact us on WhatsApp with photos of the issue within 1 hour of delivery. Approved refunds will be processed via Razorpay within 5-7 business days.</p>
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
    return () => backBtn?.removeEventListener('click', skipSplash);
  }, []);

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
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>{`
        ::selection { background: #FFFFFF; color: #000000; }
        ::-moz-selection { background: #FFFFFF; color: #000000; }
        * { scroll-behavior: smooth; }
      `}</style>
      {/* Top Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'between',
        position: 'sticky',
        top: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(20px)',
        zIndex: 100
      }}>
        <Link 
          href="/" 
          id="back-to-home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            fontSize: '11px',
            fontWeight: '900',
            letterSpacing: '0.1em'
          }}
          className="group hover:text-white transition-colors"
        >
          <ArrowLeft size={18} weight="bold" />
          Back to Home
        </Link>
        <div style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase' }}>
          Vidya&apos;s Kitchen Legal
        </div>
      </header>

      <div style={{ 
        display: 'flex', 
        flex: 1, 
        maxWidth: '1400px', 
        margin: '0 auto', 
        width: '100%',
        position: 'relative'
      }}>
        {/* Left Sidebar - Options */}
        <aside style={{
          width: '300px',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          padding: '48px',
          position: 'sticky',
          top: '80px',
          height: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                      transition: 'all 0.3s ease',
                      color: activeTab === tab.id ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                      transform: activeTab === tab.id ? 'scale(1.05)' : 'scale(1)'
                    }}
                    className="hover:text-white"
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content Pane */}
        <main style={{
          flex: 1,
          padding: '80px',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          minHeight: '100vh'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ maxWidth: '650px' }}
            >
              <h1 style={{
                fontSize: '64px',
                fontWeight: '900',
                letterSpacing: '-0.04em',
                lineHeight: '0.9',
                marginBottom: '16px',
                textTransform: 'uppercase',
                color: '#FFFFFF'
              }}>
                {content[activeTab].title}
              </h1>
              <p style={{
                fontSize: '10px',
                fontWeight: '900',
                letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.2)',
                marginBottom: '80px',
                textTransform: 'uppercase'
              }}>
                Last Updated: {content[activeTab].lastUpdated}
              </p>
              
              <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.8' }}>
                {content[activeTab].body}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right Sidebar - On This Page */}
        <aside style={{
          width: '280px',
          padding: '48px',
          position: 'sticky',
          top: '80px',
          height: 'calc(100vh - 80px)'
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '900',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.2)',
            textTransform: 'uppercase',
            marginBottom: '32px'
          }}>
            On this page
          </div>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {content[activeTab].toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      color: 'rgba(255,255,255,0.3)',
                      transition: 'color 0.2s ease',
                      textTransform: 'uppercase'
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

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '64px 32px',
        backgroundColor: '#000000'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <p style={{
            fontSize: '10px',
            fontWeight: '900',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.2)',
            textTransform: 'uppercase'
          }}>
            &copy; 2026 Vidya&apos;s Kitchen. All rights reserved.
          </p>
          <a 
            href="tel:+917550028179" 
            style={{
              fontSize: '12px',
              fontWeight: '900',
              color: '#E21F27',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Phone size={20} weight="fill" />
            Contact Us
          </a>
        </div>
      </footer>
    </div>
  );
}
