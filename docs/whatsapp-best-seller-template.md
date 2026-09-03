# Best-seller carousel — getting it approved and sending it

The "best selling today" campaign is a **carousel template**, category
**MARKETING**. Everything is built; the only thing standing between here and a
live campaign is Meta's review, which no amount of code can skip.

Code involved:

- `src/lib/whatsapp-marketing.ts` — template definition, audience, send path
- `src/app/api/whatsapp/best-sellers/route.ts` — the trigger (kitchen sign-in required)
- `src/lib/meta-whatsapp.ts` — `createMessageTemplate`, `fetchTemplateStatus`, `sendTemplate`

## Why a template, and not the carousel the menu already uses

The menu sends a free-form interactive carousel. That is only legal inside the
24-hour customer service window — the period after a customer messages you.

A campaign, by definition, goes to people who have not messaged today. Outside
that window Meta accepts nothing but approved templates. So the same visual
needs a second, approved implementation. That is what this is.

Consequences worth knowing before you start:

- Marketing templates are **billed per message**, at India's marketing rate.
- Meta caps marketing sends per number per day and quietly drops the rest.
- Blocks and "report" taps lower your number's quality rating. Two bad
  campaigns can get the number restricted, so cadence matters more than reach.

## What you need once

- `WHATSAPP_BUSINESS_ACCOUNT_ID` in Vercel — the WABA id, not the phone number
  id. Business Settings → WhatsApp Accounts → the ID under the account name.
  Without it, template status reads as `UNKNOWN` and nothing sends.
- `WHATSAPP_ACCESS_TOKEN` with `whatsapp_business_management` permission.
  The token used for sending messages usually already has it.

## Step 1 — run the migration

`supabase/migrations-whatsapp-bot-upgrade.sql` adds `users.marketing_opt_out`.
The audience query reads it, so campaigns must not run before it exists.

## Step 2 — upload the three card images

Carousel templates are reviewed with their images attached, and Meta will only
accept an image it is holding itself. Each card needs a **header handle** from
the Resumable Upload API — a public URL is not accepted at creation time.

For each of the three dish photos:

```bash
# 1. Start a session (file_length is the byte size, in bytes)
curl -X POST "https://graph.facebook.com/v23.0/<APP_ID>/uploads?file_name=card1.jpg&file_length=<BYTES>&file_type=image/jpeg" \
  -H "Authorization: OAuth <ACCESS_TOKEN>"
# → {"id":"upload:XXXX"}

# 2. Upload the bytes
curl -X POST "https://graph.facebook.com/v23.0/upload:XXXX" \
  -H "Authorization: OAuth <ACCESS_TOKEN>" \
  -H "file_offset: 0" \
  --data-binary "@card1.jpg"
# → {"h":"4:c2...."}   ← this is the header handle
```

Take the three `h` values and paste them into
`bestSellerTemplateDefinition()` in `src/lib/whatsapp-marketing.ts`, replacing
`REPLACE_WITH_MEDIA_HANDLE_1/2/3`.

Any three appetising dish photos work — the images are fixed at approval and
only the dish name and price change per send. Pick photos that stay true
whichever dishes are actually selling.

## Step 3 — submit for review

Sign in to the kitchen dashboard, then:

```bash
curl -X POST https://www.vidyaskitchenhome.com/api/whatsapp/best-sellers \
  -H "Content-Type: application/json" \
  --cookie "<your kitchen session cookie>" \
  -d '{"submit": true}'
```

Or submit it by hand in Commerce Manager → WhatsApp Manager → Message
Templates → Create → Carousel, matching the structure in
`bestSellerTemplateDefinition()`:

- Name: `best_selling_today`, language `en`, category **Marketing**
- Body: "Selling fastest at Vidya's Kitchen this week. Everything is cooked to
  order, so we need 24 hours' notice."
- Three cards, each with an image header, a two-variable body
  (`{{1}}` dish name, `{{2}}` price) and one quick-reply button, "Order this"

Review usually lands within a few hours, occasionally 24.

## Step 4 — check status

```bash
curl https://www.vidyaskitchenhome.com/api/whatsapp/best-sellers \
  --cookie "<your kitchen session cookie>"
```

Returns the template status, today's three dishes, and how many people are in
the audience. `canSend` is true only when Meta has approved it.

While the status is `PENDING`, the send path degrades cleanly: it returns the
status and sends nothing. Nothing errors, and nothing goes out by accident.

If it comes back `REJECTED`, the usual causes are a body that reads as
promotional under a non-marketing category, or a variable that could render as
an empty string. Fix and resubmit under the same name.

## Step 5 — send

```bash
# Count the audience without sending
curl -X POST .../api/whatsapp/best-sellers -d '{"dryRun": true}'

# Send to a handful first
curl -X POST .../api/whatsapp/best-sellers -d '{"limit": 10}'

# Then the full list
curl -X POST .../api/whatsapp/best-sellers -d '{}'
```

## Who receives it

Everyone who has placed an order and has not opted out. Deliberately *not*
everyone who ever messaged the bot: a marketing template sent to someone who
only asked a question is the fastest route to a block.

Any customer replying **STOP** is opted out immediately, handled before
anything else in the webhook. Order updates keep flowing — those are
transactional, not marketing, and are unaffected.

## Cadence

There is no cron wired to this on purpose. Once a week is plenty; more than
twice a week and open rates fall while blocks rise. When you are happy with the
rhythm, point a Vercel Cron at the endpoint with a kitchen session, or just
send it by hand on the day.
