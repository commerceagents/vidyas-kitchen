"use client";

const YELLOW = "#f5e32d";

type Props = {
  size?: number;
  minHeight?: string | number;
};

export function DashboardSpinner({ size = 44, minHeight = "100%" }: Props) {
  const stroke = Math.max(3, Math.round(size * 0.08));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        minHeight,
        flex: 1,
      }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        className="vk-dash-spinner"
        style={{
          width: size,
          height: size,
          borderWidth: stroke,
        }}
      />
      <style>{`
        @keyframes vkDashSpin {
          to { transform: rotate(360deg); }
        }
        .vk-dash-spinner {
          border-style: solid;
          border-color: #2a2a2a;
          border-top-color: ${YELLOW};
          border-radius: 50%;
          animation: vkDashSpin 0.75s linear infinite;
          box-shadow: 0 0 12px rgba(245, 227, 45, 0.15);
        }
      `}</style>
    </div>
  );
}
