"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { upsertDishDiscountAction } from "@/app/actions/dish-discount";
import { MENU_BY_CATEGORY, type MenuItem } from "@/components/ui/mobile/mobileMenuData";
import type { DishDiscountRow } from "@/lib/menu/discount-pricing";
import { mergeMenuDiscountOverrides } from "@/lib/menu/discount-pricing";

const fontUi = "var(--font-outfit), system-ui, sans-serif";
const fontData = "var(--font-jetbrains-mono), ui-monospace, monospace";

function rowFromMenuItem(item: MenuItem): DishDiscountRow {
  return {
    dish_id: item.id,
    discount_type: item.discount_type ?? null,
    discount_value: item.discount_value ?? null,
    seasonal_active: Boolean(item.seasonal_active),
    show_discount: Boolean(item.show_discount),
    seasonal_from: item.seasonal_from ?? null,
    seasonal_until: item.seasonal_until ?? null,
    manual_list_prices: item.manual_list_prices ?? null,
  };
}

export default function DishesPricingPage() {
  const allDishes = useMemo(() => Object.values(MENU_BY_CATEGORY).flat(), []);
  const [rows, setRows] = useState<Record<string, DishDiscountRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const init: Record<string, DishDiscountRow> = {};
      for (const d of allDishes) init[d.id] = rowFromMenuItem(d);
      try {
        const res = await fetch("/api/menu/discount-settings", { cache: "no-store" });
        const j = (await res.json()) as { rows?: DishDiscountRow[] };
        if (on && j.rows?.length) {
          const merged = mergeMenuDiscountOverrides(allDishes, j.rows);
          const next: Record<string, DishDiscountRow> = { ...init };
          for (const it of merged) next[it.id] = rowFromMenuItem(it);
          setRows(next);
          return;
        }
      } catch {
        /* fall through */
      }
      if (on) setRows(init);
    })();
    return () => {
      on = false;
    };
  }, [allDishes]);

  const updateRow = useCallback((id: string, patch: Partial<DishDiscountRow>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch, dish_id: id },
    }));
  }, []);

  const save = useCallback(async (id: string) => {
    const row = rows[id];
    if (!row) return;
    setSavingId(id);
    setMsg(null);
    const r = await upsertDishDiscountAction(row);
    setSavingId(null);
    setMsg(r.ok ? "Saved. PWA will pick up on next load." : (r.error ?? "Save failed — check Supabase table & service role."));
  }, [rows]);

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        fontFamily: fontUi,
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(189, 35, 32, 0.12), transparent 55%), #080808",
        padding:
          "clamp(1rem, 3vw, 2.75rem) clamp(0.75rem, 2.5vw, 1.5rem) max(1rem, env(safe-area-inset-bottom))",
        color: "#fff",
      }}
    >
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-block text-sm font-semibold no-underline hover:underline"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              ← Back to orders
            </Link>
            <Link
              href="/dashboard/festivals"
              className="inline-block rounded-full px-3 py-1 text-xs font-bold no-underline transition-opacity hover:opacity-90"
              style={{
                background: "rgba(245, 158, 11, 0.18)",
                border: "1px solid rgba(245, 158, 11, 0.45)",
                color: "#fff",
              }}
            >
              Festival pricing
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Dishes &amp; discount pricing
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", maxWidth: 560 }}>
            Overrides sync to Supabase <code style={{ fontFamily: fontData, fontSize: "0.8em" }}>dish_discount_settings</code>.
            Run <code style={{ fontFamily: fontData, fontSize: "0.8em" }}>supabase/migrations-dish-discounts.sql</code> first.
            Use <strong style={{ color: "#fff" }}>service role</strong> in server env for saves.
          </p>
        </div>
      </header>

      {msg && (
        <p
          className="mb-6 rounded-xl border px-4 py-3 text-sm font-semibold"
          style={{
            borderColor: msg.includes("fail") ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.35)",
            background: msg.includes("fail") ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
          }}
        >
          {msg}
        </p>
      )}

      <div className="flex max-w-4xl flex-col gap-6">
        {allDishes.map((dish) => {
          const r = rows[dish.id];
          if (!r) return null;
          return (
            <section
              key={dish.id}
              className="rounded-2xl border p-5"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
            >
              <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", fontWeight: 800 }}>{dish.name}</h2>
              <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontFamily: fontData, color: "rgba(255,255,255,0.35)" }}>
                {dish.id}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={r.show_discount}
                    onChange={(e) => updateRow(dish.id, { show_discount: e.target.checked })}
                  />
                  Show discount (chip + strikethrough)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={r.seasonal_active}
                    onChange={(e) => updateRow(dish.id, { seasonal_active: e.target.checked })}
                  />
                  Seasonal pricing (date window)
                </label>
              </div>

              {r.seasonal_active && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Active from
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-base text-black"
                      value={r.seasonal_from ?? ""}
                      onChange={(e) => updateRow(dish.id, { seasonal_from: e.target.value || null })}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Active until
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-base text-black"
                      value={r.seasonal_until ?? ""}
                      onChange={(e) => updateRow(dish.id, { seasonal_until: e.target.value || null })}
                    />
                  </label>
                </div>
              )}

              <div className="mt-4">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Discount type
                </span>
                <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">
                  {(["none", "percentage", "manual"] as const).map((opt) => (
                    <label key={opt} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name={`type-${dish.id}`}
                        checked={
                          (opt === "none" && (r.discount_type == null || r.discount_type === undefined)) ||
                          (opt === "percentage" && r.discount_type === "percentage") ||
                          (opt === "manual" && r.discount_type === "manual")
                        }
                        onChange={() =>
                          updateRow(dish.id, {
                            discount_type: opt === "none" ? null : opt,
                            discount_value: opt === "none" ? null : r.discount_value,
                            manual_list_prices: opt === "manual" ? r.manual_list_prices : null,
                          })
                        }
                      />
                      {opt === "none" ? "None" : opt === "percentage" ? "Percentage" : "Manual list prices"}
                    </label>
                  ))}
                </div>
              </div>

              {r.discount_type === "percentage" && (
                <label className="mt-4 block text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Percent off (e.g. 25 for 25%)
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2 text-base text-black"
                    value={r.discount_value ?? ""}
                    onChange={(e) =>
                      updateRow(dish.id, {
                        discount_value: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}

              {r.discount_type === "manual" && (
                <label className="mt-4 block text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Manual list prices (JSON: variantId → rupees)
                  <textarea
                    className="mt-1 w-full min-h-[88px] rounded-lg border px-3 py-2 text-base text-black font-mono"
                    placeholder={`{\n  "${dish.variants[0]?.id ?? "variant-uuid"}": 449\n}`}
                    value={
                      r.manual_list_prices
                        ? JSON.stringify(r.manual_list_prices, null, 2)
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        updateRow(dish.id, { manual_list_prices: null });
                        return;
                      }
                      try {
                        const parsed = JSON.parse(raw) as Record<string, number>;
                        updateRow(dish.id, { manual_list_prices: parsed });
                      } catch {
                        /* ignore invalid JSON while typing */
                      }
                    }}
                  />
                </label>
              )}

              <button
                type="button"
                className="mt-5 rounded-full px-5 py-2.5 text-sm font-bold"
                style={{
                  background: "#BD2320",
                  color: "#fff",
                  border: "none",
                  cursor: savingId === dish.id ? "wait" : "pointer",
                  opacity: savingId === dish.id ? 0.7 : 1,
                }}
                disabled={savingId === dish.id}
                onClick={() => save(dish.id)}
              >
                {savingId === dish.id ? "Saving…" : "Save dish"}
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
