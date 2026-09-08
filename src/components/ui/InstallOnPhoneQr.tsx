"use client";

import QRCode from "react-qr-code";

/**
 * Laptop landed here from WhatsApp "Install app". We never install the PWA
 * on desktop — the phone scans this QR and gets the confirm-and-install flow.
 */
export function InstallOnPhoneQr({ url }: { url: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0d0d",
        padding: 32,
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
      }}
    >
      <img
        src="/vk-logo.png"
        alt=""
        style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 20, objectFit: "cover" }}
      />
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#fff", textAlign: "center" }}>
        Install on your phone
      </h1>
      <p
        style={{
          margin: "10px 0 28px",
          fontSize: 15,
          color: "rgba(255,255,255,0.55)",
          textAlign: "center",
          maxWidth: 360,
          lineHeight: 1.45,
        }}
      >
        Scan this with your phone camera. Vidya&apos;s Kitchen is a phone app — we won&apos;t install it on this computer.
      </p>
      <div
        style={{
          background: "#fff",
          padding: 18,
          borderRadius: 20,
          boxShadow: "0 20px 50px rgba(189,35,32,0.25)",
        }}
      >
        <QRCode value={url} size={220} fgColor="#1A1A1A" bgColor="#FFFFFF" level="M" />
      </div>
    </div>
  );
}
