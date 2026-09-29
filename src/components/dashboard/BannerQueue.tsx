"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { listBannersAction, setBannerApprovalAction, type BannerListItem } from "@/app/actions/banners";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";

type Preview = {
  title: string;
  message: string;
  discount: string;
  start: string;
  end: string;
  file: File;
  url: string;
};

export function BannerQueue() {
  const [banners, setBanners] = useState<BannerListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await listBannersAction();
    if (!res.ok) {
      setError(res.error);
      setBanners([]);
      return;
    }
    setError(null);
    setBanners(res.banners);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = (file: File | null, form: HTMLFormElement) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = img.width / img.height;
      if (ratio < 1.4 || ratio > 2.2) {
        setError("Use a wide photo, about 16:9.");
        URL.revokeObjectURL(url);
        return;
      }
      const data = new FormData(form);
      setError(null);
      setPreview({
        title: String(data.get("title") || ""),
        message: String(data.get("message") || ""),
        discount: String(data.get("discount") || ""),
        start: String(data.get("start") || ""),
        end: String(data.get("end") || ""),
        file,
        url,
      });
    };
    img.src = url;
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    const body = new FormData();
    body.set("title", preview.title);
    body.set("message", preview.message);
    body.set("discount", preview.discount);
    body.set("start", preview.start);
    body.set("end", preview.end);
    body.set("image", preview.file);
    const res = await fetch("/api/dashboard/banners", { method: "POST", body });
    const json = (await res.json().catch(() => ({}))) as { error?: string; broadcast?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not save that banner.");
      return;
    }
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    setOpen(false);
    setNote(json.broadcast || "Banner is confirmed. It shows on the homepage while its dates are open.");
    await load();
  };

  const decide = async (id: string, approval: "approved" | "rejected") => {
    setBusy(true);
    const res = await setBannerApprovalAction(id, approval);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNote(res.broadcast || (approval === "approved" ? "Confirmed." : "Rejected."));
    await load();
  };

  return (
    <section style={{ marginBottom: 18, fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Homepage banners</p>
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setPreview(null);
          }}
          style={{
            background: "transparent",
            border: `1px solid ${YELLOW}40`,
            color: YELLOW,
            borderRadius: 10,
            padding: "8px 14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Upload banner
        </button>
      </div>
      {error && <p style={{ color: "#fca5a5", fontSize: 13 }}>{error}</p>}
      {note && <p style={{ color: "#86efac", fontSize: 13 }}>{note}</p>}

      {open && !preview && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const file = (form.elements.namedItem("image") as HTMLInputElement).files?.[0] ?? null;
            onFile(file, form);
          }}
          style={{ display: "grid", gap: 8, marginBottom: 12 }}
        >
          <input name="title" required aria-label="Title" placeholder="Title" style={field} />
          <input name="message" required aria-label="Message" placeholder="Line under the title" style={field} />
          <input name="discount" required aria-label="Discount percent" type="number" min={1} max={90} placeholder="Discount %" style={field} />
          <input name="start" required aria-label="Start date" type="date" style={field} />
          <input name="end" required aria-label="End date" type="date" style={field} />
          <input name="image" required type="file" accept="image/jpeg,image/png,image/webp" style={{ color: "#ccc" }} />
          <button type="submit" style={primary}>Preview</button>
        </form>
      )}

      {preview && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", background: "#222" }}>
            <img src={preview.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, color: "#fff" }}>
              <strong>{preview.discount}% off</strong>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{preview.title}</div>
              <div style={{ fontSize: 13 }}>{preview.message}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" disabled={busy} onClick={() => void confirm()} style={primary}>
              Put this live
            </button>
            <button type="button" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} style={ghost}>
              Back
            </button>
          </div>
        </div>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {banners.map((banner) => (
          <li key={banner.id} style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, background: "#1a1a1a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ color: "#fff" }}>{banner.title}</strong>
              <span style={{ color: "#888", fontSize: 12 }}>{banner.live.replace("_", " ")}</span>
            </div>
            <p style={{ margin: "6px 0", color: "#bbb", fontSize: 13 }}>{banner.message_text}</p>
            <p style={{ margin: 0, color: "#777", fontSize: 12 }}>
              {banner.discount_pct}% · {banner.start_date} → {banner.end_date} · {banner.source === "ai_generated" ? "Generated" : "Uploaded"}
            </p>
            {banner.approval === "pending_approval" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" disabled={busy} onClick={() => void decide(banner.id, "approved")} style={primary}>Approve</button>
                <button type="button" disabled={busy} onClick={() => void decide(banner.id, "rejected")} style={ghost}>Reject</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const field: CSSProperties = {
  background: "#222",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: "9px 12px",
  color: "#fff",
  fontSize: 14,
};

const primary: CSSProperties = {
  background: YELLOW,
  color: "#111",
  border: 0,
  borderRadius: 10,
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const ghost: CSSProperties = {
  background: "transparent",
  color: "#ccc",
  border: "1px solid #333",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
};
