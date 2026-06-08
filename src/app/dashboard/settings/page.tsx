"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Truck, Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

const FONT = "var(--font-outfit), system-ui, -apple-system, sans-serif";
const YELLOW = "#f5e32d";

type Driver = {
  id: string;
  name: string;
  phone: string;
};

export default function SettingsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchDrivers = useCallback(async () => {
    const { data } = await supabase
      .from("drivers")
      .select("id, name, phone")
      .order("created_at", { ascending: true });
    if (data) setDrivers(data as Driver[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const addDriver = () => {
    setDrivers((prev) => [...prev, { id: `new-${Date.now()}`, name: "", phone: "" }]);
  };

  const updateDriver = (id: string, field: "name" | "phone", value: string) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const removeDriver = async (id: string) => {
    if (id.startsWith("new-")) {
      setDrivers((prev) => prev.filter((d) => d.id !== id));
      return;
    }
    if (!confirm("Remove this driver?")) return;
    await supabase.from("drivers").delete().eq("id", id);
    setDrivers((prev) => prev.filter((d) => d.id !== id));
  };

  const saveAll = async () => {
    setSaving(true);
    for (const d of drivers) {
      if (!d.name.trim() || !d.phone.trim()) continue;
      if (d.id.startsWith("new-")) {
        await supabase.from("drivers").insert({ name: d.name.trim(), phone: d.phone.trim() });
      } else {
        await supabase.from("drivers").update({ name: d.name.trim(), phone: d.phone.trim() }).eq("id", d.id);
      }
    }
    await fetchDrivers();
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: FONT, color: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "0 0 clamp(16px, 2vh, 24px)" }}>
        <Link href="/dashboard" style={{ color: "#888", display: "flex" }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ margin: 0, fontSize: "clamp(18px, 2vw, 24px)", fontWeight: 800 }}>Settings</h1>
      </div>

      {/* Driver Management */}
      <div style={{ background: "#141414", borderRadius: "16px", border: "1px solid #222", padding: "clamp(16px, 2vw, 24px)", flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Truck size={20} style={{ color: YELLOW }} />
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Delivery Drivers</h2>
          </div>
          <button
            onClick={addDriver}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "transparent", border: `1px solid ${YELLOW}40`, borderRadius: "10px",
              padding: "8px 14px", color: YELLOW, fontSize: "13px", fontWeight: 700,
              cursor: "pointer", fontFamily: FONT,
            }}
          >
            <Plus size={14} /> Add Driver
          </button>
        </div>

        {loading ? (
          <div style={{ color: "#555", fontSize: "14px", padding: "20px 0" }}>Loading...</div>
        ) : drivers.length === 0 ? (
          <div style={{ color: "#555", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>
            No drivers added yet. Click "Add Driver" to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {drivers.map((d) => (
              <div key={d.id} style={{ display: "flex", gap: "10px", alignItems: "center", background: "#1a1a1a", borderRadius: "12px", padding: "12px 14px", border: "1px solid #2a2a2a" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Driver name"
                    value={d.name}
                    onChange={(e) => updateDriver(d.id, "name", e.target.value)}
                    style={{
                      background: "#222", border: "1px solid #333", borderRadius: "8px",
                      padding: "8px 12px", color: "#fff", fontSize: "14px", fontFamily: FONT,
                      outline: "none", width: "100%",
                    }}
                  />
                  <input
                    type="tel"
                    placeholder="WhatsApp number (e.g. +91 98765 43210)"
                    value={d.phone}
                    onChange={(e) => updateDriver(d.id, "phone", e.target.value)}
                    style={{
                      background: "#222", border: "1px solid #333", borderRadius: "8px",
                      padding: "8px 12px", color: "#fff", fontSize: "14px", fontFamily: FONT,
                      outline: "none", width: "100%",
                    }}
                  />
                </div>
                <button
                  onClick={() => removeDriver(d.id)}
                  style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", padding: "8px", flexShrink: 0 }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {drivers.length > 0 && (
          <button
            onClick={saveAll}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              width: "100%", marginTop: "20px", padding: "12px",
              background: YELLOW, color: "#111", border: "none", borderRadius: "12px",
              fontSize: "14px", fontWeight: 800, cursor: saving ? "wait" : "pointer",
              fontFamily: FONT, boxShadow: `0 4px 14px ${YELLOW}30`,
            }}
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Drivers"}
          </button>
        )}

        <p style={{ fontSize: "12px", color: "#555", marginTop: "16px", lineHeight: 1.5 }}>
          Drivers added here will appear in the dispatch dropdown when an order is ready for delivery.
          A WhatsApp message with the order link will be sent to the selected driver.
        </p>
      </div>
    </div>
  );
}
