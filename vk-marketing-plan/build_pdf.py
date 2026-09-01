# -*- coding: utf-8 -*-
"""Renders the Vidya's Kitchen 8-week marketing brief to HTML, then PDF via Chrome."""

import os
import subprocess
import sys

import plan_data as D

HERE = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(HERE, "Vidyas-Kitchen-8-Week-Marketing-Brief.html")
PDF_PATH = os.path.join(HERE, "Vidyas-Kitchen-8-Week-Marketing-Brief.pdf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = r"""
@page { size: A4; margin: 15mm 14mm 16mm 14mm; }

:root{
  --ink:#1c1614; --ink2:#3d3230; --muted:#6b5c58; --faint:#8a7a75;
  --accent:#BD2320; --accent-d:#8a1a18; --accent-l:#f8eaea;
  --warm:#8a5a12; --warm-l:#f8f0e4;
  --line:#e8ddd9; --soft:#faf6f4;
}
*{ box-sizing:border-box; }
html,body{ margin:0; padding:0; }
body{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;
  font-size:9.3pt; line-height:1.48; color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3,h4{ font-family:"Iowan Old Style",Georgia,"Times New Roman",serif; font-weight:600; }
p{ margin:0 0 6.5pt; }
b,strong{ font-weight:600; color:var(--ink); }
i,em{ font-style:italic; }
a{ color:var(--accent-d); text-decoration:none; }
.pb{ page-break-before:always; }
.avoid{ page-break-inside:avoid; }

.cover{ height:262mm; display:flex; flex-direction:column; justify-content:space-between; }
.cover-top .eyebrow{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.22em;
  text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:12mm;
}
.cover h1{ font-size:34pt; line-height:1.06; margin:0 0 6mm; letter-spacing:-.01em; }
.cover .sub{ font-family:"Iowan Old Style",Georgia,serif; font-size:14pt; line-height:1.35; color:var(--ink2); margin:0 0 8mm; max-width:148mm; }
.cover .rule{ width:34mm; height:3px; background:var(--accent); margin:0 0 8mm; }
.cover .scope{ font-size:10pt; color:var(--muted); letter-spacing:.04em; }
.cover-box{
  border:1px solid var(--line); border-left:3px solid var(--accent); background:var(--soft);
  padding:6mm 7mm; max-width:158mm;
}
.cover-box h4{ margin:0 0 3mm; font-size:11pt; }
.cover-box ul{ margin:0; padding-left:5mm; }
.cover-box li{ margin-bottom:1.5mm; color:var(--ink2); font-size:9.1pt; }
.cover-bot{ border-top:1px solid var(--line); padding-top:5mm; font-size:8.4pt; color:var(--faint); }
.cover-bot .row{ display:flex; justify-content:space-between; }

.sec{ margin:0 0 5.5mm; }
.sec .num{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.5pt; letter-spacing:.2em;
  text-transform:uppercase; color:var(--accent); font-weight:600;
}
.sec h2{ font-size:20.5pt; line-height:1.12; margin:1.4mm 0 2.2mm; letter-spacing:-.005em; }
.sec .lede{ font-size:9.6pt; color:var(--ink2); max-width:162mm; line-height:1.5; margin:0; }
h3.blk{ font-size:12.5pt; margin:7mm 0 2.5mm; page-break-after:avoid; }
h3.blk:first-child{ margin-top:0; }
h4.mini{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.8pt; letter-spacing:.16em;
  text-transform:uppercase; color:var(--accent); font-weight:600; margin:5mm 0 2mm;
  padding-bottom:1.4mm; border-bottom:1px solid var(--line); page-break-after:avoid;
}

table{ width:100%; border-collapse:collapse; font-size:8.3pt; margin:0 0 5mm; }
th{
  text-align:left; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-weight:600;
  font-size:7.2pt; letter-spacing:.1em; text-transform:uppercase; color:#fff; background:var(--accent-d);
  padding:2.4mm 2.2mm; vertical-align:bottom;
}
td{ padding:2.1mm 2.2mm; border-bottom:1px solid var(--line); vertical-align:top; color:var(--ink2); }
tr{ page-break-inside:avoid; }
tbody tr:nth-child(even) td{ background:#fdfafa; }
td b{ color:var(--ink); }
.t-num{ width:7mm; color:var(--faint); }
.r{ text-align:right; white-space:nowrap; }
.t-dense td{ padding:1.5mm 2mm; }
.t-dense th{ padding:2mm; }

.call{ border-left:3px solid var(--accent); background:var(--accent-l); padding:4mm 5mm; margin:0 0 5.5mm; font-size:9pt; }
.call.warm{ border-left-color:var(--warm); background:var(--warm-l); }
.call.dark{ border-left-color:var(--ink); background:#f0ecea; }
.call p:last-child{ margin-bottom:0; }
.call .lbl{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.1pt; letter-spacing:.16em;
  text-transform:uppercase; font-weight:600; color:var(--accent-d); display:block; margin-bottom:1.8mm;
}
.call.warm .lbl{ color:var(--warm); }
.call.dark .lbl{ color:var(--ink); }

.kind{
  display:inline-block; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:6.4pt;
  letter-spacing:.08em; font-weight:600; padding:.7mm 1.5mm; border-radius:2px; margin-right:1.8mm;
}
.k-POST{ background:var(--accent-d); color:#fff; }
.k-REEL{ background:var(--warm); color:#fff; }
.k-STORY{ background:#5c3d38; color:#fff; }
.k-WA{ background:#128C7E; color:#fff; }

.flow{ margin-bottom:4mm; }
.flow .step{ display:flex; gap:4mm; padding:2.4mm 0; border-top:1px solid var(--line); page-break-inside:avoid; }
.flow .step .a{ flex:0 0 38mm; font-weight:600; color:var(--accent-d); font-size:9pt; }
.flow .step .b{ flex:1; color:var(--ink2); font-size:8.6pt; }

.wk{ margin-bottom:4.5mm; page-break-inside:avoid; }
.wk-h{ border-bottom:2px solid var(--accent-d); padding-bottom:1.3mm; }
.wk-h .top{ display:flex; justify-content:space-between; align-items:baseline; }
.wk-h .w{ font-family:"Iowan Old Style",Georgia,serif; font-size:12.5pt; font-weight:600; }
.wk-h .m{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.1pt; letter-spacing:.14em; text-transform:uppercase; color:var(--warm); font-weight:600; }
.item{ margin-bottom:1.1mm; }
.item:last-child{ margin-bottom:0; }

.hooks{ column-count:2; column-gap:8mm; }
.hgrp{ break-inside:avoid; margin-bottom:4mm; }
.hgrp h4{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.5pt; letter-spacing:.13em;
  text-transform:uppercase; color:var(--accent); font-weight:600; margin:0 0 1.4mm;
}
.hgrp ul{ margin:0; padding-left:4mm; }
.hgrp li{ font-size:8.4pt; margin-bottom:.85mm; color:var(--ink2); line-height:1.4; }

.ck{ margin-bottom:4mm; page-break-inside:avoid; }
.ck h4{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.14em;
  text-transform:uppercase; color:var(--accent); font-weight:600; margin:0 0 2mm;
}
.ck ul{ list-style:none; margin:0; padding:0; }
.ck li{ font-size:8.6pt; color:var(--ink2); padding-left:6mm; position:relative; margin-bottom:1.6mm; }
.ck li:before{ content:"☐"; position:absolute; left:0; color:var(--accent); font-size:10pt; }

.foot{ margin-top:8mm; border-top:1px solid var(--line); padding-top:3.5mm; font-size:7.8pt; color:var(--faint); }
.two{ display:flex; gap:6mm; }
.two > div{ flex:1; }
"""


def sec(num, title, lede):
    return (
        f'<div class="sec"><div class="num">{num}</div>'
        f"<h2>{title}</h2><p class=\"lede\">{lede}</p></div>"
    )


def kind(k):
    key = "STORY" if k.startswith("STORY") else ("WA" if k.startswith("WA") else k)
    label = k
    return f'<span class="kind k-{key}">{label}</span>'


def build_cover():
    m = D.META
    return f"""
<div class="cover">
  <div class="cover-top">
    <div class="eyebrow">Launch marketing brief · grounded in the live product</div>
    <h1>Vidya's Kitchen<br>8-week launch</h1>
    <div class="rule"></div>
    <p class="sub">{m['subtitle']}</p>
    <div class="scope">{m['scope']}</div>
  </div>
  <div class="cover-mid">
    <div class="cover-box">
      <h4>This brief is written from the actual app</h4>
      <ul>
        <li>17 against-order dishes · 500gm and 1kg · Chicken / Egg / Mutton only</li>
        <li>Home screen Kitchen picks (not fake best-sellers) and the real checkout path</li>
        <li>WhatsApp bot + PWA — two doors, one kitchen</li>
        <li>Hard rules: 24-hour lead, Sivakasi 15 km, Razorpay only, no COD, no subscription</li>
        <li>Week-by-week quota: 15 posts + 5 Reels, with Week 1 named dish-by-dish</li>
      </ul>
    </div>
  </div>
  <div class="cover-bot">
    <div class="row">
      <span>vidyaskitchenhome.com &nbsp;·&nbsp; WhatsApp +91 75500 28179</span>
      <span>For the marketing person + kitchen · Sep–Oct 2026</span>
    </div>
  </div>
</div>
"""


def build_truth():
    h = ['<div class="pb">']
    h.append(sec(
        "01  ·  Product truth",
        "What we actually sell",
        "Do not market this as Swiggy. The app is against-order home gravies from a Sivakasi kitchen. "
        "Default add-to-cart is 500gm. 1kg is the family/guest size. Breakfast, lunch and dinner in the app "
        "are delivery windows — there is no breakfast menu.",
    ))
    h.append(
        '<div class="call warm"><span class="lbl">One-line positioning (use this, not “fast food”)</span>'
        "<p><b>Sivakasi's home-style gourmet kitchen.</b> Chicken, mutton and egg specials, cooked fresh "
        "against order. Order today — we deliver tomorrow. No rush orders.</p></div>"
    )
    h.append('<div class="flow">')
    facts = [
        ("Site / app", "https://vidyaskitchenhome.com — mobile PWA. Not on Play Store or App Store."),
        ("Order WhatsApp", "+91 75500 28179 — Vidya Bot. Prefill: “Hi Vidya's Kitchen! I'd like to place an order.”"),
        ("Support", "+91 93840 20119 · hello.vidyaskitchen@gmail.com"),
        ("Area", "Sivakasi, Tamil Nadu — 15 km of the kitchen. Ads geo-locked here only."),
        ("Order window", "6 AM–6 PM IST. Slot must start at least 24 hours after the order."),
        ("Slots", "Breakfast 7–9 AM · Lunch 12–2 PM · Dinner 7–9 PM (delivery windows)."),
        ("Pay", "Razorpay — UPI, card, net banking. COD is Coming soon. Do not advertise cash."),
        ("Fees", "Packaging ₹20 + delivery ₹35 + GST 5% on items. Cancel ≥12 hours before the slot."),
        ("Cart", "App: unlimited. WhatsApp bot: max 3 items. Bot nudges users to Open App for photos."),
    ]
    for a, b in facts:
        h.append(f'<div class="step"><div class="a">{a}</div><div class="b">{b}</div></div>')
    h.append("</div></div>")
    return "\n".join(h)


def menu_table(rows):
    out = [
        '<table class="t-dense"><thead><tr>'
        "<th>Dish</th><th class='r'>500gm</th><th class='r'>1kg</th><th>Offer in app</th><th>Caption note</th>"
        "</tr></thead><tbody>"
    ]
    for name, p5, p1, off, note in rows:
        out.append(
            f"<tr><td><b>{name}</b></td><td class='r'>₹{p5}</td><td class='r'>₹{p1}</td>"
            f"<td>{off}</td><td>{note}</td></tr>"
        )
    out.append("</tbody></table>")
    return "\n".join(out)


def build_menu():
    h = ['<div class="pb">']
    h.append(sec(
        "02  ·  The 17 dishes",
        "Quote the weight. Quote the app price.",
        "These numbers are from the customer app (mobileMenuData). WhatsApp catalog uses a single “order” price "
        "that tracks the 1kg figure — never mix the two in one caption. 500gm serves 1–2; 1kg serves 3–4.",
    ))
    h.append(
        '<div class="call"><span class="lbl">Kitchen picks — home screen row until we have real sales</span>'
        "<p>Until 8 paid units exist, the app shows these five as <b>Kitchen picks</b>, not “best sellers”. "
        "All launch ads and Week 1 content start here. Do not invent order counts.</p></div>"
    )
    h.append(menu_table(D.KITCHEN_PICKS))
    h.append("<h4 class='mini'>Chicken — 8 dishes</h4>")
    h.append(menu_table(D.CHICKEN))
    h.append("<h4 class='mini'>Egg — 2 dishes (the try-us door)</h4>")
    h.append(menu_table(D.EGG))
    h.append("<h4 class='mini'>Mutton — 7 dishes (Sunday / guests, not weekday lunchbox)</h4>")
    h.append(menu_table(D.MUTTON))
    h.append(
        '<div class="call dark"><span class="lbl">Price ladder for ads</span>'
        "<p><b>Try us:</b> Egg Curry 500gm ₹149 (25% OFF). "
        "<b>Everyday:</b> Mom's / Sister's 500gm ₹349. "
        "<b>Signature:</b> SIL pepper or Idli Special 500gm ₹425. "
        "<b>Sunday table:</b> any 1kg chicken ₹699–1,199. "
        "<b>Guests:</b> mutton 1kg ₹1,949–2,100. Do not lead ads with mutton.</p></div>"
    )
    h.append("</div>")
    return "\n".join(h)


def build_flow():
    h = ['<div class="pb">']
    h.append(sec(
        "03  ·  App + WhatsApp",
        "Every ad must land on a real screen",
        "Click-to-WhatsApp is the primary paid CTA. “Open App” is the second door (photos, deals, track). "
        "Never send Sivakasi traffic to a store listing.",
    ))
    h.append("<h4 class='mini'>Customer path in the PWA</h4>")
    h.append('<div class="flow">')
    for a, b in D.APP_FLOW:
        h.append(f'<div class="step"><div class="a">{a}</div><div class="b">{b}</div></div>')
    h.append("</div>")
    h.append("<h4 class='mini'>Bot vs app — use this in captions</h4>")
    h.append("<table class='t-dense'><thead><tr>")
    for c in D.WA_VS_APP[0]:
        h.append(f"<th>{c}</th>")
    h.append("</tr></thead><tbody>")
    for row in D.WA_VS_APP[1:]:
        h.append("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>")
    h.append("</tbody></table>")
    h.append(
        '<div class="call"><span class="lbl">Ad landing rule</span>'
        "<p>Primary button: <b>WhatsApp</b> to +91 75500 28179. Secondary: <b>Order on the app</b> → "
        "vidyaskitchenhome.com. If the geofence is still on Chennai, pause paid traffic.</p></div>"
    )
    h.append("</div>")
    return "\n".join(h)


def build_never():
    h = ['<div class="pb">']
    h.append(sec(
        "04  ·  Claims we will not make",
        "If it is not in the product, it is not in the caption",
        "These are the fastest ways to create angry chats the kitchen cannot fulfil.",
    ))
    h.append("<table><thead><tr><th>Do not say</th><th>What the product actually does</th></tr></thead><tbody>")
    for a, b in D.NEVER_CLAIM:
        h.append(f"<tr><td><b>{a}</b></td><td>{b}</td></tr>")
    h.append("</tbody></table></div>")
    return "\n".join(h)


def build_ask():
    h = ['<div class="pb">']
    h.append(sec(
        "05  ·  What we still need",
        "Facebook Business is the shell, not the campaign",
        "Split the ask. The marketing person brings accounts and posting. The kitchen brings capacity, "
        "the Sivakasi geofence, and the five kitchen-pick videos.",
    ))
    h.append('<div class="two">')
    h.append('<div class="ck"><h4>From the marketing person</h4><ul>')
    for t, p in D.ASK_MARKETING:
        h.append(f"<li><b>{t}.</b> {p}</li>")
    h.append("</ul></div>")
    h.append('<div class="ck"><h4>From the kitchen / Vidya</h4><ul>')
    for t, p in D.ASK_KITCHEN:
        h.append(f"<li><b>{t}.</b> {p}</li>")
    h.append("</ul></div></div>")
    h.append(
        '<div class="call"><span class="lbl">We install on our side</span>'
        "<p>Meta Pixel on vidyaskitchenhome.com, UTM into the WhatsApp prefill, Google Business categories. "
        "Do not wait for the marketing person to touch the codebase.</p></div>"
    )
    h.append("</div>")
    return "\n".join(h)


def build_quota():
    h = ['<div class="pb">']
    h.append(sec(
        "06  ·  Weekly quota",
        "15 posts + 5 Reels. Named, not 'content'.",
        "Cross-post every feed item to Instagram and the Facebook Page. Stories = 2/day. "
        "WhatsApp status = daily in September. Every caption ends with WhatsApp.",
    ))
    h.append(
        "<table class='t-dense'><thead><tr>"
        "<th>Week</th><th>Dates</th><th class='r'>Posts</th><th class='r'>Reels</th>"
        "<th class='r'>Stories</th><th class='r'>WA</th><th>Theme (from the real menu)</th>"
        "</tr></thead><tbody>"
    )
    for w, dt, p, r, s, wa, th in D.QUOTA:
        h.append(
            f"<tr><td><b>{w}</b></td><td>{dt}</td><td class='r'>{p}</td><td class='r'>{r}</td>"
            f"<td class='r'>{s}</td><td class='r'>{wa}</td><td>{th}</td></tr>"
        )
    h.append("</tbody></table>")
    h.append(
        '<div class="call dark"><span class="lbl">8-week totals</span>'
        "<p>126 feed posts · 46 Reels · 126 Stories · 62 WhatsApp statuses. "
        "Recommended ad spend ₹45,000 (₹2k–10k by week). Conservative ₹20k. "
        "Do not scale faster than kitchen capacity.</p></div>"
    )
    h.append("<h4 class='mini'>What the 15 posts are — every week</h4>")
    h.append("<table class='t-dense'><thead><tr><th class='r'>#</th><th>Type</th><th>Rule</th></tr></thead><tbody>")
    for n, t, rule in D.POST_MIX:
        h.append(f"<tr><td class='r'><b>{n}</b></td><td>{t}</td><td>{rule}</td></tr>")
    h.append("</tbody></table>")
    h.append("<h4 class='mini'>What the 5 Reels are — every week</h4>")
    h.append("<table class='t-dense'><thead><tr><th>Reel</th><th>Length</th><th>Shot from our product</th></tr></thead><tbody>")
    for a, b, c in D.REEL_MIX:
        h.append(f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>")
    h.append("</tbody></table>")
    h.append(
        "<p>Shoot <b>Sunday evening</b> for the next week. Post at <b>8:30 AM</b> (plan tomorrow), "
        "<b>1:00 PM</b> (Reel), <b>7:30 PM</b> (cut-off / order window).</p>"
    )
    h.append("<h4 class='mini'>Paid channel mix (₹45k)</h4>")
    h.append("<table class='t-dense'><thead><tr><th>Share</th><th>Channel</th><th>How it maps to the app</th></tr></thead><tbody>")
    for a, b, c in D.CHANNELS:
        h.append(f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>")
    h.append("</tbody></table></div>")
    return "\n".join(h)


def build_week1():
    h = ['<div class="pb">']
    h.append(sec(
        "07  ·  Week 1 shot list",
        "1–7 September — 15 posts, 5 Reels, named dishes",
        "Sep 1 is a Tuesday. This is the list to hand the marketing person. Do not substitute biryani, "
        "dosa-as-a-dish, or veg thalis. If a photo is missing, skip that slot — do not fake a dish we don't sell.",
    ))
    for day, items in D.WEEK1_DAYS:
        h.append(f'<div class="wk"><div class="wk-h"><div class="top"><div class="w">{day}</div></div></div>')
        h.append("<table class='t-dense' style='margin-bottom:0'><tbody>")
        for k, t in items:
            h.append(f"<tr><td style='width:28mm'>{kind(k)}</td><td>{t}</td></tr>")
        h.append("</tbody></table></div>")
    h.append("</div>")
    return "\n".join(h)


def build_weeks():
    h = ['<div class="pb">']
    h.append(sec(
        "08  ·  Weeks 2–8",
        "Still 15 posts + 5 Reels — change the dishes, not the volume",
        "Each week names the dishes that may appear. Everything else stays in the 15-post mix from Section 06.",
    ))
    h.append("<table><thead><tr><th>Week</th><th>Theme</th><th>Dishes in rotation</th><th>Note</th></tr></thead><tbody>")
    for w, th, dishes, note in D.WEEKS_REST:
        h.append(f"<tr><td><b>{w}</b></td><td>{th}</td><td>{dishes}</td><td>{note}</td></tr>")
    h.append("</tbody></table>")
    h.append("<h4 class='mini'>Hooks that match the product</h4>")
    h.append('<div class="hooks">')
    for title, items in D.HOOKS:
        lis = "".join(f"<li>{x}</li>" for x in items)
        h.append(f"<div class='hgrp'><h4>{title}</h4><ul>{lis}</ul></div>")
    h.append("</div></div>")
    return "\n".join(h)


def build_kpis():
    h = ['<div class="pb">']
    h.append(sec(
        "09  ·  Hold the marketing person to this",
        "Chats and paid orders — not likes",
        "Review every Friday against kitchen capacity, not reach.",
    ))
    h.append("<table><thead><tr><th>Date</th><th>Checkpoint</th><th>Pass if</th></tr></thead><tbody>")
    for a, b, c in D.KPIS:
        h.append(f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>")
    h.append("</tbody></table>")
    h.append(
        '<div class="call warm"><span class="lbl">Before the first rupee of ads</span>'
        "<p>1. Geofence back to Sivakasi. 2. One WhatsApp order and one app order both complete on Razorpay. "
        "3. Kitchen max-orders number in writing. 4. Five kitchen-pick videos in the camera roll.</p></div>"
    )
    h.append(
        '<div class="foot">Vidya\'s Kitchen 8-Week Launch Marketing Brief · v1.0 · 31 Aug 2026. '
        "Prices, slots, fees and dish names taken from the customer PWA (mobileMenuData, delivery slots, "
        "order-pricing) and WhatsApp copy. Live Supabase discount overrides can change chips — captions must "
        "match what the app shows that day. Flip DELIVERY_TEST_CHENNAI off before paid traffic.</div>"
    )
    h.append("</div>")
    return "\n".join(h)


def main():
    body = "".join([
        build_cover(),
        build_truth(),
        build_menu(),
        build_flow(),
        build_never(),
        build_ask(),
        build_quota(),
        build_week1(),
        build_weeks(),
        build_kpis(),
    ])
    html = (
        "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>"
        f"<title>{D.META['title']}</title><style>{CSS}</style></head><body>{body}</body></html>"
    )
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML written: {HTML_PATH}  ({len(html) / 1024:.1f} KB)")

    if not os.path.exists(CHROME):
        print("Chrome not found; HTML only.", file=sys.stderr)
        sys.exit(1)
    cmd = [
        CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
        "--virtual-time-budget=8000", f"--print-to-pdf={PDF_PATH}", f"file://{HTML_PATH}",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(PDF_PATH):
        print(f"PDF written: {PDF_PATH}  ({os.path.getsize(PDF_PATH) / 1024:.1f} KB)")
    else:
        print("PDF failed:", (r.stderr or r.stdout)[-2000:], file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
