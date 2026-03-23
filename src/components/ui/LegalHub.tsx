"use client";

import { useState } from "react";
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
    lastUpdated: "January 21, 2019", // User's screenshot date or current
    body: (
      <div className="space-y-6">
        <p className="text-slate-600">Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully as they contain important information about your legal rights, remedies and obligations. By accessing or using the Vidya&apos;s Kitchen Platform, you agree to comply with and be bound by these Terms.</p>
        <h3 className="text-xl font-bold text-slate-900">1. Acceptance of Terms</h3>
        <p className="text-slate-600">By accessing Vidya&apos;s Kitchen services via our website or WhatsApp bot, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
        <h3 className="text-xl font-bold text-slate-900">2. Service Description</h3>
        <p className="text-slate-600">Vidya&apos;s Kitchen provides home-cooked meal catering and delivery services. All orders are subject to availability and acceptance by us.</p>
        <h3 className="text-xl font-bold text-slate-900">3. Pricing and Payment</h3>
        <p className="text-slate-600">All prices are listed in Indian Rupees (INR). Payments must be made via the secure Razorpay links provided after order confirmation. Orders will only be processed once payment is confirmed.</p>
      </div>
    )
  },
  privacy: {
    title: "Privacy Policy",
    lastUpdated: "March 23, 2026",
    body: (
      <div className="space-y-6">
        <p className="text-slate-600">At Vidya&apos;s Kitchen, we value your privacy. This policy explains how we collect and use your data when you interact with our platform.</p>
        <h2 className="text-xl font-bold text-slate-900">1. Information We Collect</h2>
        <ul className="list-disc ml-6 space-y-2 text-slate-600">
          <li><strong>WhatsApp Details:</strong> Name and phone number provided when interacting with our bot.</li>
          <li><strong>Order Content:</strong> Items ordered, delivery preferences, and special instructions.</li>
          <li><strong>Payment Info:</strong> We use Razorpay for payment processing and do not store your credit card details.</li>
        </ul>
        <h2 className="text-xl font-bold text-slate-900">2. Data Sharing</h2>
        <p className="text-slate-600">We do not sell or rent your personal information. Data is shared only with Razorpay to facilitate payments.</p>
      </div>
    )
  },
  refund: {
    title: "Refund Policy",
    lastUpdated: "March 23, 2026",
    body: (
      <div className="space-y-6">
        <p className="text-slate-600">As we prepare fresh home-cooked meals, our refund and cancellation policies are strict to ensure quality and minimize waste.</p>
        <h2 className="text-xl font-bold text-slate-900">1. Order Cancellation</h2>
        <p className="text-slate-600">Cancellations are only permitted within 15 minutes of placing the order. Once food preparation has started, we cannot accept cancellations.</p>
        <h2 className="text-xl font-bold text-slate-900">2. Refund Eligibility</h2>
        <p className="text-slate-600">Refunds are issued if:</p>
        <ul className="list-disc ml-6 space-y-2 text-slate-600">
          <li>The delivered food is spoiled.</li>
          <li>Wrong items were delivered.</li>
          <li>Order was not delivered due to our error.</li>
        </ul>
      </div>
    )
  }
};

export function LegalHub({ initialTab = "terms" }: LegalHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: "terms", label: "Terms of Service" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "refund", label: "Refund Policy" },
  ];

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-100 px-8 py-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors group">
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold">Back</span>
        </Link>
        <div className="text-sm font-bold tracking-widest text-slate-300">VIDYA&apos;S KITCHEN LEGAL</div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Left Sidebar */}
        <aside className="w-80 border-r border-slate-100 p-8 hidden md:block">
          <nav className="sticky top-24">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-semibold ${
                      activeTab === tab.id
                        ? "bg-slate-50 text-slate-950 translate-x-1"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 p-8 md:p-16 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl"
            >
              <h1 className="text-4xl font-black text-slate-900 mb-2">{content[activeTab].title}</h1>
              <p className="text-sm font-medium text-slate-400 mb-12">Last Updated: {content[activeTab].lastUpdated}</p>
              
              <div className="prose prose-slate max-w-none">
                {content[activeTab].body}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-400 font-medium whitespace-nowrap">
            &copy; 2026 Vidya&apos;s Kitchen. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="tel:+917550028179" className="text-sm font-bold text-[#E21F27] flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Phone size={18} weight="fill" />
              CONTACT US
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
