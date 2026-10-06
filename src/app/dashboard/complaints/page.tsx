"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, Flag, IndianRupee, MessageSquareWarning, Phone, RotateCcw, Truck } from "lucide-react";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
} from "@/components/dashboard/DashboardChrome";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";
import { useToast } from "@/components/dashboard/DashboardToast";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import { formatPhoneDisplay } from "@/lib/dashboard/orders";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  type ComplaintCard,
  type ComplaintCategory,
  type ComplaintDriverFlag,
  type ComplaintRefund,
  type ComplaintSort,
  type ComplaintStatus,
  complaintStats,
  sortComplaints,
  telHref,
} from "@/lib/complaint-triage";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#F5C518";

const CATEGORIES: ComplaintCategory[] = ["cold_food", "wrong_item", "late_delivery", "rude_behavior", "other"];

const SAMPLE: ComplaintCard = {
  id: "sample-complaint",
  sample: true,
  phone: null,
  customerName: "Sample guest",
  createdAt: "2026-10-07T02:10:00+05:30",
  orderRef: "#00003",
  orderNumber: 3,
  whenLine: "Dinner · 7 Oct",
  dishLine: "Mom's Recipe Chicken Gravy · 500gm",
  note: "The gravy was cold when it reached me.",
  imageUrl: "https://vidyaskitchenhome.com/menu-images/chk-mom-gravy.jpg",
  totalAmount: 421,
  driverName: "Sample driver",
  category: "cold_food",
  deliveryRelated: true,
  status: "new",
  resolvedAt: null,
  refund: null,
  driverFlag: null,
  canRefundMoney: false,
};

type StatusFilter = "all" | ComplaintStatus;
type CategoryFilter = "all" | ComplaintCategory;
type ModalState = { kind: "refund" | "flag"; card: ComplaintCard } | null;
type SamplePreview = {
  status: ComplaintStatus;
  resolvedAt: string | null;
  refund: ComplaintRefund | null;
  driverFlag: ComplaintDriverFlag | null;
};

function rupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function matchesQuery(row: ComplaintCard, query: string): boolean {
  if (!query) return true;
  const hay = [
    row.customerName,
    row.phone,
    row.orderRef,
    row.whenLine,
    row.dishLine,
    row.note,
    row.driverName,
    CATEGORY_LABEL[row.category],
    STATUS_LABEL[row.status],
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

export default function ComplaintsPage() {
  const router = useRouter();
  const { show } = useToast();
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

  const [complaints, setComplaints] = useState<ComplaintCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<ComplaintSort>("newest");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [preview, setPreview] = useState<SamplePreview>({
    status: "new",
    resolvedAt: null,
    refund: null,
    driverFlag: null,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/complaints?_=${Date.now()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { complaints?: ComplaintCard[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load complaints");
      setComplaints(data.complaints ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load complaints");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => window.clearInterval(timer);
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

  const query = searchQuery.trim().toLowerCase();
  const real = complaints ?? [];
  const showingSample = real.length === 0 && !error && !query && complaints != null;
  const sampleCard: ComplaintCard = showingSample ? { ...SAMPLE, ...preview } : SAMPLE;
  const source = showingSample ? [sampleCard] : real;
  const filtered = source.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
    return matchesQuery(row, query);
  });
  const rows = sortComplaints(filtered, sort);
  const stats = complaintStats(showingSample ? [sampleCard] : real);

  const applySample = (patch: (current: SamplePreview) => SamplePreview, message: string) => {
    setPreview(patch);
    setModal(null);
    show(`${message} This sample is not saved.`, "info");
  };

  const save = async (card: ComplaintCard, body: Record<string, unknown>, okMessage?: string) => {
    if (card.sample) return;
    setSavingId(card.id);
    try {
      const res = await fetch("/api/dashboard/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save that change");
      show(okMessage || data.message || "Saved.", "success");
      setModal(null);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Could not save that change", "error");
    } finally {
      setSavingId(null);
    }
  };

  const onStatus = (card: ComplaintCard, status: ComplaintStatus) => {
    if (card.sample) {
      applySample(
        (current) => ({
          ...current,
          status,
          resolvedAt: status === "resolved" ? new Date().toISOString() : null,
        }),
        status === "resolved" ? "Marked resolved." : status === "in_progress" ? "Moved to in progress." : "Reopened.",
      );
      return;
    }
    void save(card, { action: "status", status });
  };

  const onRefund = (card: ComplaintCard, amount: string, reason: string) => {
    if (card.sample) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0 || reason.trim().length < 3) {
        show("Enter an amount and a short reason.", "error");
        return;
      }
      applySample(
        (current) => ({
          ...current,
          status: current.status === "new" ? "in_progress" : current.status,
          refund: { amount: value, reason: reason.trim(), mode: "credit", at: new Date().toISOString() },
        }),
        "Credit preview added.",
      );
      return;
    }
    void save(card, { action: "refund", amount, reason });
  };

  const onFlag = (card: ComplaintCard, note: string) => {
    if (card.sample) {
      if (note.trim().length < 3) {
        show("Add a short note about the driver.", "error");
        return;
      }
      applySample(
        (current) => ({
          ...current,
          status: current.status === "new" ? "in_progress" : current.status,
          driverFlag: { driverName: card.driverName || "Sample driver", note: note.trim(), at: new Date().toISOString() },
        }),
        "Driver flag preview added.",
      );
      return;
    }
    void save(card, { action: "flag", note });
  };

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(formatPhoneDisplay(phone));
      show("Number copied.", "success");
    } catch {
      show("Could not copy that number.", "error");
    }
  };

  const workspace =
    complaints == null && !error ? (
      <DashboardSpinner minHeight="240px" />
    ) : (
      <ComplaintWorkspace
        rows={rows}
        stats={stats}
        error={error}
        showingSample={showingSample}
        emptyBecauseSearch={Boolean(query) || statusFilter !== "all" || categoryFilter !== "all"}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        sort={sort}
        savingId={savingId}
        onStatusFilter={setStatusFilter}
        onCategoryFilter={setCategoryFilter}
        onSort={setSort}
        onStatus={onStatus}
        onOpenRefund={(card) => setModal({ kind: "refund", card })}
        onOpenFlag={(card) => setModal({ kind: "flag", card })}
        onCopyPhone={(phone) => void copyPhone(phone)}
      />
    );

  return (
    <>
      <div className="vk-dash-home-mobile" style={mobileShell}>
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
          unreadCount={unreadCount}
          onOpenNotifications={openNotifications}
        />
        <div style={mobileScroll}>
          <h1 style={titleStyle}>Complaints</h1>
          <p style={hintStyle}>
            Notes from Something wrong on WhatsApp. Star ratings stay on{" "}
            <Link href="/dashboard/reviews" style={linkStyle}>
              Reviews
            </Link>
            .
          </p>
          {workspace}
        </div>
        <DashboardMobileNav />
      </div>

      <div className="vk-dash-home-desktop" style={desktopShell}>
        <div style={desktopHeader}>
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
        <div className="no-scrollbar" style={desktopPanel}>
          {workspace}
        </div>
      </div>

      {modal ? (
        <ActionModal
          modal={modal}
          busy={savingId === modal.card.id}
          onClose={() => {
            if (savingId) return;
            setModal(null);
          }}
          onRefund={onRefund}
          onFlag={onFlag}
        />
      ) : null}

      <style jsx global>{`
        @media (max-width: 1023px) {
          .vk-dash-home-mobile,
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
        .vk-complaint-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 1280px) {
          .vk-complaint-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </>
  );
}

function ComplaintWorkspace({
  rows,
  stats,
  error,
  showingSample,
  emptyBecauseSearch,
  statusFilter,
  categoryFilter,
  sort,
  savingId,
  onStatusFilter,
  onCategoryFilter,
  onSort,
  onStatus,
  onOpenRefund,
  onOpenFlag,
  onCopyPhone,
}: {
  rows: ComplaintCard[];
  stats: { fresh: number; progress: number; resolved: number; response: string };
  error: string | null;
  showingSample: boolean;
  emptyBecauseSearch: boolean;
  statusFilter: StatusFilter;
  categoryFilter: CategoryFilter;
  sort: ComplaintSort;
  savingId: string | null;
  onStatusFilter: (value: StatusFilter) => void;
  onCategoryFilter: (value: CategoryFilter) => void;
  onSort: (value: ComplaintSort) => void;
  onStatus: (card: ComplaintCard, status: ComplaintStatus) => void;
  onOpenRefund: (card: ComplaintCard) => void;
  onOpenFlag: (card: ComplaintCard) => void;
  onCopyPhone: (phone: string) => void;
}) {
  const statCards = [
    { id: "new" as const, label: "New", value: String(stats.fresh), color: "#ff8a80" },
    { id: "in_progress" as const, label: "In Progress", value: String(stats.progress), color: "#7dd3fc" },
    { id: "resolved" as const, label: "Resolved (30d)", value: String(stats.resolved), color: "#86efac" },
    { id: "response" as const, label: "Avg response", value: stats.response, color: YELLOW },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {error ? <p style={errorStyle}>{error}</p> : null}
      <div className="vk-complaint-stats">
        {statCards.map((card) => {
          const active = card.id !== "response" && statusFilter === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (card.id === "response") return;
                onStatusFilter(statusFilter === card.id ? "all" : card.id);
              }}
              aria-pressed={active}
              style={{
                ...statButton,
                borderColor: active ? YELLOW : "#2a2a2a",
                cursor: card.id === "response" ? "default" : "pointer",
              }}
            >
              <span style={{ color: "#8a8a8a", fontSize: 12, fontWeight: 700 }}>{card.label}</span>
              <span style={{ color: card.color, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>{card.value}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={chipRow}>
          <FilterChip active={statusFilter === "all"} onClick={() => onStatusFilter("all")}>
            All
          </FilterChip>
          {(["new", "in_progress", "resolved"] as const).map((status) => (
            <FilterChip
              key={status}
              active={statusFilter === status}
              onClick={() => onStatusFilter(statusFilter === status ? "all" : status)}
            >
              {STATUS_LABEL[status]}
            </FilterChip>
          ))}
        </div>
        <div style={{ ...chipRow, justifyContent: "space-between" }}>
          <div style={chipRow}>
            <FilterChip active={categoryFilter === "all"} onClick={() => onCategoryFilter("all")}>
              All types
            </FilterChip>
            {CATEGORIES.map((category) => (
              <FilterChip
                key={category}
                active={categoryFilter === category}
                onClick={() => onCategoryFilter(categoryFilter === category ? "all" : category)}
              >
                {CATEGORY_LABEL[category]}
              </FilterChip>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8a8a", fontSize: 12, fontFamily: FONT }}>
            Sort
            <select
              value={sort}
              onChange={(event) => onSort(event.target.value as ComplaintSort)}
              style={selectStyle}
            >
              <option value="newest">Newest first</option>
              <option value="oldest_unresolved">Oldest unresolved first</option>
            </select>
          </label>
        </div>
      </div>

      {showingSample && rows.some((row) => row.sample) ? (
        <p style={{ margin: 0, color: "#8a8a8a", fontSize: 13, fontFamily: FONT }}>
          Sample card, so you can see the layout. It disappears when a real complaint arrives.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyComplaints filtered={emptyBecauseSearch} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((row) => (
            <ComplaintRow
              key={row.id}
              row={row}
              busy={savingId === row.id}
              onStatus={onStatus}
              onOpenRefund={onOpenRefund}
              onOpenFlag={onOpenFlag}
              onCopyPhone={onCopyPhone}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 999,
        padding: "7px 12px",
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        background: active ? YELLOW : "#1c1c1c",
        color: active ? "#111" : "#cfcfcf",
      }}
    >
      {children}
    </button>
  );
}

function EmptyComplaints({ filtered }: { filtered: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", fontFamily: FONT }}>
      <div style={emptyIcon}>
        <MessageSquareWarning size={24} color={YELLOW} />
      </div>
      <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 16 }}>
        {filtered ? "No matching complaints" : "No complaints yet"}
      </p>
      <p style={{ margin: "8px 0 0", color: "#8a8a8a", fontSize: 14, lineHeight: 1.45 }}>
        {filtered
          ? "Try another status, type, or search."
          : "When a customer taps Something wrong, picks the order, and writes what happened, it shows up here."}
      </p>
    </div>
  );
}

function ComplaintRow({
  row,
  busy,
  onStatus,
  onOpenRefund,
  onOpenFlag,
  onCopyPhone,
}: {
  row: ComplaintCard;
  busy: boolean;
  onStatus: (card: ComplaintCard, status: ComplaintStatus) => void;
  onOpenRefund: (card: ComplaintCard) => void;
  onOpenFlag: (card: ComplaintCard) => void;
  onCopyPhone: (phone: string) => void;
}) {
  const call = telHref(row.phone);
  const ticket = [row.orderRef, row.whenLine].filter(Boolean).join(" · ");
  return (
    <article
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 16,
        padding: 16,
        fontFamily: FONT,
        display: "grid",
        gridTemplateColumns: "72px 1fr",
        gap: 14,
        opacity: busy ? 0.7 : 1,
      }}
    >
      <DishThumb src={row.imageUrl} alt={row.dishLine || "Dish"} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{row.customerName || "Customer"}</span>
              {row.sample ? <span style={sampleChip}>SAMPLE</span> : null}
              {row.phone ? (
                <button type="button" onClick={() => onCopyPhone(row.phone || "")} style={phoneButton}>
                  {formatPhoneDisplay(row.phone)}
                </button>
              ) : (
                <span style={{ color: "#6e6e6e", fontSize: 13 }}>No phone</span>
              )}
            </div>
            {ticket ? <p style={{ margin: "6px 0 0", color: "#cfcfcf", fontSize: 13 }}>{ticket}</p> : null}
            {row.dishLine ? (
              <p style={{ margin: "4px 0 0", color: YELLOW, fontWeight: 800, fontSize: 14, whiteSpace: "pre-wrap" }}>{row.dishLine}</p>
            ) : null}
          </div>
          <StatusBadge status={row.status} />
        </div>

        <p style={{ margin: "10px 0 0", color: "#e8e8e8", fontSize: 14, lineHeight: 1.5 }}>“{row.note || "No message"}”</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
          <span style={categoryPill}>{CATEGORY_LABEL[row.category]}</span>
          {row.driverName ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#cfcfcf", fontSize: 12 }}>
              <Truck size={14} color="#8a8a8a" />
              {row.driverName}
            </span>
          ) : null}
        </div>

        <p style={{ margin: "10px 0 0", color: "#8a8a8a", fontSize: 12 }}>
          {formatWhen(row.createdAt)}
          {row.totalAmount != null ? ` · ${rupees(row.totalAmount)}` : ""}
        </p>

        {row.refund ? (
          <p style={{ margin: "8px 0 0", color: "#86efac", fontSize: 12 }}>
            {row.refund.mode === "razorpay" ? "Refund sent" : "Kitchen credit"} {rupees(row.refund.amount)} · {row.refund.reason}
          </p>
        ) : null}
        {row.driverFlag ? (
          <p style={{ margin: "6px 0 0", color: "#fbbf24", fontSize: 12 }}>
            Flag on {row.driverFlag.driverName}: {row.driverFlag.note}
          </p>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {call ? (
            <a href={call} style={actionLink}>
              <Phone size={14} /> Call customer
            </a>
          ) : (
            <button type="button" disabled style={{ ...actionButton, opacity: 0.4, cursor: "default" }}>
              <Phone size={14} /> Call customer
            </button>
          )}
          {row.status === "new" ? (
            <button type="button" disabled={busy} onClick={() => onStatus(row, "in_progress")} style={actionButton}>
              <Clock size={14} /> In progress
            </button>
          ) : null}
          {row.status !== "resolved" ? (
            <button type="button" disabled={busy} onClick={() => onStatus(row, "resolved")} style={primaryButton}>
              <Check size={14} /> Mark resolved
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => onStatus(row, "new")} style={actionButton}>
              <RotateCcw size={14} /> Reopen
            </button>
          )}
          <button type="button" disabled={busy || Boolean(row.refund)} onClick={() => onOpenRefund(row)} style={actionButton}>
            <IndianRupee size={14} /> {row.refund ? "Refund noted" : "Refund / credit"}
          </button>
          {row.deliveryRelated ? (
            <button
              type="button"
              disabled={busy || !row.driverName}
              title={row.driverName ? "Save a note on this driver" : "No driver on this order"}
              onClick={() => onOpenFlag(row)}
              style={{ ...actionButton, opacity: row.driverName ? 1 : 0.4, cursor: row.driverName ? "pointer" : "default" }}
            >
              <Flag size={14} /> {row.driverFlag ? "Update flag" : "Flag driver"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ComplaintStatus }) {
  const tone =
    status === "resolved"
      ? { color: "#86efac", background: "rgba(34,197,94,0.12)" }
      : status === "in_progress"
        ? { color: "#7dd3fc", background: "rgba(56,189,248,0.12)" }
        : { color: "#ff8a80", background: "rgba(239,68,68,0.14)" };
  return (
    <span
      style={{
        ...tone,
        borderRadius: 999,
        padding: "5px 10px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.03em",
        flexShrink: 0,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function DishThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={thumbPlaceholder}>Dish</div>;
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover", background: "#111" }}
    />
  );
}

function ActionModal({
  modal,
  busy,
  onClose,
  onRefund,
  onFlag,
}: {
  modal: { kind: "refund" | "flag"; card: ComplaintCard };
  busy: boolean;
  onClose: () => void;
  onRefund: (card: ComplaintCard, amount: string, reason: string) => void;
  onFlag: (card: ComplaintCard, note: string) => void;
}) {
  const [amount, setAmount] = useState(modal.card.totalAmount != null ? String(modal.card.totalAmount) : "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(modal.card.driverFlag?.note || "");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refundCopy = modal.card.sample
    ? "This is the sample card. Nothing is charged."
    : modal.card.canRefundMoney
      ? "This sends the amount back through Razorpay to the original payment, up to the order total."
      : "This order was not paid online. The amount is saved as a kitchen credit. No money is sent to a bank.";

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 40,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complaint-action-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "#161616",
          border: "1px solid #2a2a2a",
          borderRadius: 18,
          padding: 20,
          fontFamily: FONT,
        }}
      >
        <h2 id="complaint-action-title" style={{ margin: 0, color: "#fff", fontSize: 18 }}>
          {modal.kind === "refund" ? "Refund or credit" : `Flag ${modal.card.driverName || "driver"}`}
        </h2>
        <p style={{ margin: "8px 0 0", color: "#8a8a8a", fontSize: 13, lineHeight: 1.45 }}>
          {modal.kind === "refund" ? refundCopy : "This note stays on the driver so a repeat problem is easy to see."}
        </p>
        {modal.kind === "refund" ? (
          <>
            <label style={fieldLabel}>
              Amount (₹)
              <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} style={fieldInput} />
            </label>
            <label style={fieldLabel}>
              Reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} style={fieldInput} />
            </label>
          </>
        ) : (
          <label style={fieldLabel}>
            Note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} style={fieldInput} />
          </label>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={busy} style={actionButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (modal.kind === "refund") onRefund(modal.card, amount, reason);
              else onFlag(modal.card, note);
            }}
            style={primaryButton}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const mobileShell = {
  display: "none",
  flexDirection: "column",
  height: "100%",
  minHeight: "100dvh",
  background: "#0d0d0d",
} as const;

const mobileScroll = {
  padding: "16px",
  overflowY: "auto",
  flex: 1,
  paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))",
} as const;

const desktopShell = {
  display: "none",
  flexDirection: "column",
  height: "100%",
  gap: "clamp(12px, 1.5vw, 20px)",
  background: "#0d0d0d",
  boxSizing: "border-box",
  overflow: "hidden",
} as const;

const desktopHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#141414",
  borderRadius: "clamp(14px, 1.5vw, 20px)",
  padding: "clamp(12px, 1.5vh, 16px) clamp(16px, 1.5vw, 24px)",
  border: "1px solid #222222",
  flex: "0 0 auto",
} as const;

const desktopPanel = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  background: "#141414",
  borderRadius: "clamp(14px, 1.5vw, 20px)",
  border: "1px solid #222222",
  padding: "clamp(16px, 1.5vw, 24px)",
} as const;

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

const linkStyle = { color: YELLOW, fontWeight: 700 } as const;

const errorStyle = { margin: 0, color: "#ff8a80", fontFamily: FONT, fontSize: 14 } as const;

const statButton = {
  textAlign: "left" as const,
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  fontFamily: FONT,
};

const chipRow = { display: "flex", flexWrap: "wrap" as const, gap: 8, alignItems: "center" };

const selectStyle = {
  background: "#1c1c1c",
  color: "#fff",
  border: "1px solid #2a2a2a",
  borderRadius: 10,
  padding: "7px 10px",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 700,
} as const;

const emptyIcon = {
  width: 56,
  height: 56,
  margin: "0 auto 14px",
  borderRadius: 16,
  background: "#1c1c1c",
  border: "1px solid #2a2a2a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

const sampleChip = {
  color: "#111",
  background: YELLOW,
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: "0.04em",
  borderRadius: 999,
  padding: "3px 7px",
} as const;

const phoneButton = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "#9ecbff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: FONT,
} as const;

const categoryPill = {
  color: YELLOW,
  background: "rgba(245, 197, 24, 0.1)",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 800,
} as const;

const actionButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#222",
  color: "#eee",
  border: "1px solid #333",
  borderRadius: 10,
  padding: "8px 10px",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const actionLink = { ...actionButton, textDecoration: "none" } as const;

const primaryButton = {
  ...actionButton,
  background: YELLOW,
  color: "#111",
  border: "1px solid transparent",
} as const;

const thumbPlaceholder = {
  width: 72,
  height: 72,
  borderRadius: 14,
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#6e6e6e",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 800,
  fontFamily: FONT,
} as const;

const fieldLabel = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  marginTop: 14,
  color: "#cfcfcf",
  fontSize: 12,
  fontWeight: 700,
};

const fieldInput = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: "#101010",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 10,
  padding: "10px 12px",
  fontFamily: FONT,
  fontSize: 14,
};
