"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
} from "@/components/dashboard/DashboardChrome";
import { DashboardConfirmDialog } from "@/components/dashboard/DashboardConfirmDialog";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import { formatOrderRef } from "@/lib/order-status";

const FONT = "var(--font-outfit), system-ui, sans-serif";

type Review = {
  id: string;
  orderNumber: number | null;
  phone: string | null;
  stars: number | null;
  comment: string | null;
  updatedAt: string | null;
  customerName: string | null;
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

export default function ReviewsPage() {
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

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/reviews?_=${Date.now()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { reviews?: Review[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load reviews");
      setReviews(data.reviews ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reviews");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => window.clearInterval(t);
  }, [load]);

  const q = searchQuery.trim().toLowerCase();
  const shown = (reviews ?? []).filter((r) => {
    if (!q) return true;
    const hay = `${r.customerName || ""} ${r.comment || ""} ${r.phone || ""} ${formatOrderRef(r.orderNumber, r.id)}`.toLowerCase();
    return hay.includes(q);
  });

  const remove = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: pending.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not remove this review");
      setReviews((list) => (list ?? []).filter((r) => r.id !== pending.id));
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove this review");
    } finally {
      setBusy(false);
    }
  };

  const list = reviews == null && !error ? (
    <DashboardSpinner minHeight="240px" />
  ) : (
    <ReviewList reviews={shown} emptyBecauseSearch={Boolean(q) && (reviews?.length ?? 0) > 0} onRemove={setPending} />
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
          <h1 style={titleStyle}>Reviews</h1>
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
          <h1 style={{ ...titleStyle, margin: 0, fontSize: "clamp(16px, 1.5vw, 22px)" }}>Reviews</h1>
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
          }}
        >
          {error ? <p style={errorStyle}>{error}</p> : null}
          {list}
        </div>
      </div>

      <DashboardConfirmDialog
        open={pending != null}
        title="Remove this review?"
        body="It comes off the dashboard and off the dish page. The order itself stays."
        confirmLabel="Remove"
        cancelLabel="Keep review"
        confirmBusyLabel="Removing"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-home-mobile {
            display: flex !important;
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

function ReviewList({
  reviews,
  emptyBecauseSearch,
  onRemove,
}: {
  reviews: Review[];
  emptyBecauseSearch: boolean;
  onRemove: (review: Review) => void;
}) {
  if (reviews.length === 0) {
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
          <Star size={24} color="#F5C518" />
        </div>
        <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 16 }}>
          {emptyBecauseSearch ? "No matching reviews" : "No reviews yet"}
        </p>
        <p style={{ margin: "8px 0 0", color: "#8a8a8a", fontSize: 14, lineHeight: 1.45 }}>
          {emptyBecauseSearch
            ? "Try another name, order number, or word from the comment."
            : "Stars customers leave after a delivery show up here."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {reviews.map((review) => {
        const stars = Math.max(0, Math.min(5, Math.round(Number(review.stars) || 0)));
        return (
          <article
            key={review.id}
            style={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: 16,
              padding: "16px 16px 14px",
              fontFamily: FONT,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
                    {review.customerName || "Customer"}
                  </span>
                  <span style={{ color: "#F5C518", fontWeight: 800, fontSize: 13 }}>
                    {formatOrderRef(review.orderNumber, review.id)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 2, marginTop: 8 }} aria-label={`${stars} of 5 stars`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={16}
                      color="#F5C518"
                      fill={i < stars ? "#F5C518" : "transparent"}
                    />
                  ))}
                </div>
                {review.comment ? (
                  <p style={{ margin: "10px 0 0", color: "#e8e8e8", fontSize: 14, lineHeight: 1.5 }}>
                    {review.comment}
                  </p>
                ) : (
                  <p style={{ margin: "10px 0 0", color: "#6e6e6e", fontSize: 13 }}>No written comment</p>
                )}
                <p style={{ margin: "10px 0 0", color: "#6e6e6e", fontSize: 12 }}>{formatWhen(review.updatedAt)}</p>
              </div>
              <button
                type="button"
                aria-label="Remove review"
                onClick={() => onRemove(review)}
                style={{
                  flex: "0 0 auto",
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid #3a2424",
                  background: "#241616",
                  color: "#ff8a80",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const titleStyle = {
  margin: "0 0 16px",
  fontSize: 22,
  fontWeight: 800,
  color: "#ffffff",
  fontFamily: FONT,
  letterSpacing: "-0.02em",
} as const;

const errorStyle = {
  margin: "0 0 12px",
  color: "#ff8a80",
  fontFamily: FONT,
  fontSize: 14,
} as const;
