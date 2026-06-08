"use client";

function Skeleton({ w, h, r = "8px", mb = "0" }: { w: string; h: string; r?: string; mb?: string }) {
  return (
    <div
      className="vk-skel"
      style={{ width: w, height: h, borderRadius: r, background: "#1e1e1e", marginBottom: mb, flexShrink: 0 }}
    />
  );
}

export default function SummaryLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "clamp(12px, 1.5vw, 20px)", animation: "skelFadeIn 0.15s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(14px, 1.5vh, 18px) clamp(16px, 1.5vw, 24px)", background: "#141414", borderRadius: "clamp(14px, 1.5vw, 20px)", border: "1px solid #222" }}>
        <Skeleton w="120px" h="24px" r="6px" />
        <div style={{ display: "flex", gap: "12px" }}>
          <Skeleton w="200px" h="40px" r="10px" />
          <Skeleton w="40px" h="40px" r="10px" />
        </div>
      </div>

      <div style={{ display: "flex", gap: "clamp(10px, 1.2vw, 16px)" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, background: "#141414", borderRadius: "16px", border: "1px solid #222", padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <Skeleton w="80px" h="10px" r="4px" />
            <Skeleton w="100px" h="28px" r="6px" />
            <Skeleton w="60px" h="12px" r="4px" />
          </div>
        ))}
      </div>

      <div style={{ flex: 1, background: "#141414", borderRadius: "clamp(14px, 1.5vw, 20px)", padding: "20px", border: "1px solid #222", display: "flex", flexDirection: "column", gap: "14px" }}>
        <Skeleton w="160px" h="18px" r="4px" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#1a1a1a", borderRadius: "10px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Skeleton w="36px" h="36px" r="8px" />
              <div>
                <Skeleton w="100px" h="13px" r="4px" mb="4px" />
                <Skeleton w="60px" h="10px" r="4px" />
              </div>
            </div>
            <Skeleton w="70px" h="16px" r="4px" />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes skelPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        @keyframes skelFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .vk-skel { animation: skelPulse 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
