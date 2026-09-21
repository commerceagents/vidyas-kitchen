# Order updates on WhatsApp — why templates are required

Order notifications reach two kinds of people who are both **outside WhatsApp's
24-hour customer service window**:

- a customer who orders in the app and never chats to the bot
- a gift recipient, who has never messaged the kitchen at all

Outside that window Meta rejects every free-form message — text, CTA button,
carousel, all of it. The send looks fine in our code, the API returns an error,
and the customer's thread stays empty. That is why order updates appeared in
the PWA and on the dashboard but never on WhatsApp.

An approved **utility template** is the only message Meta will deliver in that
state. The code tries the rich card first (for anyone who *is* inside the
window, it still looks good) and falls back to the template, then to SMS for
gift recipients.

Code involved:

- `src/lib/whatsapp-order-templates.ts` — definitions and send helpers
- `src/lib/whatsapp-order-notify.ts` — card first, template on failure
- `src/app/api/whatsapp/order-templates/route.ts` — submit and check status

## The two templates

| Name | Used for |
|---|---|
| `order_update` | every status change for the buyer, and follow-ups for a gift recipient |
| `gift_order_placed` | the first message to a gift recipient, naming who sent it |

Both are category **UTILITY**, which is cheaper than marketing and is the
correct category for transactional order updates. Both carry a "Track order"
URL button whose variable is the query tail (`?track=<id>`), so the button
opens the right order.

## What you need once

- `WHATSAPP_BUSINESS_ACCOUNT_ID` in Vercel (the WABA id, not the phone number
  id). Without it template status reads `UNKNOWN` and submission fails.
- `WHATSAPP_ACCESS_TOKEN` with `whatsapp_business_management` permission.

## Submitting them

Sign in to the dashboard, then open:

```
https://vidyaskitchenhome.com/api/whatsapp/order-templates?submit=1
```

Meta reviews utility templates in minutes to a few hours. Check status any
time at:

```
https://vidyaskitchenhome.com/api/whatsapp/order-templates
```

`ready: true` means both are APPROVED and every order update will land on
WhatsApp from that point on. Re-submitting an already-created template returns
an error naming the conflict — that is harmless.

## If Meta rejects one

The usual causes, in order of likelihood:

1. **Category re-filed as MARKETING.** Both definitions set
   `allow_category_change: true`, so Meta re-files rather than rejecting. A
   marketing-category order update still sends, it just costs more.
2. **URL button variable.** If Meta objects to the query string in the button
   variable, drop the button from the definition and the template still sends —
   the body carries the full update.
3. **Wording read as promotional.** Keep the body strictly factual; no offers,
   no "order again" nudges.
