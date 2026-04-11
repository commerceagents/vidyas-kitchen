# Vidya's Kitchen — project blackbox

Living log of scope, progress, gaps, and decisions. Last updated: **2026-04-12** (WhatsApp UX decisions recorded).

---

## Product in one line

Next.js app + Meta WhatsApp bot + Razorpay: **order home food in Sivakasi**, with marketing site **vidyaskitchenhome.com** (QR → app, CTA → WhatsApp Business / Vidya bot).

---

## Funnel (as designed)

1. **vidyaskitchenhome.com** — QR opens app URL; CTA opens WhatsApp.
2. **WhatsApp** — webhook at `/api/whatsapp`: greetings, buttons, menu list, subscription rows, payment links, deep link to app with `?phone=` & `?name=`.
3. **App (this repo)** — splash → desktop landing *or* mobile shell (login → location → delivery check → **home TBD**).

---

## Milestones (suggested order)

| # | Milestone | Goal |
|---|------------|------|
| M1 | **Data model locked** | Supabase tables/columns for `users`, `orders`, `order_items`, `menu_items` match what code expects; RLS or server-only writes for admin. |
| M2 | **Real auth** | Replace mock OTP (any 4 digits) with SMS OTP provider; optional WhatsApp-skip path stays coherent. |
| M3 | **Mobile home + menu** | Replace `MobileShell` “Home is coming next!” with browse/cart/slot picker aligned to 24h lead time. |
| M4 | **Checkout + payments** | Razorpay link from cart with correct totals; callback already marks `paid` — wire success UI on `/?status=`. |
| M5 | **AI / orders truth** | Structured order (items, qty, slot, address) via tool-calling or form; stop hardcoded ₹250 / empty `order_items` in `createOrder`. |
| M6 | **Owner + driver ops** | One **order status** vocabulary; transitions from paid → preparing → out → delivered/completed; driver list matches query. |
| M7 | **Post-purchase** | Invoice download/email using `generateInvoicePDF` (currently unused). |
| M8 | **Hardening** | PWA manifest/service worker if you promise “Install”; rate limits on AI routes; webhook signature verify (Meta); `.env.example`. |

---

## Done (in repo today)

- Next.js 15 App Router, Tailwind, Framer Motion, Supabase client, OpenAI agent (`VidyaAgent`), Razorpay payment links + UPI fallback.
- **Landing:** splash; **desktop** rich landing (QR component, WhatsApp); **mobile** login UI, location (Sivakasi center + radius), delivery in/out of range screen.
- **APIs:** `POST /api/ai/chat`, `POST /api/chat` (duplicate leaner handler), `GET|POST /api/whatsapp`, `GET /api/payments/callback`.
- **WhatsApp:** verification GET, interactive buttons + list + restart; PWA URL `https://vidyaskitchenhome.com?phone=…&name=…`.
- **Dashboard** (`/dashboard`): reads `orders`, realtime channel, basic status buttons.
- **Driver** (`/driver`): list + map/call + mark delivered (expects its own status set).
- **Chat page** (`/chat`): calls `/api/ai/chat` with mock phone `web_tester_99`.
- Legal/contact/shipping/refund/terms pages; `jspdf` invoice helper **implemented but not wired** to any route/UI.

---

## Pending / gaps (audit)

### Critical product gaps

1. **Mobile “home”** is a placeholder — no menu, cart, or checkout in the app shell.
2. **OTP** is UI-only: any 4-digit code passes (`PhoneLoginScreen` ~900ms delay, no backend).
3. **`createOrder`** inserts `orders` with **no `order_items`**, and confirmation path uses a **placeholder total (₹250)** and default slot — not production-safe.
4. **WhatsApp → agent** calls `processMessage(text, [] as Message[], from)` — **history is always empty**; long threads lose context unless Meta session state is added.

### Schema / ops consistency

5. **Owner dashboard** statuses: `pending_payment`, `paid`, `preparing`, `completed`, `cancelled`.
6. **Driver page** filters: `confirmed`, `prepping`, `out`, updates to `delivered`.
7. **Agent** creates `pending_payment` then payment → callback sets `paid`. Nothing in this repo sets `preparing` / `out` / `delivered` in a single consistent story — **align enums and DB**.
8. **Dashboard** selects `users(full_name)` via join; **agent** inserts `phone_number` on `orders` — confirm FK `customer_id` / `users` relationship matches Supabase.

### Duplicate / unused code

9. **`/api/chat`** vs **`/api/ai/chat`** — two routes; front-end only uses `/api/ai/chat`. Decide one.
10. **`FoodCarousel`** — not referenced elsewhere in src (orphan until home screen uses it).
11. **`generateInvoicePDF`** — not imported anywhere.

### Infra / security / polish

12. **Supabase from browser** on `/dashboard` and `/driver` — requires correct **RLS** policies or orders are world-readable/writable with anon key.
13. **Environment variables** not documented in-repo — WhatsApp, Razorpay, OpenAI, `NEXT_PUBLIC_APP_URL`, Supabase, optional `KITCHEN_UPI_ID`.
14. **PWA:** bot copy mentions install; this repo has no `manifest` / service worker checked in — confirm if app is deployed separately as PWA on vidyaskitchenhome.com.

---

## Open questions (for you)

1. **Production URL:** Is this Next app deployed at **vidyaskitchenhome.com** or a different host (e.g. `app.…`)? Razorpay `callback_url` uses `NEXT_PUBLIC_APP_URL` — must match the deployment that serves `/api/payments/callback`.
2. **Supabase:** ~~Schema~~ — **done:** see `supabase/schema.sql`. Remaining: align app code + optional migration for payment columns.
3. **Order flow priority:** Finish **in-app ordering** first, or **WhatsApp-only** first with app as secondary?
4. **OTP provider:** Preference (MSG91, Twilio, Firebase Phone, Truecaller, etc.) and budget constraints?
5. **Driver workflow:** Single driver or multiple? Need auth on `/driver`?
6. **Menu source of truth:** Supabase `menu_items` only, or also static fallbacks in `agent.ts`?

---

## Answers received (2026-04-12)

1. **Production URL behavior:** confirmed — same URL on mobile opens the app experience.
2. **Priority:** **WhatsApp-first** commerce flow. App is secondary convenience + install/PWA mode.
3. **OTP provider:** undecided.
4. **Driver workflow/auth:** undecided.
5. **Menu source of truth:** undecided.

---

## Against-order menu (client pricing)

- **Scope:** against-order only; **no subscription** in product for now (weekly plans removed from WhatsApp list + agent payment path).
- **Categories in DB / app:** `chicken`, `mutton`, `egg` (egg dishes are on the second sheet — kept as their own category for clarity).
- **Source of truth:** `src/lib/menu/against-order.ts` (fallback + stable slugs) and `supabase/schema.sql` / `supabase/seed-against-order.sql` inserts.
- Display names use corrected spelling (**PEPPER**, not “peppar” from the PDF scan).
- **Dish images:** client will supply assets; store URLs in `menu_items.image_url` (host on site/CDN Meta can fetch).

---

## WhatsApp bot — UX & rules (decisions)

### Browse menu
- Show **image + name + price** per dish (carousel or list cards where API allows).
- **Multi-select / cart:** WhatsApp does **not** have a native “tick many items” screen like a shopping app. Options we can combine:
  - **App-first cart** (best for multi-select): “Build order in app” + deep link; bot confirms slot & pay.
  - **Bot cart:** user adds items step-by-step (“Add another?” / quantities) or uses **WhatsApp Flows** (form-style, more setup in Meta).
- Until images are ready, bot can use **placeholder** or text-only lists.

### Cut-off (“one day before”)
- **Not** a fixed 7:30 PM rule in code — that was only an example.
- **Product rule:** orders are accepted for a delivery day only if placed **at least one full calendar day before** that service (kitchen needs time to source prep — lunch/dinner especially). Exact **cut-off clock time** (e.g. end of previous day 9 PM) should be one configurable rule after client confirms.
- **UX:** whenever user starts **ordering**, always show a **short line** (WhatsApp: footer text, italic line, or tiny follow-up message — there is no real “tooltip” inside chat).

### Meal slots
- **Primary:** lunch + dinner. **Sometimes:** breakfast. (Model as slot types + `inventory_slots` or order metadata.)

### After payment
- **Track order** must appear/work after **successful payment** (link or in-chat status from Supabase).

### Customer care
- **Talk to a human** required on **both** app and WhatsApp (button → `tel:` / WhatsApp chat to care number / handoff message).

### Carousels
- Goal: **carousel** for **recent orders** + **Order again** CTA. Implementation retries carousel API; **list fallback** if Meta rejects.
- Rich formats depend on **Meta Business / WhatsApp Business Platform** setup and sometimes **business verification**.

### Meta / WhatsApp Business — setup checklist (high level)

1. **Meta Business Account** — [business.facebook.com](https://business.facebook.com): create or use a business, complete business details.
2. **WhatsApp** in Meta Business Suite — add **WhatsApp Business Platform** (Cloud API), not only the small-business phone app (the API is what talks to your webhook).
3. **Phone number** — register a number for WhatsApp Business API; verify via SMS/voice; this number is the bot users chat with.
4. **Meta for Developers** — [developers.facebook.com](https://developers.facebook.com): create an **App** → add **WhatsApp** product → copy **Phone number ID**, **WhatsApp Business Account ID**, generate a **Permanent access token** (with correct permissions) for the server `.env`.
5. **Webhook** — in the app dashboard set **Callback URL** to your live `https://YOUR_DOMAIN/api/whatsapp` and **Verify token** = same as `WHATSAPP_VERIFY_TOKEN` in `.env`; subscribe to `messages` fields.
6. **Templates** (optional) — for **reminders** when the user hasn’t messaged in 24h, create **message templates** in WhatsApp Manager and get them **approved** (category utility/marketing per Meta rules).
7. **Business verification** — if Meta limits features, complete **Business verification** in Business Settings (documents).

*Detailed screens change often; use Meta’s current “Get started with WhatsApp Cloud API” doc as the source of truth.*

---

## Canonical Supabase schema (recorded)

Source of truth in repo: **`supabase/schema.sql`** (matches what you ran in the SQL editor, plus `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` for `uuid_generate_v4()`).

**Tables:** `users`, `menu_items`, `orders`, `order_items`, `inventory_slots`.

**Order statuses in DB:** `pending` → `confirmed` → `prepping` → `out` → `delivered` (defaults on `orders.status`).

### Code vs this schema — must align (next PR)

| Topic | App code today | Your schema |
|--------|----------------|-------------|
| Order row | Inserts `phone_number`, `payment_link_id`, statuses like `pending_payment` / `paid` | `customer_id`, no payment columns; statuses differ |
| Payment callback | Finds order by `payment_link_id` | Column missing — add migration or change callback |
| Dashboard | Buttons for `paid` / `preparing` | Use `confirmed` / `prepping` (or migrate DB to match app) |
| Driver | Already uses `confirmed`, `prepping`, `out` | Matches closely |
| Agent `createOrder` | No `order_items`, no resolved `customer_id` | Must insert `order_items` + FK to `users` |

**Recommendation:** treat `supabase/schema.sql` as the product schema; update TypeScript (`VidyaAgent`, dashboard, callback) to match, and add a small SQL migration for Razorpay fields if you keep payment links (`payment_link_id`, `payment_id`, optional `phone_number` denormalized for WhatsApp-only rows).

---

## How to fetch Supabase schema (guide)

### Option A (quickest, dashboard UI)

1. Open Supabase project → **Table Editor** → check these tables first:
   - `users`
   - `orders`
   - `order_items`
   - `menu_items`
2. For each table, capture:
   - column name + type
   - nullable/default
   - primary key
   - foreign keys
3. Also open **Authentication / Policies** to see RLS policies for order-related tables.
4. Paste all this into a new file in repo, e.g. `supabase-schema-notes.md`.

### Option B (best, SQL export)

In Supabase SQL Editor, run:

```sql
-- Tables + columns
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('users', 'orders', 'order_items', 'menu_items')
order by table_name, ordinal_position;

-- Foreign keys
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('users', 'orders', 'order_items', 'menu_items');
```

Copy the result and add it to `supabase-schema-notes.md`.

---

## Session log

### 2026-04-12

- **User context:** Marketing site vidyaskitchenhome.com with QR → app and CTA → WhatsApp Business → Vidya bot.
- **Agent analysis:** Confirmed product is Vidya's Kitchen commerce + AI + payments; mobile post-onboarding screen is explicitly “next phase”.
- **This file created** as single readable blackbox for milestones, done vs pending, and questions.
- **User decisions captured:** same mobile URL app behavior confirmed; strategy set to WhatsApp-first; Supabase schema fetch guide added; OTP/driver/menu source still pending decisions.
- **Schema:** user-provided SQL captured in `supabase/schema.sql`; blackbox “code vs schema” table added for alignment work after Supabase restore.
- **WhatsApp product:** menu with images + multi-select via app/bot hybrid; cut-off line always on order; track after pay; human support app+WA; lunch/dinner primary; one-day-before lead time (flexible clock TBD); carousel + Meta setup notes added above.

---

## Env checklist (incomplete — verify in deployment)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_APP_URL` (origin for payment callback)
- `KITCHEN_UPI_ID` (UPI fallback)
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- `SUPPORT_WHATSAPP` (optional) — digits only with country code, no `+`, e.g. `919876543210` for `wa.me` link in bot “customer care” messages

Add a committed **`.env.example`** when values are finalized (no secrets).
