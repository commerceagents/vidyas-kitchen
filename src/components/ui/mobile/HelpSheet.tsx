"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown, Phone, X } from "@phosphor-icons/react";
import { C, C_TEXT_MUTED, C_TEXT_SEC } from "@/components/ui/mobile/mobile-design-tokens";
import { SUPPORT_PHONE_E164, whatsappBotLink } from "@/lib/whatsapp-copy";
import { COD_MAX_ORDER_VALUE } from "@/lib/cod-policy";

const fontUi = C.mono;

/**
 * Answers that match what the app actually does, so support isn't fielding
 * questions the screen could have answered.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: "Where is my order?",
    a: "Open the Order tab — it shows the live stage of your order and, once the driver sets off, their position on the map. It refreshes every few seconds on its own.",
  },
  {
    q: "Can I cancel my order?",
    a: "Yes, until the cancellation window closes — the Order tab shows a Cancel button while it's still open. Because everything is cooked fresh to your slot, we can't cancel once the kitchen has started.",
  },
  {
    q: "How does Cash on Delivery work?",
    a: `Pick Cash on Delivery at checkout and keep the exact amount ready. The driver confirms the cash in their app when they hand the food over, and your order is marked paid. Cash is available on orders up to ₹${COD_MAX_ORDER_VALUE.toLocaleString("en-IN")}.`,
  },
  {
    q: "Nobody was there to pay or collect. What now?",
    a: "The driver marks the order as not delivered and the food comes back to the kitchen. We'll call you to sort it out. Cash on Delivery is paused on that number afterwards — you can still order by paying online, and we'll re-enable cash once we've spoken.",
  },
  {
    q: "Something was wrong or missing in my order",
    a: "Message us on WhatsApp within an hour of delivery with a photo. Approved refunds go back to the original payment method through Razorpay within 5–7 business days.",
  },
  {
    q: "Can I change my delivery address?",
    a: "You can edit it from the Order tab while the order is still waiting for the kitchen to accept. After that, message us on WhatsApp and we'll try to update it before the driver leaves.",
  },
  {
    q: "Where do you deliver?",
    a: "We cook and deliver in Sivakasi. You can order from anywhere — just set the delivery pin to a Sivakasi address, which is how you send food to family or friends there.",
  },
];

/** Help & support sheet — FAQ first, humans one tap away. */
export function HelpSheet({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  const waHref = whatsappBotLink("Hi Vidya's Kitchen! I have a question.");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
      onClick={onClose}
    >
      <motion.div
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
            <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>
              Help &amp; support
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: C_TEXT_MUTED }}>
              Answers to the usual questions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
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

        <div style={{ overflowY: "auto", padding: "10px 18px 18px" }}>
          {FAQS.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setOpen(on ? null : i)}
                  aria-expanded={on}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "15px 0",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: fontUi,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>
                    {f.q}
                  </span>
                  <motion.span
                    animate={{ rotate: on ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: "flex", flexShrink: 0 }}
                  >
                    <CaretDown size={15} weight="bold" color="rgba(0,0,0,0.35)" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {on ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ overflow: "hidden" }}
                    >
                      <p
                        style={{
                          margin: "0 0 15px",
                          fontSize: 14,
                          fontWeight: 600,
                          color: C_TEXT_SEC,
                          lineHeight: 1.6,
                        }}
                      >
                        {f.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}

          <p style={{ margin: "22px 0 10px", fontSize: 14, fontWeight: 700, color: C_TEXT_MUTED, textAlign: "center" }}>
            Still stuck? We reply fastest on WhatsApp.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "14px 12px",
                borderRadius: 15,
                background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
                color: C.white,
                fontSize: 14.5,
                fontWeight: 800,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Chat on WhatsApp
            </a>
            <a
              href={`tel:${SUPPORT_PHONE_E164}`}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 12px",
                borderRadius: 15,
                border: `1px solid ${C.border}`,
                background: C.surfaceDeep,
                color: C.text,
                fontSize: 14.5,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              <Phone size={17} weight="fill" color={C.red} />
              Call us
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
