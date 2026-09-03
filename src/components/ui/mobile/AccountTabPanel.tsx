"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  Heart,
  SealCheck,
} from "@phosphor-icons/react";
import { C, C_TEXT_MUTED } from "@/components/ui/mobile/mobile-design-tokens";
import { TYPO } from "@/components/ui/mobile/mobile-typography";
import { loadSavedPlaces, savedPlacesSummary, type SavedPlace } from "@/lib/vk-saved-places";
import { SUPPORT_PHONE_E164, whatsappBotLink } from "@/lib/whatsapp-copy";
import { PwaInstallGuide } from "@/components/ui/PwaInstallGuide";
import { HelpSheet } from "@/components/ui/mobile/HelpSheet";
import { ProfileEditSheet } from "@/components/ui/mobile/ProfileEditSheet";
import { SavedAddressesSheet } from "@/components/ui/mobile/SavedAddressesSheet";
import { PolicySheet } from "@/components/ui/mobile/PolicySheet";
import {
  currentPushState,
  disablePush,
  enablePush,
  sendTestPush,
  type PushState,
} from "@/lib/push-subscribe";
import { REFUND_POLICY, TERMS_POLICY } from "@/lib/policy-copy";
import {
  isAppleTouchDevice,
  isAlreadyInstalled,
  hasNativePrompt,
  triggerNativeInstall,
  subscribePwaInstall,
  isSamsungInternet,
  openInChrome,
} from "@/lib/pwa-install";

const sp = (n: number) => n * 8;

const APP_VERSION = "1.0.0";
const DELIVERY_CITY = process.env.NEXT_PUBLIC_DELIVERY_CITY || "Chennai";

/** The same green "Instant" treatment used on the Vidya Bot tile at home. */
function VerifiedChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px 3px 6px",
        borderRadius: 999,
        background: "rgba(22,163,74,0.18)",
        border: "1px solid rgba(21,128,61,0.45)",
        fontSize: 10,
        fontWeight: 800,
        color: "#14532d",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        lineHeight: 1,
      }}
    >
      <SealCheck size={11} weight="fill" color="#15803d" style={{ flexShrink: 0 }} aria-hidden />
      Verified
    </span>
  );
}

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
  /** Hands off to the full-screen map to place the pin for one saved address. */
  onEditSavedPlace: (place: SavedPlace) => void;
  /** True when returning from the map, so the drawer picks up where it left off. */
  openSavedAddresses?: boolean;
  onOpenOrders: () => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onSignOut?: () => void;
  children?: React.ReactNode;
};

export function AccountTabPanel({
  displayName,
  avatarUrl,
  customerPhone,
  onProfileSaved,
  onEditSavedPlace,
  openSavedAddresses = false,
  onOpenOrders,
  favoritesCount,
  onOpenFavorites,
  onSignOut,
  children,
}: AccountTabPanelProps) {
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [savedSummary, setSavedSummary] = useState("Add the places you order to");
  const [showAddresses, setShowAddresses] = useState(openSavedAddresses);
  const [canInstall, setCanInstall] = useState(false);
  const [isAppleInstall, setIsAppleInstall] = useState(false);
  const [installViaChrome, setInstallViaChrome] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [policy, setPolicy] = useState<"refund" | "terms" | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (openSavedAddresses) setShowAddresses(true);
  }, [openSavedAddresses]);

  useEffect(() => {
    if ((!editing && !showAddresses && !policy) || !mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing, showAddresses, policy, mounted]);

  useEffect(() => {
    const refresh = () => setSavedSummary(savedPlacesSummary(loadSavedPlaces()));
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
      const samsung = isSamsungInternet();
      setInstallViaChrome(samsung);
      setCanInstall(apple || samsung || hasNativePrompt());
    };
    recompute();
    return subscribePwaInstall(recompute);
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (isAppleInstall) {
      setShowIosInstallGuide(true);
      return;
    }
    if (installViaChrome) {
      openInChrome();
      return;
    }
    await triggerNativeInstall();
  }, [isAppleInstall, installViaChrome]);

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
          onClick={() => setShowAddresses(true)}
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

      <Section title="Menu" titleStyle={sectionLabelStyle}>
        <PressRow
          icon={
            <AccountRowIcon>
              <Heart size={20} weight="regular" color={ICON_STROKE} />
            </AccountRowIcon>
          }
          subtitle={
            favoritesCount === 0
              ? "Nothing saved yet"
              : `${favoritesCount} dish${favoritesCount === 1 ? "" : "es"} saved`
          }
          title="Favorites"
          onClick={onOpenFavorites}
        />
      </Section>

      <Section title="Preferences" titleStyle={sectionLabelStyle}>
        <NotificationsRow customerPhone={customerPhone} />
        <PressRow
          icon={
            <AccountRowIcon>
              <IconPhone />
            </AccountRowIcon>
          }
          subtitle={
            <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              {formatInPhone(customerPhone)}
              <VerifiedChip />
            </span>
          }
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
            subtitle={
              installViaChrome
                ? "Samsung's browser can't install it properly — opens in Chrome"
                : "Faster ordering, right from your Home Screen"
            }
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
          href={whatsappBotLink("Hi Vidya's Kitchen! I need help with my order.")}
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
        <PressRow
          icon={
            <AccountRowIcon>
              <IconReceipt />
            </AccountRowIcon>
          }
          subtitle="When we cancel and how refunds work"
          title="Refunds & Cancellations"
          onClick={() => setPolicy("refund")}
        />
        <PressRow
          icon={
            <AccountRowIcon>
              <IconShield />
            </AccountRowIcon>
          }
          subtitle="How we use your data"
          title="Terms & Privacy"
          onClick={() => setPolicy("terms")}
        />
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          fontSize: 12,
          fontWeight: 700,
          color: "rgba(0,0,0,0.42)",
          letterSpacing: "0.01em",
        }}
      >
        Version {APP_VERSION}
        <span aria-hidden style={{ color: "rgba(0,0,0,0.2)" }}>·</span>
        Made with
        <Heart size={12} weight="fill" color={C.red} style={{ flexShrink: 0 }} aria-label="love" />
        in {DELIVERY_CITY}
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
          {showAddresses ? (
            <SavedAddressesSheet
              key="vk-account-addresses"
              onEditPlace={(place) => {
                setShowAddresses(false);
                onEditSavedPlace(place);
              }}
              onClose={() => setShowAddresses(false)}
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

    {mounted &&
      createPortal(
        <AnimatePresence>
          {policy ? (
            <PolicySheet
              key={`vk-account-policy-${policy}`}
              policy={policy === "refund" ? REFUND_POLICY : TERMS_POLICY}
              fullPageHref={policy === "refund" ? "/refund-policy" : "/terms"}
              onClose={() => setPolicy(null)}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/**
 * Push notifications, on or off.
 *
 * WhatsApp gets every update regardless; this is the extra one that lands on
 * the lock screen. The test send exists because otherwise switching this on
 * shows no evidence it worked until an order happens to change state.
 */
function NotificationsRow({ customerPhone }: { customerPhone: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void currentPushState().then(setState);
  }, []);

  const on = state === "on";

  const toggle = useCallback(async () => {
    if (busy || state === null || state === "unsupported") return;
    setBusy(true);
    setNote(null);

    if (on) {
      await disablePush();
      setState("off");
      setBusy(false);
      return;
    }

    const result = await enablePush(customerPhone);
    if (result.ok) {
      setState("on");
      const test = await sendTestPush(customerPhone);
      setNote(test.ok ? "Sent you one just now — check your notifications." : test.error ?? null);
    } else {
      setState(result.state);
      if (result.error) setNote(result.error);
    }
    setBusy(false);
  }, [busy, customerPhone, on, state]);

  const subtitle =
    state === null
      ? "Checking…"
      : state === "unsupported"
        ? "Not available on this browser — updates still go to WhatsApp"
        : state === "blocked"
          ? "Blocked in your browser settings"
          : on
            ? "Order updates on this device, plus WhatsApp"
            : "Get order updates on this device";

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0" }}>
        <AccountRowIcon>
          <IconBell />
        </AccountRowIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...TYPO.bodyMedium, margin: 0, color: C.text }}>Notifications</p>
          <p style={{ ...TYPO.caption, margin: "4px 0 0" }}>{subtitle}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Order notifications on this device"
          disabled={busy || state === null || state === "unsupported" || state === "blocked"}
          onClick={toggle}
          style={{
            position: "relative",
            width: 46,
            height: 28,
            flexShrink: 0,
            borderRadius: 999,
            border: "none",
            padding: 0,
            cursor: busy || state === "unsupported" || state === "blocked" ? "default" : "pointer",
            background: on ? C.red : "rgba(0,0,0,0.16)",
            opacity: state === null || state === "unsupported" || state === "blocked" ? 0.45 : 1,
            transition: "background 0.2s ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: on ? 21 : 3,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: C.white,
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              transition: "left 0.2s ease",
            }}
          />
        </button>
      </div>
      {note ? (
        <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 700, color: C_TEXT_MUTED, lineHeight: 1.5 }}>
          {note}
        </p>
      ) : null}
    </div>
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
  subtitle: React.ReactNode;
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
        <div style={{ ...TYPO.caption, margin: "4px 0 0" }}>{subtitle}</div>
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
