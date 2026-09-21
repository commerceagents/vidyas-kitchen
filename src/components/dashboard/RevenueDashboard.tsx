"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  type DashboardOrder,
  type MonthKey,
} from "@/lib/dashboard/orders";
import {
  type RevenueDashboardStats,
  type RevenueBarPoint,
  isCurrentMonth,
  computeRevenueDayStats,
  computeYearlySalesBars,
  formatDayKeyLabel,
  todayDayKey,
} from "@/lib/dashboard/revenue-stats";

const FONT = "var(--font-outfit), system-ui, sans-serif";
const YELLOW = "#f5e32d";
const CARD = "#1a1a1a";
const BORDER = "#2a2a2a";
const REVENUE_START_YEAR = 2025;

function availableYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - REVENUE_START_YEAR + 1 }, (_, i) => current - i);
}

function monthsForYear(year: number): MonthKey[] {
  const now = new Date();
  const maxMonth = year === now.getFullYear() ? now.getMonth() : 11;
  return Array.from({ length: maxMonth + 1 }, (_, month) => ({ year, month }));
}

function clampMonthToYear(month: MonthKey, year: number): MonthKey {
  const now = new Date();
  let nextMonth = month.month;
  if (year === now.getFullYear() && nextMonth > now.getMonth()) {
    nextMonth = now.getMonth();
  }
  return { year, month: nextMonth };
}

function formatInr(amount: number, compact = false): string {
  if (compact && amount >= 100000) {
    const val = amount / 100000;
    return `₹${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}L`;
  }
  if (compact && amount >= 1000) {
    const val = amount / 1000;
    return `₹${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
  }
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span
      className="vk-revenue-trend"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "3px 6px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        background: up ? "rgba(40, 199, 111, 0.14)" : "rgba(239, 68, 68, 0.14)",
        color: up ? "#28C76F" : "#EF4444",
        whiteSpace: "nowrap",
        width: "fit-content",
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function MetricCard({
  title,
  value,
  trend,
  featured = false,
  secondary = false,
}: {
  title: string;
  value: string;
  trend: number | null;
  featured?: boolean;
  secondary?: boolean;
}) {
  return (
    <div
      className={[
        "vk-revenue-metric-card",
        featured ? "vk-revenue-metric-card--featured" : "",
        secondary ? "vk-revenue-metric-card--secondary" : "",
      ].filter(Boolean).join(" ")}
      style={{
        background: featured ? YELLOW : CARD,
        border: featured ? "none" : `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 12,
        height: "100%",
        minHeight: 118,
        boxShadow: featured ? `0 8px 24px ${YELLOW}25` : "none",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: featured ? "#333" : "#888" }}>{title}</span>
      <span
        style={{
          fontSize: "clamp(20px, 1.6vw, 26px)",
          fontWeight: 800,
          color: featured ? "#111" : "#fff",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      <TrendBadge pct={trend} />
    </div>
  );
}

function RevenueDropdown<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  minWidth = 72,
  menuUp = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  minWidth?: number;
  menuUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="vk-revenue-dropdown" style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        style={{
          border: `1px solid ${BORDER}`,
          background: "#222",
          color: "#ccc",
          borderRadius: 10,
          padding: "8px 32px 8px 12px",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: FONT,
          cursor: "pointer",
          outline: "none",
          minWidth,
          textAlign: "left",
        }}
      >
        {selected?.label}
      </button>
      <ChevronDown
        size={14}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          pointerEvents: "none",
          color: "#888",
          transition: "transform 0.15s ease",
        }}
      />
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="vk-revenue-dropdown-menu"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            ...(menuUp
              ? { bottom: "calc(100% + 4px)", top: "auto" }
              : { top: "calc(100% + 4px)" }),
            background: "#222",
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            overflow: "hidden",
            zIndex: 30,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
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
                  background: active ? "rgba(245, 227, 45, 0.14)" : "transparent",
                  color: active ? YELLOW : "#ccc",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function YearPicker({
  year,
  onYearChange,
}: {
  year: number;
  onYearChange: (year: number) => void;
}) {
  const years = useMemo(() => availableYears(), []);
  const yearOptions = years.map((y) => ({
    value: y,
    label: String(y),
  }));

  return (
    <RevenueDropdown
      value={year}
      options={yearOptions}
      onChange={onYearChange}
      ariaLabel="Select year"
      minWidth={76}
    />
  );
}

function MonthYearPicker({
  month,
  onMonthChange,
  menuUp = false,
}: {
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  menuUp?: boolean;
}) {
  const years = useMemo(() => availableYears(), []);
  const monthKeys = useMemo(() => monthsForYear(month.year), [month.year]);

  const monthOptions = monthKeys.map((m) => ({
    value: m.month,
    label: new Date(m.year, m.month, 1).toLocaleDateString("en-IN", { month: "short" }),
  }));

  const yearOptions = years.map((y) => ({
    value: y,
    label: String(y),
  }));

  return (
    <div className="vk-revenue-month-year-picker" style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <RevenueDropdown
        value={month.month}
        options={monthOptions}
        onChange={(m) => onMonthChange({ year: month.year, month: m })}
        ariaLabel="Select month"
        minWidth={72}
        menuUp={menuUp}
      />
      <RevenueDropdown
        value={month.year}
        options={yearOptions}
        onChange={(y) => onMonthChange(clampMonthToYear(month, y))}
        ariaLabel="Select year"
        minWidth={76}
        menuUp={menuUp}
      />
    </div>
  );
}

function SalesBarChart({
  bars,
  chartYear,
}: {
  bars: RevenueBarPoint[];
  chartYear: number;
}) {
  const [activeMonthIdx, setActiveMonthIdx] = useState<number | null>(null);

  const peakBar = useMemo(() => {
    return bars.reduce((maxB, b) => (b.value > (maxB?.value ?? 0) ? b : maxB), bars[0]);
  }, [bars]);

  const currentMonthIdx = useMemo(() => {
    const now = new Date();
    if (chartYear === now.getFullYear()) return now.getMonth();
    return null;
  }, [chartYear]);

  const focusedIdx =
    activeMonthIdx !== null
      ? activeMonthIdx
      : peakBar && peakBar.value > 0
        ? bars.indexOf(peakBar)
        : currentMonthIdx !== null
          ? currentMonthIdx
          : 0;

  const focusedBar = bars[focusedIdx] || bars[0];

  const rawMax = Math.max(...bars.map((b) => b.value), 0);
  const max = useMemo(() => {
    if (rawMax <= 0) return 1000;
    if (rawMax <= 500) return 500;
    if (rawMax <= 1000) return 1000;
    if (rawMax <= 2000) return 2000;
    if (rawMax <= 5000) return Math.ceil(rawMax / 1000) * 1000;
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    return Math.ceil(rawMax / mag) * mag;
  }, [rawMax]);

  const ticks = [max, Math.round(max / 2), 0];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", minHeight: 0, gap: 10 }}>
      {/* Dynamic Month Inspector Callout */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: 10,
          border: "1px solid rgba(255, 255, 255, 0.06)",
          marginBottom: 4,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", fontFamily: FONT }}>
            {focusedBar.label} {chartYear}
          </span>
          {peakBar && focusedBar.value === peakBar.value && peakBar.value > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#f5e32d",
                background: "rgba(245, 227, 45, 0.14)",
                border: "1px solid rgba(245, 227, 45, 0.3)",
                padding: "2px 6px",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontFamily: FONT,
              }}
            >
              Peak
            </span>
          )}
          {currentMonthIdx === focusedIdx && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#60a5fa",
                background: "rgba(96, 165, 250, 0.12)",
                border: "1px solid rgba(96, 165, 250, 0.3)",
                padding: "2px 6px",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontFamily: FONT,
              }}
            >
              This Month
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: focusedBar.value > 0 ? "#f5e32d" : "#777", fontFamily: FONT }}>
          {formatInr(focusedBar.value)}
        </div>
      </div>

      {/* Main Chart Area */}
      <div style={{ display: "flex", flex: 1, gap: 10, minHeight: 0, position: "relative" }}>
        {/* Y-axis Ticks */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            fontSize: 10.5,
            fontWeight: 600,
            color: "#666",
            paddingBottom: 26,
            flexShrink: 0,
            width: 36,
            textAlign: "right",
            fontFamily: FONT,
          }}
        >
          {ticks.map((t, i) => (
            <span key={`tick-label-${i}`}>{formatInr(t, true)}</span>
          ))}
        </div>

        {/* Chart Viewport */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {/* Subtle Gridlines */}
          <div
            style={{
              position: "absolute",
              inset: "0 0 26px 0",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              pointerEvents: "none",
            }}
          >
            {ticks.map((_, i) => (
              <div
                key={`tick-line-${i}`}
                style={{
                  borderTop: i === ticks.length - 1 ? "1px solid rgba(255, 255, 255, 0.12)" : "1px dashed rgba(255, 255, 255, 0.06)",
                  width: "100%",
                }}
              />
            ))}
          </div>

          {/* 12 Bars */}
          <div
            style={{
              position: "absolute",
              inset: "0 0 26px 0",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 4,
            }}
          >
            {bars.map((bar, i) => {
              const h = max > 0 ? (bar.value / max) * 100 : 0;
              const isFocused = focusedIdx === i;
              const hasSales = bar.value > 0;

              return (
                <div
                  key={`${bar.key.year}-${bar.key.month}`}
                  onClick={() => setActiveMonthIdx(i)}
                  onMouseEnter={() => setActiveMonthIdx(i)}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                    minWidth: 0,
                    cursor: "pointer",
                    position: "relative",
                    padding: "0 1px",
                  }}
                >
                  {/* Subtle Slim Track (replaces heavy gray prison bar) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 4,
                      height: "100%",
                      borderRadius: 999,
                      background: isFocused ? "rgba(245, 227, 45, 0.18)" : "rgba(255, 255, 255, 0.04)",
                      transition: "background 0.15s ease",
                    }}
                  />

                  {/* Active Value Bar */}
                  {hasSales ? (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: 22,
                        minWidth: 6,
                        height: `${Math.max(h, 8)}%`,
                        borderRadius: "5px 5px 2px 2px",
                        background: isFocused
                          ? "linear-gradient(180deg, #FFF066 0%, #f5e32d 40%, #EAB308 100%)"
                          : "linear-gradient(180deg, #f5e32d 0%, #CA8A04 100%)",
                        boxShadow: isFocused
                          ? "0 0 16px rgba(245, 227, 45, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4)"
                          : "0 2px 8px rgba(245, 227, 45, 0.2)",
                        transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                        transform: isFocused ? "scaleX(1.15)" : "scaleX(1)",
                        zIndex: 2,
                      }}
                      title={`${bar.label}: ${formatInr(bar.value)}`}
                    />
                  ) : (
                    /* Minimal dot for zero-value months */
                    <div
                      style={{
                        position: "relative",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: isFocused ? "rgba(245, 227, 45, 0.6)" : "rgba(255, 255, 255, 0.12)",
                        marginBottom: 1,
                        zIndex: 2,
                        transition: "background 0.15s ease",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-Axis Month Labels */}
      <div style={{ display: "flex", gap: 10, paddingLeft: 46 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", gap: 4 }}>
          {bars.map((bar, i) => {
            const isFocused = focusedIdx === i;
            return (
              <span
                key={`lbl-${bar.key.year}-${bar.key.month}`}
                onClick={() => setActiveMonthIdx(i)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: "clamp(9px, 2.2vw, 11px)",
                  fontWeight: isFocused ? 800 : 600,
                  color: isFocused ? "#f5e32d" : bar.value > 0 ? "#ffffff" : "#666666",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "color 0.15s ease",
                  fontFamily: FONT,
                  minWidth: 0,
                }}
              >
                {bar.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RevenueCalendar({
  month,
  onMonthChange,
  calendarDays,
  selectedDayKey,
  onSelectDay,
  embedded = false,
  hideTitle = false,
}: {
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  calendarDays: RevenueDashboardStats["calendarDays"];
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string) => void;
  embedded?: boolean;
  hideTitle?: boolean;
}) {
  const first = new Date(month.year, month.month, 1);
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const startOffset = first.getDay();
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];

  const toneColor = (tone: string, hasRevenue: boolean) => {
    if (!hasRevenue) return "transparent";
    if (tone === "breakfast") return "#22D3EE";
    if (tone === "lunch") return YELLOW;
    if (tone === "dinner") return "#A78BFA";
    return "#555";
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const deliveryDays = Object.entries(calendarDays).filter(([, m]) => m.revenue > 0);
  const deliveryDayCount = deliveryDays.length;
  const deliveryTotal = deliveryDays.reduce((s, [, m]) => s + m.revenue, 0);
  const today = new Date();
  const todayDate = today.getDate();

  const inner = (
    <>
      <div
        className={`vk-revenue-cal-header${hideTitle ? " vk-revenue-cal-header--tabbed" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
          gap: 8,
          flexShrink: 0,
        }}
      >
        {!hideTitle && (
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>Calendar</h3>
        )}
        <div
          className={`vk-revenue-cal-nav${hideTitle ? " vk-revenue-cal-nav--tabbed" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <MonthYearPicker month={month} onMonthChange={onMonthChange} menuUp={hideTitle} />
        </div>
      </div>
      <p className="vk-revenue-cal-summary" style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#888", lineHeight: 1.4 }}>
        {deliveryDayCount > 0
          ? `${deliveryDayCount} delivery day${deliveryDayCount !== 1 ? "s" : ""} · ${formatInr(deliveryTotal)}`
          : "No deliveries this month — use chart month picker"}
      </p>
      <div className="vk-revenue-cal-weekdays" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8, flexShrink: 0 }}>
        {weekdays.map((d, i) => (
          <span key={`${d}-${i}`} className="vk-revenue-cal-weekday" style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#555" }}>
            {d}
          </span>
        ))}
      </div>
      <div className="vk-revenue-cal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((day, idx) => {
          if (day == null) return <div key={`e-${idx}`} />;
          const key = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const meta = calendarDays[key];
          const has = !!meta && meta.revenue > 0;
          const bg = toneColor(meta?.tone ?? "none", has);
          const isToday = isCurrentMonth(month) && day === todayDate;
          const isSelected = selectedDayKey === key;
          const dayTitle = has
            ? `${formatInr(meta!.revenue)} · ${meta!.orderCount} order(s)`
            : isToday
              ? "Today"
              : undefined;
          return (
            <button
              key={key}
              type="button"
              aria-label={`${dayTitle ?? `Select ${formatDayKeyLabel(key)}`}${isSelected ? ", selected" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(key)}
              className={`vk-revenue-cal-day${isToday ? " vk-revenue-cal-day--today" : ""}${isSelected ? " vk-revenue-cal-day--selected" : ""}`}
              title={dayTitle}
              style={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: isToday || has ? "#111" : isSelected ? YELLOW : "#777",
                background: isToday ? YELLOW : has ? bg : isSelected ? "rgba(245, 227, 45, 0.2)" : "transparent",
                border: isSelected && !isToday ? "2px solid #fff" : "2px solid transparent",
                boxSizing: "border-box",
                padding: 0,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </>
  );

  if (embedded) {
    return <div style={{ flexShrink: 0 }}>{inner}</div>;
  }

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      {inner}
    </div>
  );
}

function MealDonut({
  slices,
  total,
  embedded = false,
  hideTitle = false,
}: {
  slices: RevenueDashboardStats["mealSlices"];
  total: number;
  embedded?: boolean;
  hideTitle?: boolean;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const topShare = total > 0 && slices.length > 0 ? Math.round((slices[0].value / total) * 100) : 0;

  const body = (
    <>
      <h3
        style={{
          margin: "0 0 16px",
          fontSize: 16,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
          ...(hideTitle ? { position: "absolute", width: 1, height: 1, overflow: "hidden", margin: 0 } : {}),
        }}
      >
        Sales by Meal
      </h3>
      <div
        className="vk-revenue-meal-donut-wrap"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
          <svg width={130} height={130} viewBox="0 0 140 140" aria-hidden>
            <circle cx={70} cy={70} r={r} fill="none" stroke="#2a2a2a" strokeWidth={16} />
            {total > 0 &&
              slices.map((slice) => {
                const frac = slice.value / total;
                const dash = frac * c;
                const el = (
                  <circle
                    key={slice.label}
                    cx={70}
                    cy={70}
                    r={r}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={16}
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)"
                  />
                );
                offset += dash;
                return el;
              })}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{topShare}%</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14, justifyContent: slices.length === 0 ? "center" : undefined, alignItems: slices.length === 0 ? "center" : undefined }}>
          {slices.length === 0 ? (
            <span style={{ fontSize: 13, color: "#666", fontWeight: 600, textAlign: "center" }}>No delivered sales this month</span>
          ) : (
            slices.map((slice) => (
              <div key={slice.label}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{formatInr(slice.value)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: slice.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{slice.label}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingTop: 4 }}>
        {body}
      </div>
    );
  }

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      {body}
    </div>
  );
}

function RevenueAsideFull({
  month,
  onMonthChange,
  calendarDays,
  selectedDayKey,
  onSelectDay,
  slices,
  total,
}: {
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  calendarDays: RevenueDashboardStats["calendarDays"];
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string) => void;
  slices: RevenueDashboardStats["mealSlices"];
  total: number;
}) {
  return (
    <div
      className="vk-revenue-aside vk-revenue-aside-full"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "clamp(16px, 1.5vh, 20px)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      <RevenueCalendar
        month={month}
        onMonthChange={onMonthChange}
        calendarDays={calendarDays}
        selectedDayKey={selectedDayKey}
        onSelectDay={onSelectDay}
        embedded
      />
      <div style={{ borderTop: `1px solid ${BORDER}`, margin: "clamp(14px, 1.5vh, 20px) 0", flexShrink: 0 }} />
      <MealDonut slices={slices} total={total} embedded />
    </div>
  );
}

type AsideTab = "calendar" | "meal";

function AsideTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        height: 42,
        borderRadius: 12,
        border: active ? "none" : `1px solid ${BORDER}`,
        background: active ? YELLOW : CARD,
        color: active ? "#111" : "#888",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: FONT,
        cursor: "pointer",
        transition: "background 0.2s ease, color 0.2s ease",
      }}
    >
      {label}
    </button>
  );
}

function RevenueAsideCompact({
  tab,
  onTabChange,
  month,
  onMonthChange,
  calendarDays,
  selectedDayKey,
  onSelectDay,
  slices,
  total,
}: {
  tab: AsideTab;
  onTabChange: (t: AsideTab) => void;
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  calendarDays: RevenueDashboardStats["calendarDays"];
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string) => void;
  slices: RevenueDashboardStats["mealSlices"];
  total: number;
}) {
  return (
    <div className="vk-revenue-aside vk-revenue-aside-compact">
      <div
        className="vk-revenue-aside-panel"
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: "clamp(14px, 1.5vh, 16px)",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {tab === "calendar" ? (
          <RevenueCalendar
            month={month}
            onMonthChange={onMonthChange}
            calendarDays={calendarDays}
            selectedDayKey={selectedDayKey}
            onSelectDay={onSelectDay}
            embedded
            hideTitle
          />
        ) : (
          <MealDonut slices={slices} total={total} embedded hideTitle />
        )}
      </div>
      <div className="vk-revenue-aside-tabs" style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 10 }}>
        <AsideTabButton label="Calendar" active={tab === "calendar"} onClick={() => onTabChange("calendar")} />
        <AsideTabButton label="Sales by Meal" active={tab === "meal"} onClick={() => onTabChange("meal")} />
      </div>
    </div>
  );
}

type Props = {
  stats: RevenueDashboardStats;
  orders: DashboardOrder[];
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
};

export function RevenueDashboard({ stats, orders, month, onMonthChange }: Props) {
  const [asideTab, setAsideTab] = useState<AsideTab>("calendar");
  const [chartYear, setChartYear] = useState(month.year);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(() =>
    isCurrentMonth(month) ? todayDayKey() : null,
  );

  useEffect(() => {
    setChartYear(month.year);
  }, [month.year]);

  useEffect(() => {
    setSelectedDayKey(isCurrentMonth(month) ? todayDayKey() : null);
  }, [month]);

  const yearlyBars = useMemo(
    () => computeYearlySalesBars(orders, chartYear),
    [orders, chartYear],
  );

  const dayStats = useMemo(() => {
    if (!selectedDayKey) return null;
    return computeRevenueDayStats(orders, month, selectedDayKey);
  }, [orders, month, selectedDayKey]);

  const display = useMemo(() => {
    if (!dayStats) {
      return {
        totalSales: stats.totalSales,
        totalRevenue: stats.totalRevenue,
        productSales: stats.productSales,
        avgOrderValue: stats.avgOrderValue,
        trends: stats.trends,
        mealSlices: stats.mealSlices,
        mealTotal: stats.mealTotal,
      };
    }
    return {
      totalSales: dayStats.totalSales,
      totalRevenue: dayStats.totalRevenue,
      productSales: dayStats.productSales,
      avgOrderValue: dayStats.avgOrderValue,
      trends: {
        totalSales: null,
        totalRevenue: null,
        productSales: null,
        avgOrderValue: null,
      },
      mealSlices: dayStats.mealSlices,
      mealTotal: dayStats.mealTotal,
    };
  }, [dayStats, stats]);

  const handleSelectDay = (dayKey: string) => {
    setSelectedDayKey((prev) => (prev === dayKey ? null : dayKey));
  };

  return (
    <div className="vk-revenue-dashboard">
      <div className="vk-revenue-main">
        <div className="vk-revenue-kpi-grid">
          <MetricCard featured title="Total Sales" value={formatInr(display.totalSales)} trend={display.trends.totalSales} />
          <MetricCard title="Total Revenue" value={formatInr(display.totalRevenue)} trend={display.trends.totalRevenue} />
          <MetricCard secondary title="Product Sales" value={formatInr(display.productSales)} trend={display.trends.productSales} />
          <MetricCard secondary title="Avg. Order Value" value={formatInr(display.avgOrderValue)} trend={display.trends.avgOrderValue} />
        </div>

        <div
          className="vk-revenue-chart-card"
          style={{
            background: "linear-gradient(180deg, #161616 0%, #111111 100%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 18,
            padding: "clamp(16px, 1.5vh, 20px) clamp(16px, 1.5vw, 22px)",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#ffffff", fontFamily: FONT }}>
                Monthly Sales
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 11.5, fontWeight: 500, color: "#888888", fontFamily: FONT }}>
                Year {chartYear} Overview · Total {formatInr(yearlyBars.reduce((s, b) => s + b.value, 0))}
              </p>
            </div>
            <YearPicker year={chartYear} onYearChange={setChartYear} />
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <SalesBarChart bars={yearlyBars} chartYear={chartYear} />
          </div>
        </div>
      </div>

      <RevenueAsideFull
        month={month}
        onMonthChange={onMonthChange}
        calendarDays={stats.calendarDays}
        selectedDayKey={selectedDayKey}
        onSelectDay={handleSelectDay}
        slices={display.mealSlices}
        total={display.mealTotal}
      />
      <RevenueAsideCompact
        tab={asideTab}
        onTabChange={setAsideTab}
        month={month}
        onMonthChange={onMonthChange}
        calendarDays={stats.calendarDays}
        selectedDayKey={selectedDayKey}
        onSelectDay={handleSelectDay}
        slices={display.mealSlices}
        total={display.mealTotal}
      />
    </div>
  );
}
