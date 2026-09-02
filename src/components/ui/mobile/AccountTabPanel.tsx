"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, 
  ClockCounterClockwise, 
  Bell, 
  Phone, 
  ShieldCheck, 
  CaretRight,
  PencilSimple,
  DownloadSimple,
  Question,
  Receipt,
} from "@phosphor-icons/react";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { TYPO } from "@/components/ui/mobile/mobile-typography";
import { loadSavedPlaces } from "@/lib/vk-saved-places";
import { SUPPORT_PHONE_E164 } from "@/lib/whatsapp-copy";
import { PwaInstallGuide } from "@/components/ui/PwaInstallGuide";
import { HelpSheet } from "@/components/ui/mobile/HelpSheet";
import { ProfileEditSheet } from "@/components/ui/mobile/ProfileEditSheet";
import {
  isAppleTouchDevice,
  isAlreadyInstalled,
  hasNativePrompt,
  triggerNativeInstall,
  subscribePwaInstall,
} from "@/lib/pwa-install";

const sp = (n: number) => n * 8;

const ICON_STROKE = C.red;

function AccountRowIcon({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: "rgba(189,35,32,0.12)",
        border: "1px solid rgba(189,35,32,0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function IconMapPin() {
  return <MapPin size={20} weight="regular" color={ICON_STROKE} />;
}

function IconHistory() {
  return <ClockCounterClockwise size={20} weight="regular" color={ICON_STROKE} />;
}

function IconQuestion() {
  return <Question size={20} weight="regular" color={ICON_STROKE} />;
}

function IconReceipt() {
  return <Receipt size={20} weight="regular" color={ICON_STROKE} />;
}

function IconBell() {
  return <Bell size={20} weight="regular" color={ICON_STROKE} />;
}

function IconPhone() {
  return <Phone size={20} weight="regular" color={ICON_STROKE} />;
}

function IconWhatsApp() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#BD2320"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.43 1.32 4.93L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.12l-.3-.18-3.12.82.84-3.04-.2-.31a8.182 8.182 0 01-1.27-4.4c-.01-4.54 3.7-8.24 8.23-8.24m-3.52 2.66c-.16 0-.43.06-.66.23-.23.17-.87.85-.87 2.06 0 1.22.89 2.39 1 2.56.12.17 1.76 2.68 4.22 3.78 2.46 1.1 2.46.73 2.9.69.45-.04 1.45-.59 1.66-1.16.21-.57.21-1.07.15-1.18-.06-.1-.23-.16-.47-.28-.24-.13-1.45-.71-1.67-.79-.22-.08-.38-.12-.54.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.13-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.54-1.3-.74-1.78-.2-.48-.41-.42-.54-.43-.14-.01-.29-.01-.44-.01z"
      />
    </svg>
  );
}

function IconShield() {
  return <ShieldCheck size={20} weight="regular" color={ICON_STROKE} />;
}

function IconDownload() {
  return <DownloadSimple size={20} weight="regular" color={ICON_STROKE} />;
}

function ChevronRight() {
  return <CaretRight size={16} weight="bold" color="rgba(0,0,0,0.25)" />;
}

function formatInPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 10) {
    const tail = d.slice(-10);
    return `+91 ${tail.slice(0, 5)} ${tail.slice(5)}`;
  }
  return phone || "—";
}

type AccountTabPanelProps = {
  displayName: string;
  avatarUrl?: string | null;
  customerPhone: string;
  onProfileSaved: (profile: { name: string; avatarUrl: string | null }) => void;
  onSavedAddresses: () => void;
  onOpenOrders: () => void;
  onSignOut?: () => void;
  children?: React.ReactNode;
};

export function AccountTabPanel({
  displayName,
  avatarUrl,
  customerPhone,
  onProfileSaved,
  onSavedAddresses,
  onOpenOrders,
  onSignOut,
  children,
}: AccountTabPanelProps) {
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [savedSummary, setSavedSummary] = useState("Home, Work, Other");
  const [canInstall, setCanInstall] = useState(false);
  const [isAppleInstall, setIsAppleInstall] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editing || !mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing, mounted]);

  useEffect(() => {
    const refresh = () => {
      const places = loadSavedPlaces();
      const labels = places.map((p) => p.label).join(", ");
      setSavedSummary(labels);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("vk_saved_places_updated", refresh as EventListener);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("vk_saved_places_updated", refresh as EventListener);
    };
  }, []);

  useEffect(() => {
    const recompute = () => {
      if (isAlreadyInstalled()) {
        setCanInstall(false);
        return;
      }
      const apple = isAppleTouchDevice();
      setIsAppleInstall(apple);
      setCanInstall(apple || hasNativePrompt());
    };
    recompute();
    return subscribePwaInstall(recompute);
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (isAppleInstall) {
      setShowIosInstallGuide(true);
      return;
    }
    await triggerNativeInstall();
  }, [isAppleInstall]);

  const firstInitial = (displayName.trim().charAt(0) || "?").toUpperCase();

  const sectionLabelStyle: CSSProperties = {
    ...TYPO.eyebrow,
    margin: "0 0 8px",
    color: "rgba(0,0,0,0.4)",
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ flex: 1, paddingTop: sp(0.5), paddingBottom: sp(1) }}
    >
      <div
        style={{
          padding: "4px 0 14px",
          marginBottom: sp(1.5),
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.white,
            fontWeight: 900,
            fontSize: 22,
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: `0 4px 14px ${C.redGlow}`,
          }}
        >
          {avatarUrl ? (
            // Supabase Storage host, served straight rather than through
            // next/image, so a changed photo shows up without a rebuild.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            firstInitial
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...TYPO.cardTitle, margin: 0 }}>{displayName.trim() || "Guest"}</p>
          <p style={{ ...TYPO.bodySm, margin: "4px 0 0" }}>{formatInPhone(customerPhone)}</p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          aria-label="Edit profile"
          onClick={() => setEditing(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: "rgba(0,0,0,0.7)",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: C.mono,
          }}
        >
          Edit
          <PencilSimple size={12} weight="bold" color="currentColor" />
        </motion.button>
      </div>

      <Section title="Delivery" titleStyle={sectionLabelStyle}>
        <PressRow
          icon={
            <AccountRowIcon>
              <IconMapPin />
            </AccountRowIcon>
          }
          subtitle={savedSummary}
          title="Saved Addresses"
          onClick={onSavedAddresses}
        />
        <PressRow
          icon={
            <AccountRowIcon>
              <IconHistory />
            </AccountRowIcon>
          }
          subtitle="View All Past Orders"
          title="Order History"
          onClick={onOpenOrders}
        />
      </Section>

      <Section title="Preferences" titleStyle={sectionLabelStyle}>
        <PressRow
          icon={
            <AccountRowIcon>
              <IconBell />
            </AccountRowIcon>
          }
          subtitle="Order updates are sent to your WhatsApp"
          title="Notifications"
          showChevron={false}
        />
        <PressRow
          icon={
            <AccountRowIcon>
              <IconPhone />
            </AccountRowIcon>
          }
          subtitle={`${formatInPhone(customerPhone)} · Verified`}
          title="WhatsApp Number"
          showChevron={false}
        />
        {canInstall && (
          <PressRow
            icon={
              <AccountRowIcon>
                <IconDownload />
              </AccountRowIcon>
            }
            subtitle="Faster ordering, right from your Home Screen"
            title="Install App"
            onClick={handleInstallApp}
          />
        )}
      </Section>

      <Section title="Help & support" titleStyle={sectionLabelStyle}>
        <PressRow
          icon={
            <AccountRowIcon>
              <IconQuestion />
            </AccountRowIcon>
          }
          subtitle="Delivery, cancellations, cash on delivery"
          title="Common Questions"
          onClick={() => setShowHelp(true)}
        />
        <a
          href={`https://wa.me/${SUPPORT_PHONE_E164.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <PressRow
            icon={
              <AccountRowIcon>
                <IconWhatsApp />
              </AccountRowIcon>
            }
            subtitle="Fastest way to reach the kitchen"
            title="Chat On WhatsApp"
            showChevron
          />
        </a>
        <a href={`tel:${SUPPORT_PHONE_E164}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <PressRow
            icon={
              <AccountRowIcon>
                <IconPhone />
              </AccountRowIcon>
            }
            subtitle={formatInPhone(SUPPORT_PHONE_E164)}
            title="Call The Kitchen"
            showChevron
          />
        </a>
        <Link href="/refund-policy" prefetch={false} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <PressRow
            icon={
              <AccountRowIcon>
                <IconReceipt />
              </AccountRowIcon>
            }
            subtitle="When we cancel and how refunds work"
            title="Refunds & Cancellations"
            showChevron
          />
        </Link>
        <Link href="/terms" prefetch={false} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <PressRow
            icon={
              <AccountRowIcon>
                <IconShield />
              </AccountRowIcon>
            }
            subtitle="How We Use Your Data"
            title="Terms & Privacy"
            showChevron
          />
        </Link>
      </Section>

      {children}

      {onSignOut ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onSignOut}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: sp(1.5),
            padding: "14px 16px",
            borderRadius: 14,
            border: "none",
            background: `linear-gradient(135deg, ${C.red} 0%, #8B1A18 100%)`,
            color: C.white,
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: C.mono,
          }}
        >
          Log Out
        </motion.button>
      ) : null}

      <p
        style={{
          margin: `${sp(2)}px 0 0`,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(0,0,0,0.28)",
          letterSpacing: "0.02em",
        }}
      >
        Version 1.0.0 · Made with ❤️ in Chennai
      </p>
    </motion.div>

    {mounted &&
      createPortal(
        <AnimatePresence>
          {editing ? (
            <ProfileEditSheet
              key="vk-account-profile-sheet"
              phone={customerPhone}
              initialName={displayName}
              initialAvatarUrl={avatarUrl ?? null}
              onSaved={onProfileSaved}
              onClose={() => setEditing(false)}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}

    {mounted &&
      createPortal(
        <AnimatePresence>
          {showIosInstallGuide && (
            <PwaInstallGuide key="vk-account-ios-guide" onClose={() => setShowIosInstallGuide(false)} />
          )}
        </AnimatePresence>,
        document.body,
      )}

    {mounted &&
      createPortal(
        <AnimatePresence>
          {showHelp && <HelpSheet key="vk-account-help" onClose={() => setShowHelp(false)} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function Section({ title, titleStyle, children: ch }: { title: string; titleStyle?: CSSProperties; children: React.ReactNode }) {
  const labelStyle: CSSProperties = titleStyle ?? {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "rgba(0,0,0,0.4)",
  };
  return (
    <div style={{ marginBottom: sp(1.5) }}>
      <p style={labelStyle}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column" }}>{ch}</div>
    </div>
  );
}

function PressRow({
  icon,
  title,
  subtitle,
  onClick,
  showChevron,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  /** When false, no chevron (static row). Default: true if onClick is set. */
  showChevron?: boolean;
}) {
  const chevron = showChevron ?? Boolean(onClick);
  const rowInner = (
    <>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...TYPO.bodyMedium, margin: 0, color: C.text }}>{title}</p>
        <p style={{ ...TYPO.caption, margin: "4px 0 0" }}>{subtitle}</p>
      </div>
      {chevron ? <ChevronRight /> : null}
    </>
  );
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 0",
    border: "none",
    borderRadius: 0,
    borderBottom: `1px solid ${C.border}`,
    background: "transparent",
    textAlign: "left",
    fontFamily: C.mono,
  };
  if (onClick) {
    return (
      <motion.button type="button" whileTap={{ scale: 0.99 }} onClick={onClick} style={{ ...baseStyle, cursor: "pointer" }}>
        {rowInner}
      </motion.button>
    );
  }
  return <div style={baseStyle}>{rowInner}</div>;
}
