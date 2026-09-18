"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "@phosphor-icons/react";

import Link from "next/link";
import Image from "next/image";
import { REFUND_POLICY, TERMS_POLICY, PRIVACY_POLICY, type Policy } from "@/lib/policy-copy";

type Tab = "terms" | "privacy" | "refund";

interface LegalHubProps {
  initialTab?: Tab;
}

function renderPolicyBody(policy: Policy, activeSection: string) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "64px" }}>
      <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "18px", lineHeight: "1.8" }}>
        {policy.intro}
      </p>

      {policy.sections.map((sec) => {
        const isCurrent = activeSection === sec.id;
        return (
          <section key={sec.id} id={sec.id} style={{ scrollMarginTop: "120px" }}>
            <h2
              style={{
                fontSize: "26px",
                fontWeight: "900",
                color: isCurrent ? "#FFFFFF" : "rgba(255,255,255,0.82)",
                marginBottom: "20px",
                letterSpacing: "0.02em",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "all 0.3s ease",
              }}
            >
              <span
                style={{
                  width: "4px",
                  height: isCurrent ? "24px" : "0px",
                  backgroundColor: "#BD2320",
                  borderRadius: "2px",
                  transition: "all 0.3s ease",
                  flexShrink: 0,
                  opacity: isCurrent ? 1 : 0,
                }}
              />
              <span>{sec.heading}</span>
            </h2>
            {sec.blocks.map((block, idx) =>
              "bullets" in block ? (
                <ul
                  key={idx}
                  style={{
                    listStyle: "disc",
                    marginLeft: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "17px",
                    lineHeight: "1.8",
                    marginBottom: "16px",
                  }}
                >
                  {block.bullets.map((b, bIdx) => (
                    <li key={bIdx}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p
                  key={idx}
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "17px",
                    lineHeight: "1.8",
                    marginBottom: "16px",
                  }}
                >
                  {block.text}
                </p>
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}

const content = {
  terms: {
    title: TERMS_POLICY.title,
    lastUpdated: TERMS_POLICY.lastUpdated,
    toc: TERMS_POLICY.sections.map((s) => ({ id: s.id, label: s.heading })),
    policy: TERMS_POLICY,
  },
  privacy: {
    title: PRIVACY_POLICY.title,
    lastUpdated: PRIVACY_POLICY.lastUpdated,
    toc: PRIVACY_POLICY.sections.map((s) => ({ id: s.id, label: s.heading })),
    policy: PRIVACY_POLICY,
  },
  refund: {
    title: REFUND_POLICY.title,
    lastUpdated: REFUND_POLICY.lastUpdated,
    toc: REFUND_POLICY.sections.map((s) => ({ id: s.id, label: s.heading })),
    policy: REFUND_POLICY,
  },
};

export function LegalHub({ initialTab = "terms" }: LegalHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeSection, setActiveSection] = useState<string>(
    () => content[initialTab]?.toc[0]?.id || ""
  );
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Terms/legal is often opened from the app; ensure name-edit or other locks don’t trap scroll. */
  useEffect(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }, []);

  // Robust Scroll Spy Implementation
  useEffect(() => {
    const skipSplash = () => localStorage.setItem("skip_splash", "true");
    const backBtn = document.getElementById("back-to-home");
    if (backBtn) backBtn.addEventListener("click", skipSplash);

    // Default to first section when tab changes
    const currentToc = content[activeTab]?.toc || [];
    if (currentToc.length > 0) {
      setActiveSection(currentToc[0].id);
    }

    const updateActiveSection = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("main section[id]"));
      if (sections.length === 0) return;

      const scrollPos = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // If at top, highlight first section
      if (scrollPos < 120) {
        setActiveSection(sections[0].id);
        return;
      }

      // If at bottom, highlight last section
      if (scrollPos + windowHeight >= docHeight - 50) {
        setActiveSection(sections[sections.length - 1].id);
        return;
      }

      // Find section whose top is near or above header offset
      const offsetThreshold = narrow ? 130 : 180;
      let activeId = sections[0].id;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= offsetThreshold) {
          activeId = section.id;
        } else {
          break;
        }
      }
      setActiveSection(activeId);
    };

    // Run after DOM has updated from tab change
    const rafId = requestAnimationFrame(() => {
      updateActiveSection();
    });

    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      backBtn?.removeEventListener("click", skipSplash);
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [activeTab, narrow]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "terms", label: "Terms of Service" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "refund", label: "Refund Policy" },
  ];

  const scrollToSectionId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveSection(id);
    const offset = narrow ? 96 : 140;
    const top = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#FFFFFF',
      fontFamily: 'var(--font-outfit), system-ui, sans-serif',
    }}>
      <style>{`
        ::selection { background: #FFFFFF; color: #000000; }
        ::-moz-selection { background: #FFFFFF; color: #000000; }
        * { scroll-behavior: smooth; }
        .back-link:hover { color: #FFFFFF !important; }
        .back-link:hover svg { color: #FFFFFF !important; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .toc-link:hover { color: #FFFFFF !important; }
      `}</style>

      {/* FIXED Top Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: narrow ? '16px 20px' : '24px 48px',
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
        minHeight: narrow ? '64px' : '81px',
        height: narrow ? 'auto' : '81px',
      }}>
        <motion.div
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
            <ArrowLeft size={18} weight="bold" color="currentColor" />

            Back to Home
          </Link>
        </motion.div>
        <div style={{ 
          fontSize: narrow ? '9px' : '10px', 
          fontWeight: '900', 
          letterSpacing: narrow ? '0.2em' : '0.4em', 
          color: 'rgba(255,255,255,0.3)', 
          textTransform: 'uppercase',
          textAlign: 'right',
          maxWidth: narrow ? '45%' : 'none',
          lineHeight: 1.3,
        }}>
          {narrow ? 'Legal' : "Vidya's Kitchen Legal"}
        </div>
      </header>

      {narrow && (
        <nav
          className="hide-scrollbar"
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            zIndex: 900,
            backgroundColor: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '10px 16px',
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                borderRadius: 999,
                border: `1px solid ${activeTab === tab.id ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
                background: activeTab === tab.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: activeTab === tab.id ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.id === 'terms' ? 'Terms' : tab.id === 'privacy' ? 'Privacy' : 'Refunds'}
            </button>
          ))}
        </nav>
      )}

      {!narrow && (
        <>
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
                    fontSize: '14px',
                    fontWeight: '900',
                    letterSpacing: '0.06em',
                    transition: 'all 0.3s ease',
                    color: activeTab === tab.id ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                    transform: activeTab === tab.id ? 'translateX(8px)' : 'translateX(0)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  className="hover:text-white"
                >
                  {activeTab === tab.id && <span style={{ marginRight: '8px', color: '#BD2320', fontWeight: 900 }}>—</span>}
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* FIXED Right Sidebar - On This Page */}
      <aside style={{
        width: '320px',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        padding: '0 40px',
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
          fontSize: '12px',
          fontWeight: '900',
          letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          marginBottom: '32px'
        }}>
          On this page
        </div>
        <nav className="hide-scrollbar" style={{ overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {content[activeTab].toc.map((item) => {
              const isCurrent = activeSection === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSectionId(item.id);
                    }}
                    style={{
                      fontSize: '14px',
                      fontWeight: isCurrent ? '800' : '500',
                      lineHeight: '1.5',
                      textDecoration: 'none',
                      color: isCurrent ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                      transition: 'all 0.25s ease',
                      letterSpacing: '0.01em',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      transform: isCurrent ? 'translateX(4px)' : 'translateX(0)',
                    }}
                    className="toc-link"
                  >
                    <span
                      style={{
                        width: '3px',
                        height: isCurrent ? '18px' : '0px',
                        backgroundColor: '#BD2320',
                        borderRadius: '2px',
                        marginTop: '2px',
                        transition: 'height 0.25s ease',
                        flexShrink: 0,
                      }}
                    />
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
        </>
      )}

      {/* Main Content Area - Flows Naturally */}
      <main style={{
        marginLeft: narrow ? 0 : '320px',
        marginRight: narrow ? 0 : '320px',
        padding: narrow ? '132px 20px 56px' : '160px 100px 100px',
        minHeight: '100vh',
        touchAction: narrow ? 'pan-y' : undefined,
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
              fontSize: narrow ? 'clamp(28px, 7vw, 42px)' : '56px',
              fontWeight: '900',
              letterSpacing: '-0.02em',
              lineHeight: narrow ? 1.15 : '1',
              marginBottom: '20px',
              color: '#FFFFFF',
              textAlign: 'center',
              width: '100%',
              display: 'block',
              whiteSpace: narrow ? 'normal' : 'nowrap'
            }}>
              {content[activeTab].title}
            </h1>
            <p style={{
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '0.04em',
              color: 'rgba(255,255,255,0.58)',
              textAlign: 'center',
              width: '100%',
              display: 'block'
            }}>
              Last Updated: March 23, 2026
            </p>
          </div>
          
          {narrow && (
            <details
              style={{
                width: '100%',
                marginBottom: 28,
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14,
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.8)',
                  listStyle: 'none',
                }}
              >
                On this page
              </summary>
              <ul style={{ listStyle: 'none', padding: '14px 0 0', margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {content[activeTab].toc.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSectionId(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: 600,
                        color: activeSection === item.id ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '2.2', fontSize: narrow ? '16px' : '18px', width: '100%' }}>
            {renderPolicyBody(content[activeTab].policy, activeSection)}
          </div>

          <footer style={{
            marginTop: '100px',
            paddingTop: '60px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            paddingBottom: '80px',
            width: '100%'
          }}>
            <Image 
              src="/VK_Logo.webp" 
              alt="Vidya's Kitchen" 
              width={64} 
              height={64} 
              style={{ borderRadius: '50%', opacity: 0.9 }}
            />
            <p style={{
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>&copy;</span> 2026 Vidya&apos;s Kitchen. All rights reserved.
            </p>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}
