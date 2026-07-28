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
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (compact && amount >= 1000) {
    return `₹${Math.round(amount / 1000)}K`;
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
        gap: 4,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: up ? "rgba(40, 199, 111, 0.12)" : "rgba(239, 68, 68, 0.12)",
        color: up ? "#28C76F" : "#EF4444",
        whiteSpace: "nowrap",
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}% vs last month
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

function SalesBarChart({ bars }: { bars: RevenueBarPoint[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const tickFractions = [0, 0.25, 0.5, 0.75, 1] as const;
  const ticks = tickFractions.map((t) => Math.round(max * t));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", minHeight: 0, gap: 12 }}>
      <div style={{ display: "flex", flex: 1, gap: 12, minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            fontSize: 11,
            fontWeight: 600,
            color: "#555",
            paddingBottom: 28,
            flexShrink: 0,
            width: 44,
            textAlign: "right",
          }}
        >
          {[...ticks].reverse().map((t, i) => (
            <span key={`tick-label-${i}`}>{formatInr(t, true)}</span>
          ))}
        </div>
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <div
            style={{
              position: "absolute",
              inset: "0 0 28px 0",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              pointerEvents: "none",
            }}
          >
            {tickFractions.map((_, i) => (
              <div key={`tick-line-${i}`} style={{ borderTop: "1px dashed #2a2a2a", width: "100%" }} />
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              inset: "0 0 28px 0",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            {bars.map((bar) => {
              const h = max > 0 ? (bar.value / max) * 100 : 0;
              return (
                <div
                  key={`${bar.key.year}-${bar.key.month}`}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      maxWidth: 42,
                      height: "100%",
                      display: "flex",
                      alignItems: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "72%",
                        height: "100%",
                        borderRadius: "8px 8px 4px 4px",
                        background: "#2a2a2a",
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        width: "72%",
                        margin: "0 auto",
                        height: `${Math.max(h, bar.value > 0 ? 4 : 0)}%`,
                        borderRadius: "8px 8px 4px 4px",
                        background: "linear-gradient(180deg, #F5A623 0%, #f5e32d 100%)",
                        boxShadow: bar.value > 0 ? "0 4px 12px rgba(245, 166, 35, 0.25)" : "none",
                      }}
                      title={`${bar.label}: ${formatInr(bar.value)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, paddingLeft: 56 }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", gap: 6 }}>
          {bars.map((bar) => (
            <span
              key={`lbl-${bar.key.year}-${bar.key.month}`}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#666",
                minWidth: 0,
              }}
            >
              {bar.label}
            </span>
          ))}
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
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: "clamp(16px, 1.5vh, 20px) clamp(18px, 1.5vw, 22px)",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>Monthly Sales</h3>
              {selectedDayKey ? (
                <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: "#666" }}>
                  All months in {chartYear} · KPIs show {formatDayKeyLabel(selectedDayKey)}
                </p>
              ) : (
                <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: "#666" }}>
                  Jan–Dec {chartYear}
                </p>
              )}
            </div>
            <YearPicker year={chartYear} onYearChange={setChartYear} />
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <SalesBarChart bars={yearlyBars} />
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
