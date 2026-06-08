"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const TOAST_DURATION = 5000;

type ToastKind = "info" | "warning" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  exiting?: boolean;
}

interface ToastCtx {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function DashboardToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-4), { id, message, kind }]);
    const timer = setTimeout(() => remove(id), TOAST_DURATION);
    timers.current.set(id, timer);
  }, [remove]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const kindColor: Record<ToastKind, string> = {
    info: "#F5A623",
    warning: "#EF4444",
    success: "#28C76F",
    error: "#EF4444",
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none",
          maxWidth: "380px",
          width: "calc(100vw - 40px)",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "#1a1a1a",
              border: `1px solid ${kindColor[t.kind]}40`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${kindColor[t.kind]}15`,
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: FONT,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              pointerEvents: "auto",
              cursor: "pointer",
              animation: t.exiting ? "toastOut 0.3s ease forwards" : "toastIn 0.3s ease",
              transition: "all 0.3s ease",
            }}
            onClick={() => remove(t.id)}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "3px",
                background: kindColor[t.kind],
                flexShrink: 0,
                boxShadow: `0 0 8px ${kindColor[t.kind]}60`,
              }}
            />
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(40px); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
