"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Save, Trash2, Truck } from "lucide-react";
import {
  createDriver,
  deleteDriver,
  listDashboardDrivers,
  setDriverPin,
  updateDriver,
} from "@/app/actions/drivers";
import { useDashboardData } from "@/hooks/DashboardDataContext";
import {
  DashboardDesktopTopBar,
  DashboardMobileHeader,
  DashboardNotificationPanel,
} from "@/components/dashboard/DashboardChrome";
import { DashboardSpinner } from "@/components/dashboard/DashboardSpinner";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const CARD_BG = "#1a1a1a";
const BORDER = "#2a2a2a";

type Driver = {
  id: string;
  name: string;
  phone: string;
};

export default function DriversPage() {
  const [notifOpen, setNotifOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    soundMuted,
    setSoundMuted,
    markAllRead,
    newCount,
    month,
    setMonth,
    searchQuery,
    setSearchQuery,
  } = useDashboardData();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinFlags, setPinFlags] = useState<Record<string, boolean>>({});
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({});
  const [pinEditing, setPinEditing] = useState<Record<string, boolean>>({});
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [pinMsg, setPinMsg] = useState<Record<string, string>>({});

  const fetchDrivers = useCallback(async () => {
    const { ok, drivers: rows, error } = await listDashboardDrivers();
    if (!ok) {
      setDrivers([]);
      setPinFlags({});
      setListError(error || "Could not load drivers");
      setLoading(false);
      return;
    }
    setListError("");
    setDrivers(rows.map(({ id, name, phone }) => ({ id, name, phone })));
    setPinFlags(Object.fromEntries(rows.map((d) => [d.id, d.hasPin])));
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDrivers();
  }, [fetchDrivers]);

  const addDriver = () => {
    setDrivers((prev) => [...prev, { id: `new-${Date.now()}`, name: "", phone: "" }]);
  };

  const updateDriverField = (id: string, field: "name" | "phone", value: string) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const removeDriver = async (id: string) => {
    if (id.startsWith("new-")) {
      setDrivers((prev) => prev.filter((d) => d.id !== id));
      return;
    }
    if (!confirm("Remove this driver?")) return;
    const r = await deleteDriver(id);
    if (!r.ok) {
      alert(r.error || "Could not remove driver");
      return;
    }
    setDrivers((prev) => prev.filter((d) => d.id !== id));
  };

  const savePin = async (id: string) => {
    const pin = (pinDraft[id] || "").replace(/\D/g, "");
    setPinBusyId(id);
    setPinMsg((prev) => ({ ...prev, [id]: "" }));
    const r = await setDriverPin(id, pin);
    setPinBusyId(null);
    if (!r.ok) {
      setPinMsg((prev) => ({ ...prev, [id]: r.error || "Could not set PIN" }));
      return;
    }
    setPinFlags((prev) => ({ ...prev, [id]: true }));
    setPinDraft((prev) => ({ ...prev, [id]: "" }));
    setPinEditing((prev) => ({ ...prev, [id]: false }));
    setPinMsg((prev) => ({ ...prev, [id]: "PIN added" }));
  };

  const saveAll = async () => {
    setSaving(true);
    for (const d of drivers) {
      if (!d.name.trim() || !d.phone.trim()) continue;
      const r = d.id.startsWith("new-")
        ? await createDriver(d.name, d.phone, pinDraft[d.id])
        : await updateDriver(d.id, d.name, d.phone);
      if (!r.ok) alert(r.error || "Could not save driver");
    }
    await fetchDrivers();
    setSaving(false);
  };

  const openNotifications = () => {
    setNotifOpen(true);
    markAllRead();
  };

  const content = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 16, flexShrink: 0 }}>
        <button
          type="button"
          onClick={addDriver}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: `1px solid ${YELLOW}40`,
            borderRadius: 10,
            padding: "8px 14px",
            color: YELLOW,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: FONT,
            flexShrink: 0,
          }}
        >
          <Plus size={14} /> Add Driver
        </button>
      </div>

      {loading ? (
        <DashboardSpinner minHeight="100%" />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1, minHeight: 0 }}>
            {listError ? (
              <div style={{ color: "#f87171", fontSize: 13, fontFamily: FONT, padding: "8px 2px" }}>{listError}</div>
            ) : null}
            {drivers.length === 0 && !listError ? (
              <div
                style={{
                  padding: "28px 18px",
                  textAlign: "center",
                  color: "#888",
                  fontSize: 13,
                  fontFamily: FONT,
                  border: `1px dashed ${BORDER}`,
                  borderRadius: 12,
                }}
              >
                No drivers yet. Tap Add Driver, fill name, phone and a 4–6 digit PIN, then Save Drivers.
              </div>
            ) : null}
            {drivers.map((d) => {
              const unsaved = d.id.startsWith("new-");
              return (
                <div
                  key={d.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    background: CARD_BG,
                    borderRadius: 12,
                    padding: "12px 14px",
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "#333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Truck size={18} style={{ color: "#888" }} />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <input
                      type="text"
                      placeholder="Driver name"
                      value={d.name}
                      onChange={(e) => updateDriverField(d.id, "name", e.target.value)}
                      style={{
                        background: "#222",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: 14,
                        fontFamily: FONT,
                        outline: "none",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={d.phone}
                      onChange={(e) => updateDriverField(d.id, "phone", e.target.value)}
                      style={{
                        background: "#222",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: 14,
                        fontFamily: FONT,
                        outline: "none",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {!unsaved && pinFlags[d.id] && !pinEditing[d.id] ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#86efac", fontFamily: FONT }}>
                            PIN added
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPinEditing((prev) => ({ ...prev, [d.id]: true }));
                              setPinMsg((prev) => ({ ...prev, [d.id]: "" }));
                            }}
                            style={{
                              background: "transparent",
                              border: `1px solid ${YELLOW}50`,
                              borderRadius: 8,
                              padding: "6px 10px",
                              color: YELLOW,
                              fontSize: 12,
                              fontWeight: 700,
                              fontFamily: FONT,
                              cursor: "pointer",
                            }}
                          >
                            Change PIN
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="password"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={6}
                              placeholder={
                                unsaved
                                  ? "PIN (4–6 digits)"
                                  : pinFlags[d.id]
                                    ? "New PIN (4–6)"
                                    : "Set PIN (4–6)"
                              }
                              value={pinDraft[d.id] || ""}
                              onChange={(e) =>
                                setPinDraft((prev) => ({
                                  ...prev,
                                  [d.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                                }))
                              }
                              style={{
                                flex: 1,
                                background: "#222",
                                border: `1px solid ${BORDER}`,
                                borderRadius: 8,
                                padding: "8px 12px",
                                color: "#fff",
                                fontSize: 13,
                                fontFamily: FONT,
                                outline: "none",
                                minWidth: 0,
                                boxSizing: "border-box",
                              }}
                            />
                            {!unsaved ? (
                              <button
                                type="button"
                                disabled={pinBusyId === d.id || (pinDraft[d.id] || "").length < 4}
                                onClick={() => void savePin(d.id)}
                                style={{
                                  flexShrink: 0,
                                  background: YELLOW,
                                  color: "#111",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  fontFamily: FONT,
                                  cursor: pinBusyId === d.id ? "wait" : "pointer",
                                  opacity: pinBusyId === d.id || (pinDraft[d.id] || "").length < 4 ? 0.5 : 1,
                                }}
                              >
                                {pinBusyId === d.id ? "Saving" : pinFlags[d.id] ? "Save new PIN" : "Set PIN"}
                              </button>
                            ) : null}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontFamily: FONT,
                              color: pinMsg[d.id]?.includes("added") || pinMsg[d.id]?.includes("saved")
                                ? "#86efac"
                                : pinMsg[d.id]
                                  ? "#f87171"
                                  : "#888",
                            }}
                          >
                            {pinMsg[d.id]
                              || (unsaved
                                ? "PIN is saved with the driver"
                                : pinFlags[d.id]
                                  ? "Enter a new PIN, then Save new PIN"
                                  : "No PIN yet — driver cannot sign in")}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeDriver(d.id)}
                    aria-label="Remove driver"
                    style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", padding: 8, flexShrink: 0 }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
          {drivers.length > 0 && (
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={saving}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                marginTop: 16,
                padding: 12,
                background: YELLOW,
                color: "#111",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                fontFamily: FONT,
                flexShrink: 0,
              }}
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Drivers"}
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile */}
      <div
        className="vk-dash-home-mobile"
        style={{ display: "none", flexDirection: "column", height: "100%", minHeight: "100dvh", background: "#0d0d0d" }}
      >
        <DashboardMobileHeader
          newCount={newCount}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(!soundMuted)}
        />
        <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: FONT }}>Drivers</h2>
          {content}
        </div>
      </div>

      {/* Desktop */}
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
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(16px, 1.5vw, 22px)",
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "var(--font-outfit)",
              letterSpacing: "-0.02em",
            }}
          >
            Drivers
          </h1>
          <DashboardDesktopTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
            unreadCount={unreadCount}
            onOpenNotifications={openNotifications}
            hideSearchAndMonth
          />
        </div>

        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: "#141414",
            borderRadius: "clamp(14px, 1.5vw, 20px)",
            padding: "clamp(14px, 1.5vh, 20px)",
            border: "1px solid #222222",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{content}</div>
        </div>
      </div>

      <DashboardNotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
        onMarkAllRead={markAllRead}
        onAccept={() => {}}
        onReject={() => {}}
        onView={() => {}}
        onDismiss={() => {}}
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
