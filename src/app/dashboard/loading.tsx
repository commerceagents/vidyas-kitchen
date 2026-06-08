"use client";

const FONT = "var(--font-outfit), system-ui, sans-serif";

function Skeleton({ w, h, r = "8px", mb = "0" }: { w: string; h: string; r?: string; mb?: string }) {
  return (
    <div
      className="vk-skel"
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "#1e1e1e",
        marginBottom: mb,
        flexShrink: 0,
      }}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: "clamp(12px, 1.5vw, 20px)",
        fontFamily: FONT,
        animation: "skelFadeIn 0.15s ease",
      }}
    >
      {/* Top bar skeleton */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "clamp(14px, 1.5vh, 18px) clamp(16px, 1.5vw, 24px)",
          background: "#141414",
          borderRadius: "clamp(14px, 1.5vw, 20px)",
          border: "1px solid #222",
        }}
      >
        <Skeleton w="180px" h="24px" r="6px" />
        <div style={{ display: "flex", gap: "12px" }}>
          <Skeleton w="200px" h="40px" r="10px" />
          <Skeleton w="40px" h="40px" r="10px" />
        </div>
      </div>

      {/* Metric cards skeleton */}
      <div style={{ display: "flex", gap: "clamp(10px, 1.2vw, 16px)" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              flex: "1 1 0px",
              background: "#1a1a1a",
              borderRadius: "clamp(12px, 1.2vw, 16px)",
              padding: "clamp(14px, 1.5vh, 20px) clamp(12px, 1.2vw, 18px)",
              border: "1px solid #2a2a2a",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Skeleton w="40px" h="40px" r="10px" />
            <div>
              <Skeleton w="28px" h="20px" r="4px" mb="4px" />
              <Skeleton w="60px" h="12px" r="4px" />
            </div>
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div
        style={{
          flex: 1,
          background: "#141414",
          borderRadius: "clamp(14px, 1.5vw, 20px)",
          padding: "clamp(14px, 1.5vh, 20px)",
          border: "1px solid #222",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <Skeleton w="140px" h="18px" r="4px" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: "#1a1a1a",
                borderRadius: "16px",
                border: "1px solid #2a2a2a",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Skeleton w="90px" h="16px" r="4px" />
                <Skeleton w="60px" h="22px" r="6px" />
              </div>
              <Skeleton w="100%" h="1px" />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Skeleton w="120px" h="14px" r="4px" />
                <Skeleton w="50px" h="12px" r="4px" />
              </div>
              <div style={{ background: "#222", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Skeleton w="34px" h="34px" r="8px" />
                  <Skeleton w="140px" h="12px" r="4px" />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Skeleton w="50%" h="36px" r="10px" />
                <Skeleton w="50%" h="36px" r="10px" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes skelPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes skelFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .vk-skel {
          animation: skelPulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
