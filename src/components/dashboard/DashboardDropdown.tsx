"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const BORDER = "#2a2a2a";

type MenuBox = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function DashboardDropdown<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  minWidth = 72,
  fullWidth = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  minWidth?: number;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const alignedRef = useRef(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const selected = options.find((o) => o.value === value);

  const placeMenu = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const margin = 12;
    const navReserve = window.innerWidth < 1024 ? 100 : margin;
    const width = Math.max(rect.width, fullWidth ? rect.width : 148);
    let left = rect.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    if (left < margin) left = margin;

    const spaceBelow = window.innerHeight - rect.bottom - gap - navReserve;
    const spaceAbove = rect.top - gap - margin;
    const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, Math.min(320, openBelow ? spaceBelow : spaceAbove));

    setBox(
      openBelow
        ? { top: rect.bottom + gap, left, width, maxHeight }
        : { bottom: window.innerHeight - rect.top + gap, left, width, maxHeight },
    );
  };

  useEffect(() => {
    if (!open) {
      alignedRef.current = false;
      return;
    }
    placeMenu();
    const onDoc = (e: Event) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      placeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !box || alignedRef.current) return;
    alignedRef.current = true;
    const frame = requestAnimationFrame(() => {
      const menu = menuRef.current;
      const selected = menu?.querySelector<HTMLElement>("[aria-selected='true']");
      if (!menu || !selected) return;
      menu.scrollTop = Math.max(0, selected.offsetTop - 4);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, box]);

  return (
    <div
      ref={ref}
      className="vk-revenue-dropdown"
      style={{ position: "relative", display: fullWidth ? "flex" : "inline-flex", width: fullWidth ? "100%" : undefined }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        style={{
          border: `1px solid ${open ? YELLOW : BORDER}`,
          background: "#222",
          color: "#fff",
          borderRadius: 10,
          padding: "8px 44px 8px 12px",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: FONT,
          cursor: "pointer",
          outline: "none",
          minWidth: fullWidth ? 0 : minWidth,
          width: fullWidth ? "100%" : undefined,
          minHeight: 44,
          textAlign: "left",
          boxSizing: "border-box",
        }}
      >
        {selected?.label}
      </button>
      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: 16,
          top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          pointerEvents: "none",
          color: "#888",
          transition: "transform 0.15s ease",
        }}
      />
      {open &&
        box &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            className="vk-revenue-dropdown-menu no-scrollbar"
            style={{
              position: "fixed",
              top: box.top,
              bottom: box.bottom,
              left: box.left,
              width: box.width,
              background: "#1c1c1c",
              border: "1px solid #3a3a3a",
              borderRadius: 12,
              zIndex: 120,
              maxHeight: box.maxHeight,
              overflowY: "auto",
              overscrollBehavior: "contain",
              scrollbarWidth: "none",
              boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
              padding: 4,
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    border: "none",
                    borderRadius: 8,
                    background: active ? "rgba(245, 227, 45, 0.16)" : "transparent",
                    color: active ? YELLOW : "#eee",
                    padding: "12px 14px",
                    fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
