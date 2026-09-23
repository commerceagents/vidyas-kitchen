"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
} from "@/components/dashboard/DashboardChrome";
import { DashboardMobileSubNav } from "@/components/dashboard/DashboardMobileSubNav";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const CARD_BG = "#1a1a1a";
const BORDER = "#2a2a2a";
const GREEN = "#22c55e";
const RED = "#ef4444";
const YELLOW = "#eab308";
const MUTED = "#666";

type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | "UNKNOWN";

type HealthData = {
  configured: boolean;
  token: { ok: boolean; error?: string };
  templates: { name: string; status: TemplateStatus }[];
  templatesReady: boolean;
  recentMessages: {
    id: string;
    phone: string;
    direction: "in" | "out";
    kind: string;
    body: string | null;
    payload: Record<string, unknown> | null;
    provider: string | null;
    created_at: string;
  }[];
};

function StatusChip({
  ok,
  label,
  detail,
}: {
  ok: boolean | null;
  label: string;
  detail?: string;
}) {
  const color = ok === null ? YELLOW : ok ? GREEN : RED;
  const Icon = ok === null ? AlertTriangle : ok ? CheckCircle2 : XCircle;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        background: "#111",
        borderRadius: 10,
        border: `1px solid ${BORDER}`,
      }}
    >
      <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{label}</div>
        {detail && (
          <div style={{ color: MUTED, fontSize: 12, marginTop: 2, wordBreak: "break-word" }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

function templateStatusColor(s: TemplateStatus): string {
  if (s === "APPROVED") return GREEN;
  if (s === "PENDING") return YELLOW;
  return RED;
}

function templateStatusOk(s: TemplateStatus): boolean | null {
  if (s === "APPROVED") return true;
  if (s === "PENDING") return null;
  return false;
}

function MessageRow({
  msg,
}: {
  msg: HealthData["recentMessages"][0];
}) {
  const [expanded, setExpanded] = useState(false);
  const isFailed =
    typeof msg.payload === "object" &&
    msg.payload !== null &&
    "_error" in msg.payload;
  const when = msg.created_at
    ? new Date(msg.created_at).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: "10px 14px",
        background: isFailed ? "#1a0a0a" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              color: isFailed ? RED : msg.direction === "out" ? "#60a5fa" : GREEN,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              flexShrink: 0,
            }}
          >
            {isFailed ? "FAIL" : msg.direction.toUpperCase()}
          </span>
          <span
            style={{
              color: "#888",
              fontSize: 11,
              flexShrink: 0,
              fontFamily: "monospace",
            }}
          >
            {msg.phone}
          </span>
          <span
            style={{
              color: "#aaa",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {msg.body ?? `[${msg.kind}]`}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ color: MUTED, fontSize: 11 }}>{when}</span>
          {expanded ? (
            <ChevronUp size={14} color={MUTED} />
          ) : (
            <ChevronDown size={14} color={MUTED} />
          )}
        </div>
      </div>
      {expanded && msg.payload && (
        <pre
          style={{
            margin: "8px 0 0",
            color: "#aaa",
            fontSize: 11,
            background: "#0d0d0d",
            borderRadius: 6,
            padding: "8px 10px",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(msg.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function WhatsAppHealthPageInner() {
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

  const searchParams = useSearchParams();
  const initialPhone = (searchParams.get("phone") ?? "").replace(/\D/g, "");

  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phoneSearch, setPhoneSearch] = useState(initialPhone);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async (phone?: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = phone ? `?phone=${encodeURIComponent(phone.replace(/\D/g, ""))}` : "";
      const res = await fetch(`/api/whatsapp/health${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(initialPhone || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const submitTemplates = async () => {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch("/api/whatsapp/order-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      const body = (await res.json()) as {
        results?: { name: string; ok: boolean; error?: string }[];
        error?: string;
      };
      const results = body.results ?? [];
      if (results.length === 0) {
        setSubmitResult({ ok: false, message: body.error ?? "No response from Meta" });
      } else {
        // Meta rejects a re-submit of an existing template — that is not a failure,
        // it just means the template is already filed and waiting for review.
        const lines = results.map((r) =>
          r.ok
            ? `${r.name}: submitted for review`
            : `${r.name}: ${r.error ?? "failed"}`,
        );
        setSubmitResult({ ok: results.every((r) => r.ok), message: lines.join(" · ") });
      }
      void load(phoneSearch || undefined);
    } catch (e) {
      setSubmitResult({ ok: false, message: e instanceof Error ? e.message : "Error" });
    } finally {
      setSubmitting(false);
    }
  };

  const sendTest = async () => {
    const digits = testPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setTestResult({ ok: false, message: "Enter a valid 10-digit phone number" });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      setTestResult({
        ok: body.ok ?? false,
        message: body.message ?? body.error ?? (res.ok ? "Sent" : "Failed"),
      });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Error" });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div
      className="vk-dash-home-desktop"
      style={{
        minHeight: "100svh",
        background: "#0a0a0a",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <DashboardMobileHeader
        unreadCount={unreadCount}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
        newCount={newCount}
        onOpenNotifications={openNotifications}
      />
      <DashboardDesktopTopBar
        title="WhatsApp Health"
        unreadCount={unreadCount}
        onOpenNotifications={openNotifications}
        hideSearchAndMonth
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        month={month}
        onMonthChange={setMonth}
      />

      <div style={{ flex: 1, padding: "20px 16px 100px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MessageSquare size={20} color="#25d366" />
            <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>
              WhatsApp Status
            </h1>
          </div>
          <button
            onClick={() => void load(phoneSearch || undefined)}
            style={{
              background: "#1a1a1a",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "7px 14px",
              color: "#aaa",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {loading && (
          <div style={{ color: MUTED, textAlign: "center", padding: 40 }}>Checking…</div>
        )}
        {error && (
          <div
            style={{
              background: "#1a0a0a",
              border: `1px solid ${RED}`,
              borderRadius: 10,
              padding: 16,
              color: RED,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Health summary cards */}
            <div
              style={{
                background: CARD_BG,
                borderRadius: 12,
                border: `1px solid ${BORDER}`,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${BORDER}`,
                  color: "#aaa",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Integration
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
                <StatusChip
                  ok={data.configured}
                  label="Environment variables"
                  detail={
                    data.configured
                      ? "WHATSAPP_ACCESS_TOKEN, PHONE_NUMBER_ID, WABA_ID all set"
                      : "One or more env vars missing — check Vercel project settings"
                  }
                />
                <StatusChip
                  ok={data.token.ok}
                  label="Access token"
                  detail={
                    data.token.ok
                      ? "Token is valid and can reach the Meta Graph API"
                      : data.token.error ??
                        "Token invalid or expired — regenerate a permanent System User token in Meta Business Manager"
                  }
                />
                {data.templates.map((t) => (
                  <StatusChip
                    key={t.name}
                    ok={templateStatusOk(t.status)}
                    label={`Template: ${t.name}`}
                    detail={
                      t.status === "APPROVED"
                        ? "Approved — fallback messages will be delivered outside the 24-hour window"
                        : t.status === "PENDING"
                          ? "Pending review — messages to customers who haven't chatted in 24 h will NOT arrive yet"
                          : t.status === "UNKNOWN"
                            ? "Could not fetch — check that WHATSAPP_BUSINESS_ACCOUNT_ID is correct"
                            : `Status: ${t.status} — template may need to be resubmitted`
                    }
                  />
                ))}
              </div>
            </div>

            {/* What's broken summary */}
            {(!data.token.ok || !data.templatesReady) && (
              <div
                style={{
                  background: "#1a0800",
                  border: `1px solid #7a3800`,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <div style={{ color: YELLOW, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                  ⚠ Most likely cause of missing WhatsApp messages
                </div>
                {!data.token.ok && (
                  <p style={{ color: "#ccc", fontSize: 13, margin: "0 0 8px" }}>
                    <strong style={{ color: "#fff" }}>Expired access token.</strong> The{" "}
                    <code>WHATSAPP_ACCESS_TOKEN</code> env var is either missing or has expired.
                    Generate a <em>permanent</em> System User token in{" "}
                    <a
                      href="https://business.facebook.com/settings/system-users"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#60a5fa" }}
                    >
                      Meta Business Manager → System Users
                    </a>
                    , then update it in Vercel.
                  </p>
                )}
                {data.token.ok && !data.templatesReady && (
                  <>
                    <p style={{ color: "#ccc", fontSize: 13, margin: "0 0 10px" }}>
                      <strong style={{ color: "#fff" }}>Template not approved.</strong> Customers who
                      haven&apos;t chatted with the bot in the last 24 hours (every app-only customer)
                      get nothing when their order status changes. Free-form messages are blocked
                      outside that window — only an approved template gets through.
                    </p>
                    <button
                      onClick={() => void submitTemplates()}
                      disabled={submitting}
                      style={{
                        background: YELLOW,
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 16px",
                        color: "#000",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.6 : 1,
                      }}
                    >
                      {submitting ? "Submitting…" : "Submit templates for approval"}
                    </button>
                    {submitResult && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "9px 12px",
                          borderRadius: 8,
                          background: submitResult.ok ? "#0a1a0a" : "#1a0a0a",
                          border: `1px solid ${submitResult.ok ? GREEN : RED}`,
                          color: submitResult.ok ? GREEN : RED,
                          fontSize: 12,
                          wordBreak: "break-word",
                        }}
                      >
                        {submitResult.message}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Test message */}
            <div
              style={{
                background: CARD_BG,
                borderRadius: 12,
                border: `1px solid ${BORDER}`,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${BORDER}`,
                  color: "#aaa",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Send Test Message
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="tel"
                    placeholder="Phone number (10 digits)"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    style={{
                      flex: 1,
                      background: "#111",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: "9px 12px",
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => void sendTest()}
                    disabled={testSending}
                    style={{
                      background: "#25d366",
                      border: "none",
                      borderRadius: 8,
                      padding: "9px 16px",
                      color: "#000",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: testSending ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: testSending ? 0.6 : 1,
                    }}
                  >
                    <Send size={14} />
                    {testSending ? "Sending…" : "Send"}
                  </button>
                </div>
                {testResult && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "9px 12px",
                      borderRadius: 8,
                      background: testResult.ok ? "#0a1a0a" : "#1a0a0a",
                      border: `1px solid ${testResult.ok ? GREEN : RED}`,
                      color: testResult.ok ? GREEN : RED,
                      fontSize: 13,
                    }}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>

            {/* Message log */}
            <div
              style={{
                background: CARD_BG,
                borderRadius: 12,
                border: `1px solid ${BORDER}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    color: "#aaa",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Message Log
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="tel"
                    placeholder="Filter by phone"
                    value={phoneSearch}
                    onChange={(e) => setPhoneSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void load(phoneSearch || undefined);
                    }}
                    style={{
                      background: "#111",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      padding: "5px 10px",
                      color: "#fff",
                      fontSize: 12,
                      fontFamily: "monospace",
                      outline: "none",
                      width: 150,
                    }}
                  />
                  <button
                    onClick={() => void load(phoneSearch || undefined)}
                    style={{
                      background: "#222",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      padding: "5px 10px",
                      color: "#aaa",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Go
                  </button>
                </div>
              </div>
              {data.recentMessages.length === 0 ? (
                <div style={{ color: MUTED, padding: 20, textAlign: "center", fontSize: 13 }}>
                  No messages logged yet.
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Successful sends are logged automatically. Failed sends will appear here after
                    the next order status change.
                  </span>
                </div>
              ) : (
                data.recentMessages.map((m) => <MessageRow key={m.id} msg={m} />)
              )}
            </div>
          </>
        )}
      </div>

      <DashboardMobileSubNav />
    </div>
  );
}

export default function WhatsAppHealthPage() {
  return (
    <Suspense>
      <WhatsAppHealthPageInner />
    </Suspense>
  );
}
