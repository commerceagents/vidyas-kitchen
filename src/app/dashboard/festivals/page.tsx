"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { upsertFestivalAction, type FestivalUpsertPayload } from "@/app/actions/festival-pricing";
import { festivalUiStatus, pickActiveFestival, type FestivalRow, type FestivalUiStatus } from "@/lib/menu/discount-pricing";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/[0.1] bg-zinc-950/80 px-3 py-2.5 text-base text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-zinc-500 focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20";

function StatusBadge({ status }: { status: FestivalUiStatus }) {
  const map: Record<FestivalUiStatus, { label: string; className: string }> = {
    live: {
      label: "Live on app",
      className: "border-amber-500/35 bg-amber-500/15 text-amber-100",
    },
    upcoming: {
      label: "Upcoming",
      className: "border-sky-500/30 bg-sky-500/10 text-sky-100",
    },
    ended: {
      label: "Dates passed",
      className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    },
    off: {
      label: "Paused",
      className: "border-zinc-600/40 bg-zinc-800/50 text-zinc-400",
    },
  };
  const { label, className } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

export default function FestivalPricingPage() {
  const [rows, setRows] = useState<FestivalRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/menu/festivals", { cache: "no-store" });
      const j = (await res.json()) as { rows?: FestivalRow[] };
      setRows(j.rows ?? []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const live = pickActiveFestival(rows);

  const patchRow = (id: string, patch: Partial<FestivalRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, id } : r)));
  };

  const save = async (r: FestivalRow) => {
    setSavingId(r.id);
    setMsg(null);
    const payload: FestivalUpsertPayload = {
      id: r.id,
      name: r.name,
      date_start: r.date_start,
      date_end: r.date_end,
      discount_override: r.discount_override,
      chip_label: r.chip_label,
      active: r.active,
    };
    const out = await upsertFestivalAction(payload);
    setSavingId(null);
    setMsg(out.ok ? "Saved. Ask customers to refresh the menu to see changes." : (out.error ?? "Could not save — check your connection and try again."));
    if (out.ok) void load();
  };

  return (
    <div
      className="min-h-screen text-white antialiased"
      style={{
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
        background:
          "radial-gradient(ellipse 85% 55% at 50% -12%, rgba(245, 158, 11, 0.08), transparent 50%), radial-gradient(ellipse 70% 40% at 100% 0%, rgba(189, 35, 32, 0.06), transparent 45%), #060606",
      }}
    >
      <div className="mx-auto max-w-xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-2xl sm:px-6 sm:py-10">
        <nav className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href="/dashboard"
            className="font-semibold text-zinc-500 transition-colors hover:text-white"
          >
            ← Orders
          </Link>
          <span className="text-zinc-700" aria-hidden>
            ·
          </span>
          <Link
            href="/dashboard/dishes"
            className="font-semibold text-zinc-500 transition-colors hover:text-white"
          >
            Dish pricing
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Festival offers</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Turn on a window to bump up the “was” price and swap the red deal badge for a gold festival badge — only on dishes that already
            show a discount. Customers who closed the app may need a refresh.
          </p>
        </header>

        {live && (
          <div
            className="mb-6 rounded-2xl border border-amber-400/25 px-4 py-3.5 sm:px-5"
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(180, 83, 9, 0.08) 100%)",
            }}
          >
            <p className="text-[13px] font-bold uppercase tracking-wide text-amber-200/90">Active right now</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {live.name}
              <span className="font-normal text-zinc-400"> · </span>
              <span className="text-amber-100">{live.chip_label}</span>
              <span className="font-normal text-zinc-500"> ({Math.round(live.discount_override)}% frame)</span>
            </p>
          </div>
        )}

        {msg && (
          <p
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              msg.includes("Could not") || msg.includes("fail")
                ? "border-red-500/30 bg-red-500/10 text-red-100"
                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
            }`}
            role="status"
          >
            {msg}
          </p>
        )}

        <ul className="flex flex-col gap-5">
          {rows.map((f) => {
            const status = festivalUiStatus(f);
            return (
              <li
                key={f.id}
                className="rounded-[1.25rem] border border-white/[0.07] bg-zinc-900/35 p-5 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="text-lg font-bold leading-snug text-white">{f.name}</h2>
                    <StatusBadge status={status} />
                  </div>

                  <label className="relative mt-1 inline-flex cursor-pointer select-none items-center gap-3 sm:mt-0 sm:shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={f.active}
                      onChange={(e) => patchRow(f.id, { active: e.target.checked })}
                    />
                    <span
                      className="relative h-8 w-[3.25rem] shrink-0 rounded-full bg-zinc-600 transition-colors after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-md after:transition-transform after:duration-200 after:content-[''] peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400/45 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#060606] peer-checked:bg-amber-600 peer-checked:after:translate-x-5"
                      aria-hidden
                    />
                    <span className="text-sm font-semibold text-zinc-300">Use on app</span>
                  </label>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-zinc-500">
                    Start
                    <input
                      type="date"
                      className={inputClass}
                      value={f.date_start}
                      onChange={(e) => patchRow(f.id, { date_start: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-zinc-500">
                    End
                    <input
                      type="date"
                      className={inputClass}
                      value={f.date_end}
                      onChange={(e) => patchRow(f.id, { date_end: e.target.value })}
                    />
                  </label>
                </div>

                <label className="mt-4 block text-xs font-semibold text-zinc-500">
                  Badge wording
                  <input
                    type="text"
                    className={inputClass}
                    value={f.chip_label}
                    onChange={(e) => patchRow(f.id, { chip_label: e.target.value })}
                    placeholder="e.g. PONGAL OFFER"
                  />
                </label>

                <label className="mt-4 block text-xs font-semibold text-zinc-500">
                  Extra “was” discount (%)
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className={`${inputClass} max-w-[8rem]`}
                    value={f.discount_override}
                    onChange={(e) => patchRow(f.id, { discount_override: Number(e.target.value) || 0 })}
                  />
                  <span className="mt-1 block text-[11px] font-normal normal-case leading-snug text-zinc-600">
                    How much higher the crossed-out price looks vs the real price (same idea as your everyday %).
                  </span>
                </label>

                <button
                  type="button"
                  className="mt-6 w-full rounded-2xl py-3.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:min-w-[10rem] sm:px-8"
                  style={{
                    background: "linear-gradient(135deg, #BD232090 0%, #BD2320 48%, #8B1A18 100%)",
                    boxShadow: "0 8px 28px rgba(189, 35, 32, 0.35)",
                  }}
                  disabled={savingId === f.id}
                  onClick={() => save(f)}
                >
                  {savingId === f.id ? "Saving…" : "Save"}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-center text-xs leading-relaxed text-zinc-600">
          Lunar holidays: set the right dates once a year, save, then toggle on when you are ready.
        </p>
      </div>
    </div>
  );
}
