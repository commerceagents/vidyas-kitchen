"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareWarning } from "lucide-react";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
} from "@/components/dashboard/DashboardChrome";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import { formatPhoneDisplay } from "@/lib/dashboard/orders";

const FONT = "var(--font-outfit), system-ui, sans-serif";

type Complaint = {
  id: string;
  phone: string | null;
  body: string | null;
  target: string | null;
  note: string | null;
  createdAt: string | null;
  customerName: string | null;
};

const SAMPLE_COMPLAINT: Complaint = {
  id: "sample-complaint",
  phone: null,
  body: null,
  target: "#00003 · Dinner · 7 Oct\nMom's Recipe Chicken Gravy · 500gm",
  note: "The gravy was cold when it reached me.",
  createdAt: "2026-10-07T02:10:00+05:30",
  customerName: "Sample guest",
};

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ComplaintsPage() {
  const router = useRouter();
  const {
    unreadCount,
    soundMuted,
    setSoundMuted,
    openNotifications,
    newCount,
    month,
    setMonth,
    searchQuery,
    setSearchQuery,
  } = useDashboardData();

  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/complaints?_=${Date.now()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { complaints?: Complaint[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load complaints");
      setComplaints(data.complaints ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load complaints");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const leave = () => {
      if (mq.matches) router.replace("/dashboard");
    };
    leave();
    mq.addEventListener("change", leave);
    return () => mq.removeEventListener("change", leave);
  }, [router]);

  const q = searchQuery.trim().toLowerCase();
  const shown = (complaints ?? []).filter((row) => {
    if (!q) return true;
    const hay = `${row.customerName || ""} ${row.target || ""} ${row.note || ""} ${row.body || ""} ${row.phone || ""}`.toLowerCase();
    return hay.includes(q);
  });

  const preview = !q && (complaints?.length ?? 0) === 0 && !error;
  const rows = preview ? [SAMPLE_COMPLAINT] : shown;

  const list =
    complaints == null && !error ? (
      <DashboardSpinner minHeight="240px" />
    ) : (
      <ComplaintList complaints={rows} emptyBecauseSearch={Boolean(q) && (complaints?.length ?? 0) > 0} />
    );

  return (
    <>
      <div
        className="vk-dash-home-mobile"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          minHeight: "100dvh",
          background: "#0d0d0d",
        }}
      >
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
          unreadCount={unreadCount}
          onOpenNotifications={openNotifications}
        />
        <div
          style={{
            padding: "16px",
            overflowY: "auto",
            flex: 1,
            paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <h1 style={titleStyle}>Complaints</h1>
          <p style={hintStyle}>
            Notes from Something wrong on WhatsApp. Star ratings stay on{" "}
            <Link href="/dashboard/reviews" style={linkStyle}>
              Reviews
            </Link>
            .
          </p>
          {error ? <p style={errorStyle}>{error}</p> : null}
          {list}
        </div>
        <DashboardMobileNav />
      </div>

      <div
        className="vk-dash-home-desktop"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          gap: "clamp(12px, 1.5vw, 20px)",
          background: "#0d0d0d",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#141414",
            borderRadius: "clamp(14px, 1.5vw, 20px)",
            padding: "clamp(12px, 1.5vh, 16px) clamp(16px, 1.5vw, 24px)",
            border: "1px solid #222222",
            flex: "0 0 auto",
          }}
        >
          <h1 style={{ ...titleStyle, margin: 0, fontSize: "clamp(16px, 1.5vw, 22px)" }}>Complaints</h1>
          <DashboardDesktopTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
            unreadCount={unreadCount}
            onOpenNotifications={openNotifications}
            hideSearchAndMonth={false}
          />
        </div>
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            background: "#141414",
            borderRadius: "clamp(14px, 1.5vw, 20px)",
            border: "1px solid #222222",
            padding: "clamp(16px, 1.5vw, 24px)",
            display: "flex",
            alignItems: "center",
            justifyContent: (complaints?.length ?? 0) > 1 ? "flex-start" : "center",
          }}
        >
          <div style={{ width: "min(520px, 100%)", margin: "0 auto" }}>
            {error ? <p style={errorStyle}>{error}</p> : null}
            {list}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-home-mobile {
            display: none !important;
          }
          .vk-dash-home-desktop {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .vk-dash-home-mobile {
            display: none !important;
          }
          .vk-dash-home-desktop {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}

function ComplaintList({
  complaints,
  emptyBecauseSearch,
}: {
  complaints: Complaint[];
  emptyBecauseSearch: boolean;
}) {
  if (complaints.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 16px", fontFamily: FONT }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 14px",
            borderRadius: 16,
            background: "#1c1c1c",
            border: "1px solid #2a2a2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageSquareWarning size={24} color="#F5C518" />
        </div>
        <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 16 }}>
          {emptyBecauseSearch ? "No matching complaints" : "No complaints yet"}
        </p>
        <p style={{ margin: "8px 0 0", color: "#8a8a8a", fontSize: 14, lineHeight: 1.45 }}>
          {emptyBecauseSearch
            ? "Try another name, phone, or word from the note."
            : "When a customer taps Something wrong, picks the order, and writes what happened, it shows up here."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {complaints.map((row) => {
        const sample = row.id === "sample-complaint";
        return (
          <article
            key={row.id}
            style={{
              width: "100%",
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: 16,
              padding: "22px 22px 18px",
              fontFamily: FONT,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
                {row.customerName || "Customer"}
              </span>
              {sample ? (
                <span style={{ color: "#F5C518", fontWeight: 800, fontSize: 12, letterSpacing: "0.04em" }}>SAMPLE</span>
              ) : (
                <span style={{ color: "#8a8a8a", fontSize: 13 }}>{formatPhoneDisplay(row.phone)}</span>
              )}
            </div>
            {row.target ? (
              <p style={{ margin: "12px 0 0", color: "#F5C518", fontWeight: 800, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                {row.target}
              </p>
            ) : null}
            <p style={{ margin: "12px 0 0", color: "#e8e8e8", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {row.note || row.body || "No message"}
            </p>
            <p style={{ margin: "12px 0 0", color: "#6e6e6e", fontSize: 12 }}>{formatWhen(row.createdAt)}</p>
          </article>
        );
      })}
    </div>
  );
}

const titleStyle = {
  margin: "0 0 8px",
  fontSize: 22,
  fontWeight: 800,
  color: "#ffffff",
  fontFamily: FONT,
  letterSpacing: "-0.02em",
} as const;

const hintStyle = {
  margin: "0 0 16px",
  color: "#8a8a8a",
  fontFamily: FONT,
  fontSize: 13,
  lineHeight: 1.45,
} as const;

const linkStyle = {
  color: "#F5C518",
  fontWeight: 700,
} as const;

const errorStyle = {
  margin: "0 0 12px",
  color: "#ff8a80",
  fontFamily: FONT,
  fontSize: 14,
} as const;
