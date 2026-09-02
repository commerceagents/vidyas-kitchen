"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { C, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";
import type { Policy } from "@/lib/policy-copy";

const fontUi = C.mono;

/**
 * A policy read inside the app, in the app's own clothes. The same words are
 * served at /terms and /refund-policy for anyone arriving from outside; this
 * exists so tapping a row on the account page doesn't drop the customer into
 * the dark marketing site at desktop text sizes.
 */
export function PolicySheet({
  policy,
  fullPageHref,
  onClose,
}: {
  policy: Policy;
  /** The public page carrying the same text, for sharing or printing. */
  fullPageHref?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        fontFamily: fontUi,
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vk-policy-title"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 18px 14px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              id="vk-policy-title"
              style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}
            >
              {policy.title}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: C_TEXT_MUTED }}>
              Updated {policy.lastUpdated}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={17} weight="bold" color={C.text} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "18px 18px max(24px, env(safe-area-inset-bottom, 0px))" }}>
          <p style={{ margin: "0 0 4px", fontSize: 14.5, fontWeight: 600, color: C_TEXT_SEC, lineHeight: 1.6 }}>
            {policy.intro}
          </p>

          {policy.sections.map((section) => (
            <section key={section.id} style={{ marginTop: 24 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15.5, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>
                {section.heading}
              </h3>
              {section.blocks.map((block, i) =>
                "bullets" in block ? (
                  <ul
                    key={i}
                    style={{
                      margin: "0 0 8px",
                      paddingLeft: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 7,
                    }}
                  >
                    {block.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        style={{ fontSize: 14, fontWeight: 600, color: C_TEXT_SEC, lineHeight: 1.6 }}
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    key={i}
                    style={{
                      margin: "0 0 8px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: C_TEXT_SEC,
                      lineHeight: 1.65,
                    }}
                  >
                    {block.text}
                  </p>
                ),
              )}
            </section>
          ))}

          {fullPageHref ? (
            <a
              href={fullPageHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: 22,
                fontSize: 13.5,
                fontWeight: 800,
                color: C.red,
                textDecoration: "none",
              }}
            >
              Open the full page
            </a>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
