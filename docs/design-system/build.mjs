/**
 * Vidya's Kitchen UI design system PDF.
 * Values are read from the repo. Measured sizes come from Chromium layout.
 * Run: npm run design-system:pdf
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = __dirname;
const FONT_PATH = path.join(OUT_DIR, "fonts", "Outfit[wght].ttf");
const PDF_PATH = path.join(OUT_DIR, "vidyas-kitchen-design-system.pdf");
const GAPS_PATH = path.join(OUT_DIR, "gaps-report.md");
const DATE = "9 Oct 2026";
const VERSION = "2.0";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function mustInclude(rel, needle) {
  const src = read(rel);
  if (!src.includes(needle)) {
    throw new Error(`Drift: "${needle}" is not in ${rel}`);
  }
  return needle;
}

const FILES = {
  tokens: "src/components/ui/mobile/mobile-design-tokens.ts",
  type: "src/components/ui/mobile/mobile-typography.ts",
  driver: "src/app/driver/driver-theme.ts",
  globals: "src/app/globals.css",
  phone: "src/components/ui/mobile/PhoneLoginScreen.tsx",
  sidebar: "src/components/dashboard/DashboardSidebar.tsx",
  dashLayout: "src/app/dashboard/layout.tsx",
  complaints: "src/app/dashboard/complaints/page.tsx",
  driverOrder: "src/app/driver/order/[orderId]/page.tsx",
  manifest: "src/lib/dashboard-manifest.ts",
};

const gaps = [];
function gap(item) {
  gaps.push(item);
}

function hexes(rel) {
  return [...read(rel).matchAll(/#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g)].map((m) => m[0]);
}

const allowedHex = new Set(
  [
    FILES.tokens,
    FILES.type,
    FILES.driver,
    FILES.globals,
    FILES.phone,
    FILES.sidebar,
    FILES.dashLayout,
    FILES.complaints,
    FILES.driverOrder,
    FILES.manifest,
    "src/lib/driver-manifest.ts",
  ].flatMap(hexes).map((h) => h.toLowerCase()),
);

function useHex(hex, rel) {
  mustInclude(rel, hex);
  allowedHex.add(hex.toLowerCase());
  return hex;
}

function contrast(a, b) {
  const lin = (hex) => {
    const n = hex.replace("#", "");
    const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n.slice(0, 6);
    return [0, 2, 4].map((i) => {
      const c = parseInt(full.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  };
  const L = (hex) => {
    const [r, g, b] = lin(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const hi = Math.max(L(a), L(b));
  const lo = Math.min(L(a), L(b));
  return (hi + 0.05) / (lo + 0.05);
}

function ratioLabel(a, b) {
  const r = contrast(a, b);
  const grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "below AA";
  return `${r.toFixed(2)} : 1 · ${grade}`;
}

function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .toLowerCase();
}

function phosphorSvg(name, weight = "regular") {
  const file = path.join(ROOT, "node_modules/@phosphor-icons/react/dist/defs", `${name}.es.js`);
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, "utf8");
  const key = `"${weight}"`;
  const i = src.indexOf(key);
  if (i < 0) return null;
  const slice = src.slice(i, i + 4000);
  const paths = [...slice.matchAll(/d: "([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) return null;
  return `<svg viewBox="0 0 256 256" width="100%" height="100%" fill="currentColor" aria-hidden="true">${paths
    .map((d) => `<path d="${d}"/>`)
    .join("")}</svg>`;
}

function lucideSvg(name, stroke = 2) {
  const file = path.join(ROOT, "node_modules/lucide-react/dist/esm/icons", `${kebab(name)}.js`);
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, "utf8");
  const nodes = [...src.matchAll(/\[\s*"(path|circle|rect|line|polyline|polygon|ellipse)"\s*,\s*\{([^}]+)\}/g)];
  if (!nodes.length) return null;
  const body = nodes
    .map((match) => {
      const attrs = [...match[2].matchAll(/([A-Za-z]+):\s*"([^"]*)"/g)]
        .filter((attr) => attr[1] !== "key")
        .map((attr) => {
          const key = attr[1].replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
          return `${key}="${attr[2]}"`;
        })
        .join(" ");
      return `<${match[1]} ${attrs}/>`;
    })
    .join("");
  return `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(tsx|ts)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function collectIcons(pkg) {
  const counts = new Map();
  const sizes = new Map();
  const weights = new Map();
  const files = new Map();
  const re =
    pkg === "phosphor"
      ? /import\s*\{([^}]+)\}\s*from\s*"@phosphor-icons\/react"/g
      : /import\s*\{([^}]+)\}\s*from\s*"lucide-react"/g;
  for (const file of walk(path.join(ROOT, "src"))) {
    const src = fs.readFileSync(file, "utf8");
    for (const match of src.matchAll(re)) {
      const names = match[1]
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && !part.startsWith("type "))
        .map((part) => part.split(/\s+as\s+/)[0].trim());
      for (const name of names) {
        if (!/^[A-Z]/.test(name)) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
        const rel = path.relative(ROOT, file);
        const list = files.get(name) || [];
        if (!list.includes(rel)) list.push(rel);
        files.set(name, list);
        const size = src.match(new RegExp(`\\b${name}\\b[\\s\\S]{0,80}?size=\\{(\\d+)`));
        if (size && !sizes.has(name)) sizes.set(name, Number(size[1]));
        const weight = src.match(new RegExp(`\\b${name}\\b[\\s\\S]{0,120}?weight="(bold|fill|duotone|regular|light)"`));
        if (weight && !weights.has(name)) weights.set(name, weight[1]);
        const stroke = src.match(new RegExp(`\\b${name}\\b[\\s\\S]{0,80}?strokeWidth=\\{([\\d.]+)`));
        if (stroke && !weights.has(name)) weights.set(name, `stroke ${stroke[1]}`);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({
      name,
      count,
      file: (files.get(name) || [])[0],
      files: files.get(name) || [],
      size: sizes.get(name) ?? null,
      weight: weights.get(name) || (pkg === "phosphor" ? "regular" : "stroke 2"),
      svg:
        pkg === "phosphor"
          ? phosphorSvg(name, (weights.get(name) || "regular").startsWith("stroke") ? "regular" : weights.get(name) || "regular")
          : lucideSvg(name, Number(String(weights.get(name) || "").replace("stroke ", "")) || 2),
    }))
    .filter((icon) => icon.svg);
}

function dataUrl(file, mime) {
  const buf = fs.readFileSync(file);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function rgb(hex) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const C = {
  bg: useHex("#F5F5F7", FILES.tokens),
  red: useHex("#BD2320", FILES.tokens),
  text: useHex("#1A1A1A", FILES.tokens),
  white: useHex("#ffffff", FILES.tokens),
};
const D = {
  bg: useHex("#0a0a0a", FILES.driver),
  red: useHex("#E84040", FILES.driver),
  green: useHex("#34D469", FILES.driver),
  amber: useHex("#F5A623", FILES.driver),
};
const YELLOW = useHex("#F5C518", FILES.complaints);
const YELLOW_NAV = useHex("#f5e32d", FILES.sidebar);
const DASH_BG = useHex("#0d0d0d", FILES.dashLayout);
const NAV_RED = useHex("#E8492D", FILES.driverOrder);
const SUCCESS = useHex("#22c55e", FILES.type);

const TYPO = [
  ["display", "36", "800", "1.1", "-0.5px", "Hey, Name."],
  ["hero", "30", "800", "1.12", "-0.02em", "Order ID, featured price"],
  ["title", "24", "800", "1.15", "-0.02em", "Checkout, Browse Menu"],
  ["titleSm", "20", "800", "1.2", "0.01em", "OTP, location marked"],
  ["sectionTitle", "17", "800", "1.3", "0.01em", "Your Order"],
  ["cardTitle", "18", "700", "1.35", "—", "Dish names"],
  ["subtitle", "16", "600", "1.4", "0.02em", "Under the display line"],
  ["label", "15", "700", "1.3", "0.02em", "Field labels"],
  ["body", "15", "500", "1.55", "—", "Paragraphs"],
  ["bodyMedium", "15", "600", "1.5", "—", "Prices, slot lines"],
  ["bodySm", "14", "500", "1.5", "—", "Secondary copy"],
  ["caption", "13", "600", "1.4", "—", "Captions"],
  ["eyebrow", "12", "700", "1.25", "0.04em", "Eyebrows"],
  ["input", "17", "600", "1.3", "—", "Typed input"],
  ["micro", "10", "800", "1.2", "0.04em", "Badges, chips"],
  ["chip", "12", "700", "1.2", "0.02em", "Price pills"],
  ["dishName", "16", "700", "1.35", "—", "Carousel names"],
  ["price", "16", "900", "1.2", "—", "Price"],
  ["button", "15", "800", "1.2", "-0.01em", "Primary button"],
].map((row) => {
  mustInclude(FILES.type, `fontSize: ${row[1]}`);
  mustInclude(FILES.type, `fontWeight: ${row[2]}`);
  return row;
});

const DRIVER_TYPE = [
  ["Trip status", "10", "800", "0.12em", "ON THE WAY"],
  ["Distance", "17", "800", "-0.02em", "Header distance"],
  ["Customer name", "22", "800", "-0.03em", "Door name"],
  ["Meta", "13", "600", "—", "Order ref"],
  ["Slot", "15", "800", "—", "Breakfast line"],
  ["Dish", "15", "800", "-0.01em", "Item name"],
  ["Address", "14.5", "600", "—", "Drop address"],
  ["Collect label", "11", "800", "0.08em", "COLLECT"],
  ["Amount", "28", "800", "-0.03em", "Rupee total"],
  ["Reach button", "16", "800", "—", "I've reached"],
  ["Swipe", "15", "800", "-0.01em", "Swipe label"],
].map((row) => {
  mustInclude(FILES.driverOrder, row[1] === "14.5" ? "fontSize: 14.5" : `fontSize: ${row[1].replace(".0", "")}`);
  return row;
});

const DASH_TYPE = [
  ["Nav label", "14", "600", "—", "Sidebar item"],
  ["Badge", "9", "900", "—", "New-order count"],
].map((row) => {
  mustInclude(FILES.sidebar, row[1] === "9" ? "fontSize: 9" : `fontSize: "${row[1]}px"`);
  mustInclude(FILES.sidebar, `fontWeight: ${row[2]}`);
  return row;
});

mustInclude(FILES.globals, "0 4px 15px var(--primary-glow)");
mustInclude(FILES.globals, "--primary-glow: rgba(189, 35, 32, 0.4)");
mustInclude("src/components/ui/mobile/MobileHomeScreen.tsx", "0 4px 20px rgba(0,0,0,0.06)");
mustInclude("src/components/ui/mobile/SizeQtyDrawer.tsx", "0 2px 8px rgba(0,0,0,0.04)");

const SPACING = [8, 16, 24, 32, 40, 48, 56, 64];
for (const n of SPACING) mustInclude(FILES.phone, String(n));

const phosphor = collectIcons("phosphor");
const lucide = collectIcons("lucide");
if (!phosphor.length) throw new Error("No Phosphor icons could be read from @phosphor-icons/react");

function present(icons, pred, limit) {
  return icons
    .filter((icon) => icon.files.some(pred))
    .slice(0, limit)
    .map((icon) => ({ ...icon, file: icon.files.find(pred) || icon.file }));
}

const customerIcons = present(phosphor, (f) => f.includes("/mobile/") || f.includes("/ui/"), 24);
const driverIcons = present(lucide, (f) => f.startsWith("src/app/driver/"), 12);
const dashIcons = present(lucide, (f) => f.includes("/dashboard"), 12);
for (const icon of [...customerIcons, ...driverIcons, ...dashIcons]) {
  if (icon.size == null) gap(`${icon.name}: rendered size not found next to the import in ${icon.file}`);
}

gap("Named spacing scale for the driver app: not found. Driver theme exports RADIUS only.");
gap("Named spacing scale for the dashboard: not found. Sidebar uses literal padding 12px 16px and gap 4px.");
gap("Breakpoint token file: not found. Dashboard layout uses literal #0d0d0d and component widths 240px / 72px.");
gap("Opacity token table beyond customer text: driver muted is rgba(255,255,255,0.46) and faint is rgba(255,255,255,0.28). A shared opacity scale file does not exist.");
gap("Motion duration token file: not found. Durations live on components (0.15s, 0.2s, 0.22s, 0.25s, 0.28s, 0.35s, 0.45s).");
gap("#CC1C1C does not appear in this repository. Product brand red is #BD2320.");
gap("Annotated screens are harness composites styled from source files. The PDF build does not boot the Next.js app, so these are not production screenshots.");

const logo = dataUrl(path.join(ROOT, "public/VK_Logo.webp"), "image/webp");
const dish = dataUrl(path.join(ROOT, "public/menu-images/chk-mom-gravy.jpg"), "image/jpeg");
const fontUrl = dataUrl(FONT_PATH, "font/ttf");

function swatch(name, hex, usage, pair) {
  return `<div class="swatch">
    <i style="background:${hex}"></i>
    <div>
      <b>${name}</b>
      <span>${hex.toUpperCase()} · RGB ${rgb(hex)}</span>
      <span>${usage}</span>
      ${pair ? `<span>Contrast ${pair[0]} on ${pair[1]}: ${ratioLabel(pair[0], pair[1])}</span>` : ""}
    </div>
  </div>`;
}

function iconGrid(icons, ink) {
  return icons
    .map((icon) => {
      const px = icon.size ?? 24;
      return `<div class="icon">
        <div class="glyph" style="color:${ink};width:${px}px;height:${px}px">${icon.svg}</div>
        <b>${icon.name}</b>
        <span>${icon.size == null ? "size not found" : `${icon.size}px`} · ${icon.weight}</span>
        <span>${icon.file.replace(/^src\/components\/ui\//, "").replace(/^src\/components\//, "").replace(/^src\/app\//, "")}</span>
      </div>`;
    })
    .join("");
}

function typeTable(rows) {
  return `<table>
    <thead><tr><th>Role</th><th>Size</th><th>Weight</th><th>Line</th><th>Tracking</th><th>Use</th></tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr><td>${r[0]}</td><td>${r[1]}px</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

const qr = await QRCode.toString("https://vidyaskitchenhome.com", { type: "svg", margin: 0, color: { dark: "#1A1A1A", light: "#0000" } });

const harness = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: Outfit; src: url("${fontUrl}") format("truetype"); font-weight: 100 900; }
  * { box-sizing: border-box; font-family: Outfit; }
  body { margin: 0; padding: 24px; background: #fff; }
  .stage { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
  .shot { position: relative; display: inline-flex; flex-direction: column; gap: 0; padding: 10px 42px 22px 10px; background: #F5F5F7; }
  .shot.dark { background: #0a0a0a; }
  .shot.dash { background: #0d0d0d; }
  .meta { font-size: 10px; font-weight: 700; color: #1A1A1A; }
  .shot.dark .meta, .shot.dash .meta { color: #ffffff; }
  .dims { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
</style></head><body><div class="stage">

<section class="shot" id="s-btn" data-bg="#F5F5F7">
  <div id="m-btn" style="height:56px;min-width:220px;border-radius:20px;background:#BD2320;color:#fff;font-size:15px;font-weight:800;letter-spacing:-0.01em;display:flex;align-items:center;justify-content:center;padding:16px 24px;">Continue</div>
</section>

<section class="shot" id="s-size">
  <div style="display:flex;gap:8px">
    <div id="m-size" style="width:108px;height:72px;border-radius:16px;border:1.5px solid rgba(0,0,0,0.08);background:rgba(0,0,0,0.03);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:15px;font-weight:800;">
      <span style="font-size:15px;color:#1A1A1A">500gm</span><span style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.42)">₹349</span>
    </div>
    <div style="width:108px;height:72px;border-radius:16px;border:1.5px solid #BD2320;background:rgba(189,35,32,0.08);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;">
      <span style="font-size:15px;color:#1A1A1A">1kg</span><span style="font-size:12px;font-weight:700;color:#BD2320">₹699</span>
    </div>
  </div>
</section>

<section class="shot" id="s-otp">
  <div style="display:flex;gap:8px">
    ${[1, 2, 3, "", "", ""].map((d, i) => `<div ${i === 3 ? 'id="m-otp"' : ""} style="width:48px;height:56px;border-radius:16px;background:rgba(0,0,0,0.03);border:1.5px solid ${i === 3 ? "#FACC15" : d ? "rgba(189,35,32,0.6)" : "rgba(0,0,0,0.08)"};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#1A1A1A">${d}</div>`).join("")}
  </div>
</section>

<section class="shot" id="s-card">
  <div id="m-card" style="width:220px;border-radius:28px;background:rgba(255,255,255,0.78);border:1px solid rgba(0,0,0,0.06);padding:10px;box-shadow:0 4px 20px rgba(0,0,0,0.06);font-size:16px;font-weight:700">
    <div style="height:120px;border-radius:22px;overflow:hidden;position:relative">
      <img src="${dish}" style="width:100%;height:100%;object-fit:cover" alt="">
      <span style="position:absolute;top:8px;left:8px;background:#fff;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700">₹349</span>
    </div>
    <p style="margin:8px 0 0;font-size:16px;font-weight:700;line-height:1.35;color:#1A1A1A">Mom's Recipe — Chicken Gravy</p>
  </div>
</section>

<section class="shot" id="s-chip">
  <div id="m-chip" style="display:inline-flex;align-items:center;height:24px;padding:4px 8px;border-radius:8px;background:#BD2320;color:#fff;font-size:10px;font-weight:800;letter-spacing:0.04em">FESTIVAL</div>
</section>

<section class="shot" id="s-tabs">
  <div id="m-tabs" style="width:280px;height:64px;border-radius:24px;background:rgba(255,255,255,0.88);border:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-around;padding:8px 12px;font-size:10px;font-weight:800">
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:#BD2320;font-size:10px;font-weight:800">${phosphorSvg("House", "fill") ? phosphorSvg("House", "fill").replace('width="100%" height="100%"', 'width="22" height="22"') : ""}Home</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:rgba(0,0,0,0.45);font-size:10px;font-weight:700">${phosphorSvg("Receipt", "regular") ? phosphorSvg("Receipt", "regular").replace('width="100%" height="100%"', 'width="22" height="22"') : ""}Orders</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:rgba(0,0,0,0.45);font-size:10px;font-weight:700">${phosphorSvg("User", "regular") ? phosphorSvg("User", "regular").replace('width="100%" height="100%"', 'width="22" height="22"') : ""}Account</div>
  </div>
</section>

<section class="shot" id="s-bill">
  <div id="m-bill" style="width:260px;display:flex;flex-direction:column;gap:8px;font-size:14px;font-weight:600;color:rgba(0,0,0,0.65)">
    <div style="display:flex;justify-content:space-between"><span>Item total</span><span>₹349</span></div>
    <div style="display:flex;justify-content:space-between"><span>Delivery</span><span>₹19</span></div>
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#1A1A1A"><span>To pay</span><span>₹368</span></div>
  </div>
</section>

<section class="shot dark" id="s-job">
  <div id="m-job" style="width:280px;background:#1C1C1E;border-radius:18px;padding:14px;color:#fff;font-size:22px;font-weight:800">
    <div style="display:flex;align-items:center;gap:8px"><b style="font-size:22px;font-weight:800">Anand</b><span style="font-size:11px;font-weight:800;letter-spacing:0.06em;background:rgba(255,255,255,0.08);border-radius:999px;padding:4px 8px">RECIPIENT</span></div>
    <p style="margin:6px 0 0;font-size:13px;font-weight:600;color:#AEAEB2">#00001 · Ordered by Santhosh</p>
    <p style="margin:6px 0 0;font-size:15px;font-weight:800">Breakfast · Tue, 6 Oct</p>
  </div>
</section>

<section class="shot dark" id="s-collect">
  <div id="m-collect" style="width:280px;background:rgba(245,166,35,0.12);border-radius:16px;padding:14px 16px;font-size:28px;font-weight:800">
    <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.08em;color:#F5A623">COLLECT — CASH OR UPI</p>
    <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#fff">₹348</p>
  </div>
</section>

<section class="shot dark" id="s-reach">
  <div id="m-reach" style="width:280px;height:60px;border-radius:14px;background:#E84040;color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center">I've reached the customer</div>
</section>

<section class="shot dark" id="s-swipe">
  <div id="m-swipe" style="width:280px;height:60px;border-radius:14px;background:#E8492D;position:relative;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center">
    <span style="position:absolute;left:4px;top:4px;width:52px;height:52px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#E8492D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
    Swipe to mark delivered
  </div>
</section>

<section class="shot dash" id="s-side">
  <div id="m-side" style="width:240px;background:#0d0d0d;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:4px;font-size:14px;font-weight:600">
    <div style="min-height:44px;border-radius:12px;background:#f5e32d;color:#000;display:flex;align-items:center;gap:12px;padding:12px 16px;font-size:14px;font-weight:600">${lucideSvg("LayoutDashboard", 2.25)?.replace('width="100%" height="100%"', 'width="20" height="20"') || ""}Dashboard</div>
    <div style="min-height:44px;border-radius:12px;color:#888;display:flex;align-items:center;gap:12px;padding:12px 16px;font-size:14px;font-weight:600">${lucideSvg("Truck", 1.75)?.replace('width="100%" height="100%"', 'width="20" height="20"') || ""}Drivers</div>
  </div>
</section>

<section class="shot dash" id="s-yellow">
  <button id="m-yellow" style="height:44px;padding:0 16px;border-radius:12px;border:1.5px solid #f5e32d;background:transparent;color:#f5e32d;font-size:14px;font-weight:700">Approve price</button>
</section>

<section class="shot dash" id="s-stat">
  <div id="m-stat" style="width:160px;background:#161616;border:1px solid #222;border-radius:16px;padding:14px;font-size:28px;font-weight:800">
    <p style="margin:0;font-size:12px;font-weight:700;color:#888">New orders</p>
    <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:#fff">12</p>
  </div>
</section>

<section class="shot" id="s-phone">
  <div id="m-phone" style="width:390px;background:#F5F5F7;padding:12px;display:flex;flex-direction:column;gap:10px;font-size:16px;font-weight:700">
    <div style="display:flex;align-items:center;gap:8px"><img src="${logo}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover"><b style="font-size:17px;font-weight:800">Vidya's Kitchen</b></div>
    <div style="border-radius:28px;background:rgba(255,255,255,0.78);border:1px solid rgba(0,0,0,0.06);padding:10px">
      <div style="height:120px;border-radius:22px;overflow:hidden;position:relative">
        <img src="${dish}" alt="" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;top:8px;left:8px;background:#fff;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700">₹349</span>
      </div>
      <p style="margin:8px 0 0;font-size:16px;font-weight:700">Mom's Recipe — Chicken Gravy</p>
    </div>
    <div><span style="display:inline-flex;align-items:center;height:24px;padding:4px 8px;border-radius:8px;background:#BD2320;color:#fff;font-size:10px;font-weight:800;letter-spacing:0.04em">FESTIVAL</span></div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;font-weight:600;color:rgba(0,0,0,0.65)">
      <div style="display:flex;justify-content:space-between"><span>Item total</span><span>₹349</span></div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#1A1A1A"><span>To pay</span><span>₹368</span></div>
    </div>
    <div style="height:56px;border-radius:20px;background:#BD2320;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center">Continue</div>
    <div style="height:64px;border-radius:24px;background:rgba(255,255,255,0.88);border:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-around;font-size:10px;font-weight:800;color:#BD2320">Home · Orders · Account</div>
  </div>
</section>

</div></body></html>`;

function sheet(theme, inner) {
  const bg = theme === "customer" ? "#F5F5F7" : theme === "driver" ? "#0A0A0A" : theme === "dash" ? "#0D0D0D" : "#F5F5F7";
  const fg = theme === "customer" || theme === "neutral" ? "#1A1A1A" : "#FFFFFF";
  const muted = theme === "customer" || theme === "neutral" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.62)";
  return `<section class="page" style="background:${bg};color:${fg}">
    <div class="body">${inner}</div>
    <footer style="color:${muted}"><span class="foot-brand"><img src="${logo}" alt="">Vidya's Kitchen · UI system ${VERSION}</span><span>${DATE}</span><span class="pn"></span></footer>
  </section>`;
}

function buildDocument(shots, measures) {
  const measured = Object.fromEntries(measures.map((m) => [m.id, m]));
  const shot = (id, title, points) => {
    const img = shots[id];
    const m = measured[id];
    const spec = m
      ? `${m.w}×${m.h}px · radius ${m.radius} · pad ${m.pad} · gap ${m.gap} · ${m.fs} / ${m.fw}`
      : "not found";
    return `<figure class="spec">
      <img src="${img}" alt="${title}">
      <figcaption>
        <b>${title}</b>
        <span class="measured">${spec}</span>
        <ol>${points.map((p) => `<li>${p}</li>`).join("")}</ol>
      </figcaption>
    </figure>`;
  };

  const pages = [
    sheet(
      "neutral",
      `<div class="cover">
        <div class="cover-copy">
          <img class="logo" src="${logo}" alt="Vidya's Kitchen">
          <p class="kicker">UI design system · ${VERSION}</p>
          <h1>Vidya's Kitchen</h1>
          <p class="lede">Customer PWA, driver app, and kitchen dashboard. Every colour and type size on these pages is read from the repository. Component boxes are Chromium measurements of those styles.</p>
          <p class="brand">Brand red in code: <b>#BD2320</b> · mobile-design-tokens.ts, globals.css --primary, driver-manifest.ts. The value CC1C1C is not in this repository.</p>
          <div class="qr">${qr}<span>vidyaskitchenhome.com</span></div>
        </div>
        <div class="cover-toc">
          <h2>Contents</h2>
          <ol class="toc">
            <li>Three surfaces</li>
            <li>Foundations — type, spacing, radius, opacity</li>
            <li>Customer — colour, type, icons, components</li>
            <li>Driver — colour, type, icons, components</li>
            <li>Dashboard — colour, type, icons, components</li>
            <li>Cross-surface status</li>
            <li>Token index</li>
          </ol>
        </div>
        <div class="tabs">
          <span style="background:#ffffff;color:#1A1A1A">Customer · light glass<br><small>#F5F5F7 · Phosphor · button 56</small></span>
          <span style="background:#0A0A0A;color:#fff">Driver · #0A0A0A<br><small>#E84040 action · Lucide · reach 60</small></span>
          <span style="background:#0D0D0D;color:#F5C518">Dashboard · yellow<br><small>#f5e32d nav · Lucide · row 44</small></span>
        </div>
      </div>`,
    ),
    sheet(
      "neutral",
      `<h2>Three surfaces</h2>
      <table class="matrix">
        <thead><tr><th></th><th>Customer PWA</th><th>Driver</th><th>Dashboard</th></tr></thead>
        <tbody>
          <tr><td>Audience</td><td>People ordering food</td><td>Rider, outdoors</td><td>Kitchen</td></tr>
          <tr><td>Theme</td><td>${C.bg} glass</td><td>${D.bg}</td><td>${DASH_BG}</td></tr>
          <tr><td>Primary</td><td>${C.red}</td><td>${D.red} action · ${NAV_RED} navigate/swipe</td><td>${YELLOW} and ${YELLOW_NAV}</td></tr>
          <tr><td>Icons</td><td>Phosphor</td><td>Lucide</td><td>Lucide</td></tr>
          <tr><td>Radius</td><td>16–28 on cards</td><td>card 16 · control 14 · chip 999</td><td>nav 12 · sidebar card 16</td></tr>
          <tr><td>Touch</td><td>Button height 56</td><td>Reach / swipe height 60</td><td>Nav min-height 44</td></tr>
          <tr><td>Constraint</td><td>Phone, one hand</td><td>Read in daylight</td><td>Desk, 240 / 72 sidebar</td></tr>
        </tbody>
      </table>
      <h2>Outfit</h2>
      <div class="specimen">
        ${[500, 600, 700, 800, 900].map((w) => `<div><b style="font-weight:${w}">Ag</b><span>${w}</span><p style="font-weight:${w}">Vidya's Kitchen delivers home meals in Sivakasi.</p></div>`).join("")}
      </div>
      <h2>Spacing</h2>
      <p class="note">Customer 8px grid in PhoneLoginScreen.tsx (sp1–sp8). Driver and dashboard have no named scale.</p>
      <div class="spaces">${SPACING.map((n) => `<div><i style="width:${n}px;height:${n}px"></i><span>${n}</span></div>`).join("")}</div>
      <h2>Opacity</h2>
      <div class="opacity">
        ${[
          ["Text secondary", "rgba(0,0,0,0.65)", "C_TEXT_SEC"],
          ["Text muted", "rgba(0,0,0,0.42)", "C_TEXT_MUTED"],
          ["Icon", "rgba(0,0,0,0.45)", "C_ICON"],
          ["Border", "rgba(0,0,0,0.06)", "C.border"],
          ["Red faint", "rgba(189,35,32,0.08)", "C.redFaint"],
          ["Red border", "rgba(189,35,32,0.18)", "C.redBorder"],
          ["Red glow", "rgba(189,35,32,0.25)", "C.redGlow"],
          ["Driver muted", "rgba(255,255,255,0.46)", "D.muted"],
        ]
          .map(([name, value, token]) => `<div><i style="background:${value};border:1px solid rgba(0,0,0,0.08)"></i><b>${token}</b><span>${name}</span><span>${value}</span></div>`)
          .join("")}
      </div>`,
    ),
    sheet(
      "neutral",
      `<h2>Radius and elevation</h2>
      <div class="radii">
        <div><i style="border-radius:14px"></i><span>14 control · driver RADIUS</span></div>
        <div><i style="border-radius:16px"></i><span>16 card / OTP</span></div>
        <div><i style="border-radius:20px"></i><span>20 primary · globals .btn-primary</span></div>
        <div><i style="border-radius:28px"></i><span>28 menu card</span></div>
        <div><i style="border-radius:999px"></i><span>999 chip</span></div>
      </div>
      <h2>Shadows</h2>
      <div class="shadows">
        <div><i style="box-shadow:0 4px 15px rgba(189,35,32,0.4)"></i><b>Primary button</b><span>globals.css · 0 4px 15px var(--primary-glow)</span></div>
        <div><i style="box-shadow:0 4px 20px rgba(0,0,0,0.06)"></i><b>Menu card</b><span>MobileHomeScreen.tsx · 0 4px 20px rgba(0,0,0,0.06)</span></div>
        <div><i style="box-shadow:0 2px 8px rgba(0,0,0,0.04)"></i><b>Size card idle</b><span>SizeQtyDrawer.tsx · 0 2px 8px rgba(0,0,0,0.04)</span></div>
      </div>
      <p class="note">Motion token file: not found. Durations are set on the components that use them.</p>`,
    ),
    sheet(
      "customer",
      `<h2>Customer · colour</h2>
      <div class="swatches">
        ${swatch("C.bg", C.bg, "Page", null)}
        ${swatch("C.red", C.red, "Brand, primary fill", [C.white, C.red])}
        ${swatch("C.text", C.text, "Primary text", [C.text, C.bg])}
        ${swatch("C.white", C.white, "Button label, chips", [C.red, C.white])}
        ${swatch("SUCCESS", SUCCESS, "OTP verified ring", [SUCCESS, C.bg])}
      </div>
      <h2>Customer · type</h2>
      ${typeTable(TYPO)}
      <div class="live fill">
        ${TYPO.slice(0, 4).map((r) => `<p style="font-size:${r[1]}px;font-weight:${r[2]};line-height:${r[3]};letter-spacing:${r[4]};margin:0"><b>${r[0]}</b> ${r[5]}</p>`).join("")}
      </div>`,
    ),
    sheet(
      "customer",
      `<h2>Customer · icons</h2>
      <p class="note">Phosphor icons imported in src/. Glyphs are the package SVGs. Size is the first size={} beside that icon, or “not found”.</p>
      <div class="icons fill">${iconGrid(customerIcons, C.red)}</div>`,
    ),
    sheet(
      "customer",
      `<h2>Customer · components</h2>
      <div class="specs fill">
        ${shot("s-btn", "Primary button", ["Fill #BD2320. Label #ffffff.", "Source: globals.css .btn-primary; button token in mobile-typography.ts."])}
        ${shot("s-size", "Size card", ["Default border rgba(0,0,0,0.08). Selected border #BD2320 and redFaint fill.", "Price uses chip 12/700."])}
        ${shot("s-otp", "OTP cells", ["Active border #FACC15. Filled border uses red at 0.6 alpha.", "Cell size is the red callout. Source: PhoneLoginScreen otpBox."])}
        ${shot("s-card", "Menu card", ["Photo is public/menu-images/chk-mom-gravy.jpg.", "Dish name uses dishName 16/700."])}
      </div>`,
    ),
    sheet(
      "customer",
      `<h2>Customer · components and 390px composite</h2>
      <div class="split fill">
        <div class="device">
          <img src="${shots["s-phone"]}" alt="390px composite">
          <ol>
            <li>Menu card — photo, price chip, dish name.</li>
            <li>Discount chip — #BD2320.</li>
            <li>Bill rows — muted lines, total in C.text.</li>
            <li>Primary button — #BD2320.</li>
            <li>Tab bar — Home is the selected destination.</li>
          </ol>
        </div>
        <div class="specs stack">
          ${shot("s-chip", "Discount chip", ["micro 10/800, letter-spacing 0.04em."])}
          ${shot("s-tabs", "Tab bar", ["Home uses Phosphor House fill. Orders and Account use Receipt and User regular.", "Active ink #BD2320. Inactive ink C_ICON."])}
          ${shot("s-bill", "Bill rows", ["Body rows 14/600 in C_TEXT_SEC.", "Total row 16/800 in C.text."])}
        </div>
      </div>`,
    ),
    sheet(
      "driver",
      `<h2>Driver · colour</h2>
      <div class="swatches">
        ${swatch("D.bg", D.bg, "Screen", [C.white, D.bg])}
        ${swatch("D.red", D.red, "Reach button", [C.white, D.red])}
        ${swatch("Navigate", NAV_RED, "Header navigate and swipe track", [C.white, NAV_RED])}
        ${swatch("D.green", D.green, "Delivered swipe", [D.bg, D.green])}
        ${swatch("D.amber", D.amber, "Collect label", [D.amber, D.bg])}
      </div>
      <h2>Driver · type</h2>
      <p class="note">Sizes are the fontSize literals in driver/order/[orderId]/page.tsx. Driver theme has no type scale export.</p>
      ${typeTable(DRIVER_TYPE.map((r) => [r[0], r[1], r[2], "—", r[3], r[4]]))}
      <h2>Driver · icons</h2>
      <div class="icons fill">${iconGrid(driverIcons, "#fff")}</div>`,
    ),
    sheet(
      "driver",
      `<h2>Driver · components</h2>
      <div class="specs fill">
        ${shot("s-job", "Job card", ["Surface #1C1C1E. Name 22/800. Recipient chip 11/800.", "Slot line 15/800."])}
        ${shot("s-collect", "Collect cash", ["Shown after a map pin exists and the driver has arrived.", "Amber label #F5A623. Amount 28/800."])}
        ${shot("s-reach", "I've reached", ["Footer primary. Height 60, radius 14 (RADIUS.control), fill D.red #E84040.", "After this tap the footer becomes the swipe."])}
        ${shot("s-swipe", "Swipe to deliver", ["Track #E8492D, height 60, handle 52.", "Handle arrow is the 19px chevron from SwipeAction. Label 15/800."])}
      </div>`,
    ),
    sheet(
      "dash",
      `<h2>Dashboard · colour</h2>
      <div class="swatches">
        ${swatch("Background", DASH_BG, "layout.tsx", [C.white, DASH_BG])}
        ${swatch("Nav yellow", YELLOW_NAV, "Active sidebar item", ["#000000", YELLOW_NAV])}
        ${swatch("Accent", YELLOW, "complaints page and dashboard-manifest theme_color", [YELLOW, DASH_BG])}
      </div>
      <h2>Dashboard · type</h2>
      ${typeTable(DASH_TYPE.map((r) => [r[0], r[1], r[2], "—", r[3], r[4]]))}
      <p class="note">Dashboard has no typography module. These two roles are the sidebar literals. Other dashboard sizes are local to each page.</p>
      <h2>Dashboard · icons</h2>
      <div class="icons fill">${iconGrid(dashIcons, YELLOW_NAV)}</div>`,
    ),
    sheet(
      "dash",
      `<h2>Dashboard · components</h2>
      <div class="specs dash fill">
        ${shot("s-side", "Sidebar", ["Expanded width 240. Collapsed width 72, from DashboardSidebar.tsx.", "Active row #f5e32d on #000, min-height 44, radius 12, icon 20.", "Idle label #888, weight 600, size 14."])}
        ${shot("s-yellow", "Yellow outline", ["Border and label #f5e32d. Height 44, radius 12.", "Used for approval-style actions on the dark surface."])}
        ${shot("s-stat", "Stat tile", ["Dark tile on #0d0d0d. Figure 28/800.", "Label 12/700 #888."])}
      </div>`,
    ),
    sheet(
      "neutral",
      `<h2>Status across surfaces</h2>
      <table class="matrix">
        <thead><tr><th>Role</th><th>Customer</th><th>Driver</th><th>Dashboard</th></tr></thead>
        <tbody>
          <tr><td>Success</td><td>${SUCCESS}</td><td>${D.green}</td><td>${YELLOW_NAV} selected</td></tr>
          <tr><td>Warning</td><td>not found as a token</td><td>${D.amber}</td><td>${YELLOW}</td></tr>
          <tr><td>Error / action</td><td>${C.red}</td><td>${D.red}</td><td>${C.red} appears in shared globals</td></tr>
          <tr><td>Live / selected</td><td>${C.red} tab</td><td>${NAV_RED} swipe</td><td>${YELLOW_NAV} nav</td></tr>
        </tbody>
      </table>
      <h2>Same job, three surfaces</h2>
      <div class="pair">
        <div>
          <p class="note">Primary action</p>
          <div class="specs three">
            ${shot("s-btn", "Primary", ["Customer fill #BD2320."])}
            ${shot("s-reach", "Primary", ["Driver fill #E84040."])}
            ${shot("s-yellow", "Primary", ["Dashboard outline #f5e32d."])}
          </div>
        </div>
        <div>
          <p class="note">Card</p>
          <div class="specs three">
            ${shot("s-card", "Card", ["Customer menu card, photo from public/menu-images."])}
            ${shot("s-job", "Card", ["Driver job card, surface #1C1C1E."])}
            ${shot("s-stat", "Card", ["Dashboard stat tile on #0d0d0d."])}
          </div>
        </div>
      </div>`,
    ),
    sheet(
      "neutral",
      `<h2>Token index</h2>
      <table class="index">
        <thead><tr><th>Token</th><th>Value</th><th>File</th></tr></thead>
        <tbody>
          ${[
            ["C.bg", C.bg, FILES.tokens],
            ["C.red", C.red, FILES.tokens],
            ["C.text", C.text, FILES.tokens],
            ["C.white", C.white, FILES.tokens],
            ["C_TEXT_SEC", "rgba(0,0,0,0.65)", FILES.tokens],
            ["C_TEXT_MUTED", "rgba(0,0,0,0.42)", FILES.tokens],
            ["C_ICON", "rgba(0,0,0,0.45)", FILES.tokens],
            ["C.border", "rgba(0,0,0,0.06)", FILES.tokens],
            ["C.redFaint", "rgba(189,35,32,0.08)", FILES.tokens],
            ["C.redBorder", "rgba(189,35,32,0.18)", FILES.tokens],
            ["C.redGlow", "rgba(189,35,32,0.25)", FILES.tokens],
            ["SUCCESS_STATUS.green", SUCCESS, FILES.type],
            ["D.bg", D.bg, FILES.driver],
            ["D.red", D.red, FILES.driver],
            ["D.green", D.green, FILES.driver],
            ["D.amber", D.amber, FILES.driver],
            ["D.muted", "rgba(255,255,255,0.46)", FILES.driver],
            ["RADIUS.control", "14", FILES.driver],
            ["RADIUS.card", "16", FILES.driver],
            ["RADIUS.chip", "999", FILES.driver],
            ["Navigate / swipe", NAV_RED, FILES.driverOrder],
            ["Dashboard bg", DASH_BG, FILES.dashLayout],
            ["Sidebar active", YELLOW_NAV, FILES.sidebar],
            ["Complaints yellow", YELLOW, FILES.complaints],
            ["--primary", C.red, FILES.globals],
            ["Spacing sp1–sp8", "8–64 step 8", FILES.phone],
          ]
            .map(([n, v, f]) => `<tr><td>${n}</td><td>${v}</td><td>${f}</td></tr>`)
            .join("")}
        </tbody>
      </table>
      <p class="note">Changelog ${VERSION} · ${DATE}. Outfit embedded. Brand red kept at the value in code.</p>`,
    ),
  ];

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Outfit; src: url("${fontUrl}") format("truetype"); font-weight: 100 900; font-style: normal; }
    * { box-sizing: border-box; font-family: Outfit; }
    html, body { margin: 0; padding: 0; background: #fff; }
    @page { size: A4 landscape; margin: 0; }
    .page { width: 269mm; height: 182mm; page-break-after: always; position: relative; overflow: hidden; padding: 0; }
    .page:last-child { page-break-after: auto; }
    .body { height: 172mm; overflow: hidden; display: flex; flex-direction: column; gap: 6px; }
    .fill { flex: 1 1 auto; min-height: 0; }
    footer { position: absolute; left: 0; right: 0; bottom: 0; height: 8mm; display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-weight: 600; }
    .foot-brand { display: flex; align-items: center; gap: 6px; }
    .foot-brand img { width: 14px; height: 14px; border-radius: 50%; object-fit: cover; }
    h1 { font-size: 34px; line-height: 0.95; font-weight: 800; margin: 6px 0; letter-spacing: -0.03em; }
    h2 { font-size: 13px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
    p, li, td, th, span { font-size: 8.5px; }
    .kicker { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 8px 0 0; }
    .lede, .brand, .note { font-size: 9px; line-height: 1.35; font-weight: 500; margin: 4px 0; }
    .logo { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
    .cover { flex: 1; display: grid; grid-template-columns: 1.15fr 0.85fr; grid-template-rows: auto 1fr; gap: 10px 18px; min-height: 0; }
    .qr svg { width: 64px; height: 64px; display: block; }
    .qr { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-weight: 700; }
    .toc { margin: 4px 0 0; padding-left: 18px; }
    .toc li { margin: 3px 0; font-size: 12px; font-weight: 650; }
    .tabs { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; min-height: 0; }
    .tabs span { border-radius: 12px; padding: 14px 16px; font-size: 14px; font-weight: 800; line-height: 1.25; display: flex; flex-direction: column; justify-content: flex-start; border: 1px solid rgba(0,0,0,0.16); }
    .tabs small { font-size: 9px; font-weight: 600; opacity: 0.8; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 2px 4px; border-bottom: 1px solid rgba(127,127,127,0.25); vertical-align: top; font-weight: 600; }
    th { font-size: 8px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
    .specimen { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; align-items: end; }
    .specimen b { font-size: 64px; line-height: 0.85; display: block; }
    .specimen span, .specimen p { margin: 4px 0 0; font-size: 12px; line-height: 1.25; font-weight: 600; }
    .spaces { display: flex; gap: 12px; align-items: flex-end; }
    .spaces div { display: flex; flex-direction: column; gap: 3px; align-items: center; }
    .spaces i { display: block; background: #BD2320; border-radius: 3px; }
    .spaces span, .radii span { font-size: 8px; font-weight: 700; }
    .radii, .opacity, .swatches { display: grid; gap: 8px; }
    .swatches { grid-template-columns: repeat(4, 1fr); }
    .radii { grid-template-columns: repeat(5, 1fr); }
    .radii div { display: flex; flex-direction: column; gap: 4px; min-height: 0; }
    .radii i { display: block; height: 108px; border: 1.5px solid currentColor; }
    .shadows { flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; min-height: 0; }
    .shadows div { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
    .shadows i { display: block; flex: 1; min-height: 120px; background: #fff; border-radius: 16px; }
    .opacity { grid-template-columns: repeat(4, 1fr); align-content: start; }
    .opacity div, .swatch { display: grid; grid-template-columns: 36px 1fr; gap: 6px; align-items: center; }
    .opacity i, .swatch i { width: 36px; height: 36px; border-radius: 8px; display: block; }
    .swatch { display: flex; gap: 6px; align-items: flex-start; }
    .swatch b, .icon b, figcaption b { display: block; font-size: 10px; font-weight: 800; }
    .swatch span, .icon span { display: block; font-size: 7.5px; font-weight: 600; line-height: 1.25; opacity: 0.85; word-break: break-word; }
    .icons { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; align-content: stretch; }
    .icon { border: 1px solid rgba(127,127,127,0.28); border-radius: 8px; padding: 8px; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
    .glyph { display: flex; }
    .glyph svg { display: block; }
    .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .specs.three { grid-template-columns: 1fr 1fr 1fr; }
    .specs.stack { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr 1fr; }
    .specs.dash { grid-template-columns: 1.05fr 1fr; grid-template-rows: 1fr 1fr; }
    .specs.dash figure.spec:first-child { grid-row: 1 / span 2; }
    figure.spec { margin: 0; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 8px; align-items: center; border: 1px solid rgba(127,127,127,0.32); border-radius: 10px; padding: 8px; min-height: 0; overflow: hidden; }
    .specs.three figure.spec, .specs.stack figure.spec { grid-template-columns: 0.85fr 1.15fr; }
    figure.spec img { width: 100%; height: auto; max-height: 100%; object-fit: contain; object-position: center; border-radius: 8px; }
    .measured { display: block; margin-top: 2px; font-size: 7.5px; font-weight: 800; line-height: 1.3; }
    figcaption ol { margin: 3px 0 0; padding-left: 14px; }
    figcaption li { margin: 0 0 2px; font-size: 8px; line-height: 1.3; font-weight: 600; }
    .pair { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
    .pair > div { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
    .pair .specs { flex: 1; }
    .pair figure.spec img { max-height: 148px; }
    .split { display: grid; grid-template-columns: 0.78fr 1.22fr; gap: 8px; min-height: 0; }
    .device { display: grid; grid-template-columns: auto 1fr; gap: 8px; min-height: 0; align-items: start; }
    .device img { height: 100%; width: auto; max-width: 196px; object-fit: contain; object-position: top left; border-radius: 12px; }
    .device ol { margin: 0; padding-left: 16px; }
    .device li { font-size: 9px; line-height: 1.35; font-weight: 650; margin: 0 0 6px; }
    .live { display: flex; flex-direction: column; justify-content: space-evenly; }
    .live b { font-size: 8px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-right: 6px; opacity: 0.55; }
    .index td, .index th { padding: 3px 4px; }
    .index td:nth-child(3) { font-size: 7px; }
  </style></head><body>${pages.join("")}</body></html>`;
}

async function measureAndShoot(page) {
  await page.setContent(harness, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const ids = await page.$$eval("section.shot", (nodes) => nodes.map((n) => n.id));
  const shots = {};
  const measures = [];
  for (const id of ids) {
    const metrics = await page.$eval(`#${id} [id^="m-"]`, (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        radius: cs.borderRadius,
        pad: cs.padding,
        gap: cs.gap && cs.gap !== "normal" ? cs.gap : "0px",
        fs: cs.fontSize,
        fw: cs.fontWeight,
        bg: cs.backgroundColor,
      };
    });
    measures.push({ id, ...metrics });
    await page.$eval(`#${id}`, (section, m) => {
      const target = section.querySelector("[id^='m-']");
      const sr = section.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      const x = tr.left - sr.left;
      const y = tr.top - sr.top;
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "dims");
      const add = (name, attrs) => {
        const node = document.createElementNS(ns, name);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
        svg.appendChild(node);
        return node;
      };
      const red = "#E11D2E";
      const yLine = y + m.h + 8;
      add("line", { x1: x, y1: yLine, x2: x + m.w, y2: yLine, stroke: red, "stroke-width": 1 });
      add("line", { x1: x, y1: yLine - 3, x2: x, y2: yLine + 3, stroke: red, "stroke-width": 1 });
      add("line", { x1: x + m.w, y1: yLine - 3, x2: x + m.w, y2: yLine + 3, stroke: red, "stroke-width": 1 });
      const wLabel = add("text", { x: x + m.w / 2, y: yLine + 11, fill: red, "font-size": 9, "font-weight": 700, "text-anchor": "middle", "font-family": "Outfit" });
      wLabel.textContent = `${m.w}px`;
      const xLine = x + m.w + 8;
      add("line", { x1: xLine, y1: y, x2: xLine, y2: y + m.h, stroke: red, "stroke-width": 1 });
      add("line", { x1: xLine - 3, y1: y, x2: xLine + 3, y2: y, stroke: red, "stroke-width": 1 });
      add("line", { x1: xLine - 3, y1: y + m.h, x2: xLine + 3, y2: y + m.h, stroke: red, "stroke-width": 1 });
      const hLabel = add("text", { x: xLine + 4, y: y + m.h / 2, fill: red, "font-size": 9, "font-weight": 700, "font-family": "Outfit" });
      hLabel.textContent = `${m.h}px`;
      section.appendChild(svg);
    }, metrics);
    const buf = await page.locator(`#${id}`).screenshot({ type: "png" });
    shots[id] = `data:image/png;base64,${buf.toString("base64")}`;
  }
  return { shots, measures };
}

function auditHtml(html) {
  const found = [...html.matchAll(/#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g)].map((m) => m[0].toLowerCase());
  const bad = [...new Set(found)].filter((hex) => !allowedHex.has(hex) && hex !== "#000" && hex !== "#fff" && hex !== "#000000" && hex !== "#ffffff" && hex !== "#e11d2e");
  if (bad.length) {
    throw new Error(`Hex in the PDF is not in the source files: ${bad.join(", ")}`);
  }
  const banned = html.match(/do not|don't|dos and don'ts|use this, not/i);
  if (banned) {
    const at = banned.index || 0;
    throw new Error(`Forbidden wording "${banned[0]}" near: ${html.slice(Math.max(0, at - 60), at + 60)}`);
  }
}

async function main() {
  if (!fs.existsSync(FONT_PATH)) {
    throw new Error(`Outfit font missing at ${FONT_PATH}`);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const { shots, measures } = await measureAndShoot(page);
  const html = buildDocument(shots, measures);
  auditHtml(html);
  const htmlPath = path.join(OUT_DIR, "design-system.html");
  fs.writeFileSync(htmlPath, html);
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.$$eval(".body", (nodes) =>
    nodes.map((n, i) => ({ page: i + 1, extra: n.scrollHeight - n.clientHeight, head: (n.innerText || "").slice(0, 40) })),
  );
  const clipped = overflow.filter((row) => row.extra > 4);
  if (clipped.length) {
    throw new Error(`Page content is clipped: ${clipped.map((row) => `p${row.page} +${row.extra}px (${row.head})`).join("; ")}`);
  }
  const pages = await page.$$(".page");
  for (let i = 0; i < pages.length; i++) {
    await pages[i].$eval(".pn", (el, n) => {
      el.textContent = String(n);
    }, `${i + 1} / ${pages.length}`);
  }
  await page.pdf({
    path: PDF_PATH,
    format: "A4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
  });
  await browser.close();

  const pdfBytes = fs.readFileSync(PDF_PATH);
  const fontNames = [...pdfBytes.toString("latin1").matchAll(/\/(?:BaseFont|FontName)\s*\/([^\s\/\[\]<>]+)/g)].map((m) => m[1]);
  if (!fontNames.some((name) => /Outfit/i.test(name))) {
    throw new Error(`Outfit is not embedded. Fonts: ${fontNames.join(", ") || "none"}`);
  }
  if (fontNames.some((name) => /Helvetica/i.test(name))) {
    throw new Error(`Helvetica is embedded. Fonts: ${fontNames.join(", ")}`);
  }
  let fonts = fontNames.join("\n");
  try {
    fonts = execFileSync("pdffonts", [PDF_PATH], { encoding: "utf8" });
    if (!/Outfit/i.test(fonts)) throw new Error(`pdffonts did not list Outfit.\n${fonts}`);
    if (/Helvetica/i.test(fonts)) throw new Error(`pdffonts lists Helvetica.\n${fonts}`);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
  const bytes = fs.statSync(PDF_PATH).size;
  if (bytes > 10 * 1024 * 1024) throw new Error(`PDF is ${bytes} bytes, over 10 MB`);

  const gapMd = `# Design system PDF gaps\n\nGenerated ${DATE}. These items are absent from the repo, so the PDF does not invent a value for them.\n\n${gaps.map((g) => `- ${g}`).join("\n")}\n\n## Measured components\n\n${measures
    .map((m) => `- ${m.id}: ${m.w}×${m.h}px, radius ${m.radius}, padding ${m.pad}, font ${m.fs} / ${m.fw}`)
    .join("\n")}\n\n## Fonts\n\n\`\`\`\n${fonts || "pdffonts not run"}\n\`\`\`\n`;
  fs.writeFileSync(GAPS_PATH, gapMd);
  console.log(`PDF ${PDF_PATH} (${Math.round(bytes / 1024)} KB, ${measures.length} measured components)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
