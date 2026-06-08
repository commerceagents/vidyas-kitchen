"use client";

function Skeleton({ w, h, r = "8px" }: { w: string; h: string; r?: string }) {
  return <div className="vk-skel" style={{ width: w, height: h, borderRadius: r, background: "#1e1e1e", flexShrink: 0 }} />;
}

export default function FestivalsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px", padding: "20px", animation: "skelFadeIn 0.15s ease" }}>
      <Skeleton w="160px" h="24px" r="6px" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ background: "#1a1a1a", borderRadius: "14px", border: "1px solid #2a2a2a", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <Skeleton w="100%" h="100px" r="10px" />
            <Skeleton w="60%" h="14px" r="4px" />
            <Skeleton w="80%" h="12px" r="4px" />
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
