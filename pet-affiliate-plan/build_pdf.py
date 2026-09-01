# -*- coding: utf-8 -*-
"""Renders the Pet Affiliate 90-Day Playbook to HTML, then to PDF via headless Chrome."""

import os
import subprocess
import sys

import plan_data as D

HERE = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(HERE, "Pet-Affiliate-90-Day-Playbook.html")
PDF_PATH = os.path.join(HERE, "Pet-Affiliate-90-Day-Playbook.pdf")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: A4; margin: 15mm 14mm 15mm 14mm; }

:root{
  --ink:#16232e; --ink2:#31424f; --muted:#65788a; --faint:#8d9daa;
  --accent:#0f6f66; --accent-d:#0a4f49; --accent-l:#e6f2f0;
  --warm:#b1560c; --warm-l:#fdf1e4;
  --line:#dde5ea; --soft:#f5f8f9;
}
*{ box-sizing:border-box; }
html,body{ margin:0; padding:0; }
body{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;
  font-size:9.4pt; line-height:1.5; color:var(--ink);
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3,h4{ font-family:"Iowan Old Style",Georgia,"Times New Roman",serif; font-weight:600; }
p{ margin:0 0 7pt; }
b,strong{ font-weight:600; color:var(--ink); }
i,em{ font-style:italic; }
a{ color:var(--accent-d); text-decoration:none; }
.pb{ page-break-before:always; }
.avoid{ page-break-inside:avoid; }

/* ---------- cover ---------- */
.cover{ height:262mm; display:flex; flex-direction:column; justify-content:space-between; }
.cover-top .eyebrow{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.22em;
  text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:14mm;
}
.cover h1{ font-size:40pt; line-height:1.04; margin:0 0 6mm; letter-spacing:-.01em; }
.cover .sub{ font-family:"Iowan Old Style",Georgia,serif; font-size:15pt; line-height:1.35; color:var(--ink2); margin:0 0 9mm; max-width:135mm; }
.cover .rule{ width:34mm; height:3px; background:var(--accent); margin:0 0 9mm; }
.cover .scope{ font-size:10.5pt; color:var(--muted); letter-spacing:.04em; }
.cover-mid{ margin-top:8mm; }
.cover-box{
  border:1px solid var(--line); border-left:3px solid var(--accent); background:var(--soft);
  padding:6mm 7mm; max-width:150mm;
}
.cover-box h4{ margin:0 0 3mm; font-size:11pt; }
.cover-box ul{ margin:0; padding-left:5mm; }
.cover-box li{ margin-bottom:1.6mm; color:var(--ink2); font-size:9.2pt; }
.cover-bot{ border-top:1px solid var(--line); padding-top:5mm; font-size:8.6pt; color:var(--faint); }
.cover-bot .row{ display:flex; justify-content:space-between; }

/* ---------- section headers ---------- */
.sec{ margin:0 0 6mm; }
.sec .num{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.6pt; letter-spacing:.2em;
  text-transform:uppercase; color:var(--accent); font-weight:600;
}
.sec h2{ font-size:22pt; line-height:1.12; margin:1.5mm 0 2.5mm; letter-spacing:-.005em; }
.sec .lede{ font-size:10pt; color:var(--ink2); max-width:158mm; line-height:1.55; margin:0; }
h3.blk{ font-size:13pt; margin:8mm 0 3mm; page-break-after:avoid; }
h3.blk:first-child{ margin-top:0; }
h4.mini{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.16em;
  text-transform:uppercase; color:var(--accent); font-weight:600; margin:5mm 0 2mm;
  padding-bottom:1.5mm; border-bottom:1px solid var(--line); page-break-after:avoid;
}
h4.mini + p{ page-break-before:avoid; }

/* ---------- tables ---------- */
table{ width:100%; border-collapse:collapse; font-size:8.5pt; margin:0 0 5mm; }
th{
  text-align:left; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-weight:600;
  font-size:7.4pt; letter-spacing:.1em; text-transform:uppercase; color:#fff; background:var(--accent-d);
  padding:2.6mm 2.4mm; vertical-align:bottom;
}
td{ padding:2.4mm 2.4mm; border-bottom:1px solid var(--line); vertical-align:top; color:var(--ink2); }
tr{ page-break-inside:avoid; }
tbody tr:nth-child(even) td{ background:#fafcfc; }
td b{ color:var(--ink); }
.t-num{ color:var(--faint); font-size:8pt; width:7mm; }
.t-tight td, .t-tight th{ padding:2mm 2.2mm; }
.t-dense td{ padding:1.4mm 2.2mm; }
.t-dense th{ padding:2.2mm 2.2mm; }

/* ---------- pills / tags ---------- */
.pill{
  display:inline-block; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:6.6pt;
  letter-spacing:.09em; text-transform:uppercase; font-weight:600; padding:.9mm 1.8mm;
  border-radius:2px; white-space:nowrap;
}
.p-added{ background:var(--warm); color:#fff; }
.p-split{ background:#d9e6ea; color:#3c5560; }
.p-yours{ background:#eef3f5; color:var(--faint); }
.p-a{ background:var(--accent-d); color:#fff; }
.p-b{ background:#4d7f8c; color:#fff; }
.p-c{ background:#cdd9de; color:#41545e; }
.p-dog{ background:#eaf1f3; color:#3c5560; }
.p-cat{ background:#f6eee6; color:#8a5423; }
.p-both{ background:#e9f1ef; color:#0a4f49; }

.kind{
  display:inline-block; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:6.5pt;
  letter-spacing:.09em; font-weight:600; padding:.9mm 1.6mm; border-radius:2px; min-width:13mm;
  text-align:center; margin-right:2mm;
}
.k-BLOG{ background:var(--accent-d); color:#fff; }
.k-REEL{ background:var(--warm); color:#fff; }
.k-SHORT{ background:#8a3d6b; color:#fff; }
.k-LONG{ background:#1f4e6b; color:#fff; }
.k-ROUNDUP{ background:#5d6f2e; color:#fff; }
.k-ADMIN{ background:#e7edf0; color:#5f717c; }
.k-AUDIT{ background:#2b2b2b; color:#fff; }

/* ---------- callouts ---------- */
.call{ border-left:3px solid var(--accent); background:var(--accent-l); padding:4mm 5mm; margin:0 0 6mm; font-size:9pt; }
.call.warm{ border-left-color:var(--warm); background:var(--warm-l); }
.call.dark{ border-left-color:var(--ink); background:#eef2f4; }
.call p:last-child{ margin-bottom:0; }
.call .lbl{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.2pt; letter-spacing:.16em;
  text-transform:uppercase; font-weight:600; color:var(--accent-d); display:block; margin-bottom:2mm;
}
.call.warm .lbl{ color:var(--warm); }
.call.dark .lbl{ color:var(--ink); }

/* ---------- issue cards ---------- */
.issue{ border-top:1px solid var(--line); padding:4mm 0 1mm; page-break-inside:avoid; }
.issue h4{ font-size:11pt; margin:0 0 2mm; }
.issue h4 .n{ color:var(--warm); font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8.5pt; margin-right:2.5mm; }
.issue .p{ color:var(--ink2); margin:0 0 2.5mm; }
.issue .fix{ background:var(--soft); border-left:2px solid var(--accent); padding:2.5mm 4mm; font-size:8.8pt; }
.issue .fix .lbl{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7pt; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color:var(--accent); }

/* ---------- category groups ---------- */
.cgroup{ margin-bottom:5mm; page-break-inside:avoid; }
.cgroup-h{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.14em;
  text-transform:uppercase; font-weight:600; color:var(--warm); background:var(--warm-l);
  padding:2mm 3mm; margin-bottom:0;
}

/* ---------- deep dive cards ---------- */
.dd{ border:1px solid var(--line); border-top:3px solid var(--accent); padding:4.5mm 5mm; margin-bottom:5mm; page-break-inside:avoid; }
.dd h3{ font-size:13pt; margin:0 0 1mm; }
.dd h3 .n{ color:var(--accent); font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:9pt; margin-right:2mm; }
.dd .grid{ margin-top:2.5mm; }
.dd .r{ display:flex; gap:3mm; padding:1.6mm 0; border-top:1px solid #edf2f4; font-size:8.6pt; }
.dd .r:first-child{ border-top:none; }
.dd .r .k{
  flex:0 0 26mm; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.2pt;
  letter-spacing:.1em; text-transform:uppercase; font-weight:600; color:var(--faint); padding-top:.6mm;
}
.dd .r .v{ flex:1; color:var(--ink2); }
.dd .kw{ font-family:"SF Mono",Menlo,monospace; font-size:7.6pt; color:var(--accent-d); line-height:1.6; }
.dd ul.h{ margin:0; padding-left:4mm; }
.dd ul.h li{ margin-bottom:1mm; font-style:italic; color:var(--ink); }

/* ---------- persona ---------- */
.per{ border:1px solid var(--line); background:#fcfdfd; padding:4mm 4.5mm; margin-bottom:4mm; page-break-inside:avoid; }
.per h4{ font-size:11.5pt; margin:0 0 1.5mm; }
.per .meta{ font-size:7.6pt; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; margin-bottom:2.5mm; }
.per .d{ color:var(--ink2); margin-bottom:2.5mm; font-size:8.8pt; }
.per .l{ font-size:8.5pt; margin-bottom:1.4mm; color:var(--ink2); }
.per .l span{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.2pt; letter-spacing:.1em; text-transform:uppercase; font-weight:600; color:var(--accent); margin-right:2mm; }
.per .l.avoid span{ color:var(--warm); }

/* ---------- hooks ---------- */
.hooks{ column-count:2; column-gap:8mm; }
.hgrp{ page-break-inside:avoid; break-inside:avoid; margin-bottom:4mm; }
.hgrp h4{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.6pt; letter-spacing:.13em; text-transform:uppercase; color:var(--accent); font-weight:600; margin:0 0 1.5mm; }
.hgrp ul{ margin:0; padding-left:4mm; }
.hgrp li{ font-size:8.5pt; margin-bottom:.9mm; color:var(--ink2); line-height:1.42; }

/* ---------- week blocks ---------- */
.wk{ margin-bottom:5mm; page-break-inside:avoid; }
.wk-h{ border-bottom:2px solid var(--accent-d); padding-bottom:1.4mm; margin-bottom:0; }
.wk-h .top{ display:flex; justify-content:space-between; align-items:baseline; }
.wk-h .w{ font-family:"Iowan Old Style",Georgia,serif; font-size:13pt; font-weight:600; }
.wk-h .m{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.2pt; letter-spacing:.14em; text-transform:uppercase; color:var(--warm); font-weight:600; }
.wk-h .th{ font-size:9.2pt; color:var(--accent-d); font-weight:600; margin-top:.4mm; }
.wk-goal{ background:var(--soft); padding:1.7mm 3mm; font-size:8.1pt; color:var(--ink2); border-left:2px solid var(--accent); }
.wk-goal span{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7pt; letter-spacing:.13em; text-transform:uppercase; font-weight:600; color:var(--accent); margin-right:2mm; }
table.cal{ margin-top:1.8mm; margin-bottom:0; font-size:8.2pt; }
table.cal th{ background:#31424f; padding:1.8mm 2.4mm; }
table.cal td{ padding:1.3mm 2.4mm; line-height:1.38; }
table.cal td.d{ width:13mm; color:var(--ink); }
table.cal td.d b{ font-size:9.2pt; }
table.cal td.d i{ font-style:normal; color:var(--faint); font-size:7.4pt; display:block; }
table.cal td.c{ width:24mm; font-size:7.4pt; color:var(--faint); }
table.cal .item{ margin-bottom:.9mm; }
table.cal .item:last-child{ margin-bottom:0; }

/* ---------- checklist ---------- */
.ck{ margin-bottom:4mm; page-break-inside:avoid; }
.ck h4{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:600; margin:0 0 2mm; }
.ck ul{ list-style:none; margin:0; padding:0; }
.ck li{ font-size:8.7pt; color:var(--ink2); padding-left:6mm; position:relative; margin-bottom:1.8mm; }
.ck li:before{ content:"☐"; position:absolute; left:0; color:var(--accent); font-size:10pt; }
.ck.tight li{ margin-bottom:1.1mm; }

/* ---------- flow ---------- */
.flow{ margin-bottom:5mm; }
.flow .step{ display:flex; gap:4mm; padding:2.6mm 0; border-top:1px solid var(--line); page-break-inside:avoid; }
.flow .step .a{ flex:0 0 40mm; font-weight:600; color:var(--accent-d); font-size:9pt; }
.flow .step .b{ flex:1; color:var(--ink2); font-size:8.7pt; }

/* ---------- research ---------- */
.rd{ border:1px solid var(--line); padding:4mm 4.5mm; margin-bottom:4.5mm; page-break-inside:avoid; }
.rd h4{ font-size:11.5pt; margin:0 0 2mm; color:var(--accent-d); }
.rd .p{ color:var(--ink2); font-size:8.8pt; margin-bottom:2.5mm; }
.rd .tools{ background:var(--soft); padding:2.5mm 3mm; }
.rd .tools .lbl{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:6.9pt; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color:var(--faint); display:block; margin-bottom:1.5mm; }
.rd .tools ul{ margin:0; padding-left:4mm; }
.rd .tools li{ font-size:8.2pt; color:var(--ink2); margin-bottom:.9mm; }

.foot{ margin-top:10mm; border-top:1px solid var(--line); padding-top:4mm; font-size:8pt; color:var(--faint); }
"""


def esc(s):
    return s


def pill(status):
    m = {"added": ("p-added", "Added"), "split": ("p-split", "Split out"), "yours": ("p-yours", "In your list")}
    c, t = m[status]
    return f'<span class="pill {c}">{t}</span>'


def petpill(p):
    c = {"Dog": "p-dog", "Cat": "p-cat", "Both": "p-both"}[p]
    return f'<span class="pill {c}">{p}</span>'


def sec(num, title, lede):
    return f'<div class="sec"><div class="num">{num}</div><h2>{title}</h2><p class="lede">{lede}</p></div>'


# ------------------------------------------------------------------ builders

def build_cover():
    m = D.META
    return f"""
<div class="cover">
  <div class="cover-top">
    <div class="eyebrow">Affiliate Marketing · Research &amp; Execution Brief</div>
    <h1>The Pet<br>Affiliate<br>Playbook</h1>
    <div class="rule"></div>
    <p class="sub">{m['subtitle']}</p>
    <div class="scope">{m['scope']}</div>
  </div>
  <div class="cover-mid">
    <div class="cover-box">
      <h4>What's inside</h4>
      <ul>
        <li>A review of the existing three-month plan — what works, and seven things to fix</li>
        <li>The complete category master list: 28 categories for dogs and cats in India, with 12 additions to the original 16</li>
        <li>A category scorecard — order value, commission, competition and priority tier</li>
        <li>Deep dives on the ten categories that will actually earn</li>
        <li>Seven audience personas and a bank of 48 tested hook formats</li>
        <li>The full 90-day calendar: 13 weeks, mapped day by day, Day 1 to Day 91</li>
        <li>Affiliate programs and commission rates in India, with the monetisation maths</li>
        <li>Disclosure and compliance rules, realistic KPIs, and the seasonality calendar</li>
        <li>Five research deliverables with deadlines and the tools to produce them</li>
      </ul>
    </div>
  </div>
  <div class="cover-bot">
    <div class="row"><div>{m['prepared_for']}</div><div>{m['version']}</div></div>
  </div>
</div>
"""


def build_review():
    h = ['<div class="pb">']
    h.append(sec("Section 01", "The plan, reviewed",
                 "The cadence in the existing plan is realistic for one person and the ramp from broad to focused is the right "
                 "shape. Below is the plan as it stands, then seven gaps worth closing before Day 1."))
    h.append('<h4 class="mini">The plan as submitted</h4>')
    h.append('<table class="t-tight"><thead><tr><th>Phase</th><th>Window</th><th>Blog</th><th>Reels</th>'
             '<th>Shorts</th><th>Long-form</th><th>Focus</th></tr></thead><tbody>')
    for row in D.PLAN_SNAPSHOT:
        h.append("<tr>" + f"<td><b>{row[0]}</b></td>" + "".join(f"<td>{c}</td>" for c in row[1:]) + "</tr>")
    h.append("</tbody></table>")

    h.append('<div class="call"><span class="lbl">One structural change to note</span>'
             "<p>Thirty days does not divide into calendar weeks, and switching cadence mid-week breaks the batching rhythm that "
             "makes this workload survivable. So the calendar in this document runs Month-1 cadence for five weeks (Days 1–35), "
             "Month-2 cadence for four weeks (Days 36–63) and Month-3 cadence for four weeks (Days 64–91). Day 30, Day 60 and "
             "Day 90 are all marked in place so nothing is lost against the original brief — and the extra Month-1 week is "
             "precisely what makes the 15–20 post target reachable.</p></div>")

    h.append('<h4 class="mini">Seven gaps to close</h4>')
    for i, it in enumerate(D.PLAN_ISSUES, 1):
        h.append(f'<div class="issue"><h4><span class="n">{i:02d}</span>{it["t"]}</h4>'
                 f'<p class="p">{it["p"]}</p>'
                 f'<div class="fix"><span class="lbl">Fix</span> {it["fix"]}</div></div>')
    h.append("</div>")
    return "\n".join(h)


def build_categories():
    h = ['<div class="pb">']
    h.append(sec("Section 02", "Category master list",
                 "Twenty-eight categories covering dogs and cats in the Indian market. The sixteen from the original handwritten "
                 "list are all here — mostly with names tightened and sub-categories filled in. Twelve are new, marked in orange. "
                 "The most important omission was food and nutrition, which is the single largest revenue pool in Indian pet care."))

    for gname, items in D.CATEGORIES:
        h.append(f'<div class="cgroup"><div class="cgroup-h">{gname}</div>')
        h.append('<table class="t-tight"><tbody>')
        for num, name, subs, pet, status in items:
            h.append(f'<tr><td class="t-num">{num}</td>'
                     f'<td style="width:44mm"><b>{name}</b><br>{petpill(pet)} {pill(status)}</td>'
                     f'<td>{subs}</td></tr>')
        h.append("</tbody></table></div>")

    h.append(f'<div class="call warm"><span class="lbl">The highest-converting format isn\'t a category</span>'
             f"<p>{D.META_CATEGORY_NOTE}</p></div>")
    h.append("</div>")
    return "\n".join(h)


def build_scorecard():
    h = ['<div class="pb">']
    h.append(sec("Section 03", "Which categories actually sell",
                 "Every category scored on repeat-purchase rate, typical order value in India, realistic commission per sale, "
                 "search competition and how easily the benefit can be shown on camera. Tiers indicate publishing priority, "
                 "not category size."))

    h.append(f'<div class="call dark"><span class="lbl">Read this first</span><p>{D.QUICK_WIN_NOTE}</p></div>')

    h.append('<table class="t-dense"><thead><tr><th style="width:8mm">Tier</th><th>Category</th><th>Repeat purchase</th>'
             '<th>Typical order value</th><th>₹ per sale</th><th>SEO competition</th><th>Reel-ability</th>'
             '</tr></thead><tbody>')
    for tier, cat, rep, aov, per, comp, reel in D.SCORECARD:
        h.append(f'<tr><td><span class="pill p-{tier.lower()}">{tier}</span></td><td><b>{cat}</b></td>'
                 f'<td>{rep}</td><td>{aov}</td><td>{per}</td><td>{comp}</td><td>{reel}</td></tr>')
    h.append("</tbody></table>")

    h.append('<p style="font-size:7.8pt;color:#8d9daa;margin-top:-2mm">Order values are typical Indian online price bands, '
             'August 2026. "₹ per sale" spans the range between a percentage program (Amazon.in, 4.7% on pet products) and a '
             'flat-fee program (Supertails-style, ₹250–400 per qualifying new-customer order) — which is why the low end looks '
             'small and the high end does not.</p>')

    for t, note in D.TIER_NOTES:
        h.append(f'<h4 class="mini">{t}</h4><p>{note}</p>')
    h.append("</div>")
    return "\n".join(h)


def build_deepdive():
    h = ['<div class="pb">']
    h.append(sec("Section 04", "The ten categories that will earn",
                 "For each: why it earns, who buys it, the moment that triggers the purchase, the search terms to target, "
                 "three ready-to-use hooks, and the practical catch."))
    for d in D.DEEP_DIVE:
        hooks = "".join(f"<li>{x}</li>" for x in d["hooks"])
        h.append(f"""
<div class="dd">
  <h3><span class="n">{d['n']:02d}</span>{d['cat']}</h3>
  <div class="grid">
    <div class="r"><div class="k">Why it earns</div><div class="v">{d['why']}</div></div>
    <div class="r"><div class="k">Who buys</div><div class="v">{d['who']}</div></div>
    <div class="r"><div class="k">Buying trigger</div><div class="v">{d['trigger']}</div></div>
    <div class="r"><div class="k">Keywords</div><div class="v kw">{d['kw']}</div></div>
    <div class="r"><div class="k">Hooks</div><div class="v"><ul class="h">{hooks}</ul></div></div>
    <div class="r"><div class="k">The catch</div><div class="v">{d['note']}</div></div>
  </div>
</div>""")
    h.append("</div>")
    return "\n".join(h)


def build_personas():
    h = ['<div class="pb">']
    h.append(sec("Section 05", "Who you are writing for",
                 "Seven distinct buyers. Most Indian pet content is written for exactly one of them — the English-speaking metro "
                 "dog parent — which is why the other six are commercially interesting."))
    for p in D.PERSONAS:
        h.append(f"""
<div class="per">
  <h4>{p['n']}</h4>
  <div class="meta">{p['age']} &nbsp;·&nbsp; {p['loc']} &nbsp;·&nbsp; Spends {p['spend']}</div>
  <div class="d">{p['desc']}</div>
  <div class="l"><span>Buys</span>{p['buys']}</div>
  <div class="l"><span>Reach them</span>{p['reach']}</div>
  <div class="l avoid"><span>Don't</span>{p['avoid']}</div>
</div>""")
    h.append("</div>")
    return "\n".join(h)


def build_hooks():
    h = ['<div class="pb">']
    h.append(sec("Section 06", "The hook bank",
                 "Forty-eight hooks across eight formats, all written for this niche and this market. Use them as written, or "
                 "swap the product and keep the structure — the structure is what does the work."))
    h.append('<div class="hooks">')
    for grp, items in D.HOOK_BANK:
        lis = "".join(f"<li>{x}</li>" for x in items)
        h.append(f'<div class="hgrp"><h4>{grp}</h4><ul>{lis}</ul></div>')
    h.append("</div>")
    h.append("</div>")
    # rules ride on the next page together with Section 07, which has room for them
    h.append('<div class="pb"><h4 class="mini" style="margin-top:0">Six rules that matter more than the hooks</h4>'
             '<div class="ck tight"><ul>')
    for r in D.HOOK_RULES:
        h.append(f"<li>{r}</li>")
    h.append("</ul></div></div>")
    return "\n".join(h)


def build_repurpose():
    h = ['<div style="margin-top:8mm">']
    h.append(sec("Section 07", "The repurposing engine",
                 "Nine published assets a week is not nine ideas a week. Research three topics, produce nine assets. This is the "
                 "single mechanism that decides whether the calendar survives past week three."))
    h.append('<div class="flow">')
    for a, b in D.REPURPOSE:
        h.append(f'<div class="step"><div class="a">{a}</div><div class="b">{b}</div></div>')
    h.append("</div>")
    h.append('<div class="call"><span class="lbl">The weekly rhythm</span>'
             "<p><b>Sunday:</b> pick three topics, write the shot list, buy or borrow any products needed. "
             "<b>Monday:</b> shoot everything for the week in one two-to-three hour block — all Reels, all Shorts, all Pin images. "
             "<b>Tuesday to Thursday:</b> write the blog posts. <b>Friday:</b> edit and schedule the whole week. "
             "<b>Saturday:</b> engagement only — reply to every comment and DM, because early-stage reach comes from conversation. "
             "One shoot day, one edit day. Never film daily; that is what kills content plans.</p></div>")
    h.append("</div>")
    return "\n".join(h)


def build_week0():
    w = D.WEEK0
    h = ['<div class="pb">']
    h.append(sec("Section 08", w["title"], w["sub"]))
    for gname, items in w["groups"]:
        h.append(f'<div class="ck"><h4>{gname}</h4><ul>')
        for it in items:
            h.append(f"<li>{it}</li>")
        h.append("</ul></div>")
    h.append('<div class="call warm"><span class="lbl">Why Week 0 is not optional</span>'
             "<p>Amazon Associates will not approve an empty site, and a visitor who lands on a one-post blog does not come back. "
             "Five posts live on Day 1 solves both problems, and it front-loads the Month-1 post count so the 15–20 target is "
             "comfortable rather than desperate.</p></div>")
    h.append("</div>")
    return "\n".join(h)


def build_calendar():
    h = ['<div class="pb">']
    h.append(sec("Section 09", "The 90-day calendar",
                 "Thirteen weeks, Day 1 to Day 91, every publishing slot filled with a specific deliverable. Blog titles are "
                 "written to be published as-is. Sundays in Months 1 and 2 are deliberately kept free of publishing — that is "
                 "the review and planning slot, and removing it is the fastest way to burn out."))
    h.append('<div class="call"><span class="lbl">Legend</span><p>'
             '<span class="kind k-BLOG">BLOG</span> long-form post &nbsp; '
             '<span class="kind k-REEL">REEL</span> Instagram Reel &nbsp; '
             '<span class="kind k-SHORT">SHORT</span> YouTube Short &nbsp; '
             '<span class="kind k-LONG">LONG</span> long-form YouTube &nbsp; '
             '<span class="kind k-ROUNDUP">ROUND</span> Sunday roundup &nbsp; '
             '<span class="kind k-ADMIN">ADMIN</span> no publishing &nbsp; '
             '<span class="kind k-AUDIT">AUDIT</span> formal review'
             '</p></div>')

    for num, days, month, theme, goal, rows in D.WEEKS:
        h.append('<div class="wk">')
        h.append(f'<div class="wk-h"><div class="top"><div class="w">Week {num}</div>'
                 f'<div class="m">{month} &nbsp;·&nbsp; {days}</div></div>'
                 f'<div class="th">{theme}</div></div>')
        h.append(f'<div class="wk-goal"><span>Goal</span>{goal}</div>')
        h.append('<table class="cal"><thead><tr><th>Day</th><th>Publish</th><th>Category</th></tr></thead><tbody>')
        for day, wd, items, cat in rows:
            cells = "".join(
                f'<div class="item"><span class="kind k-{k}">{"ROUND" if k == "ROUNDUP" else k}</span>{t}</div>'
                for k, t in items)
            h.append(f'<tr><td class="d"><b>{day}</b><i>{wd}</i></td><td>{cells}</td><td class="c">{cat}</td></tr>')
        h.append("</tbody></table></div>")

    h.append('<div class="call dark"><span class="lbl">Output after 91 days</span>'
             "<p>31 blog posts (36 with Week 0) · 62 Instagram Reels · 26 YouTube Shorts · 2 long-form YouTube videos · "
             "4 Sunday roundups · roughly 180 Pinterest Pins · 31 carousels. Three formal audits at Day 35, Day 63 and Day 91.</p></div>")
    h.append("</div>")
    return "\n".join(h)


def build_money():
    h = ['<div class="pb">']
    h.append(sec("Section 10", "Affiliate programs &amp; the monetisation maths",
                 "Rates verified against published schedules in August 2026. All of them change without notice — check your own "
                 "dashboard before quoting a rate in any content or client report."))
    h.append('<table class="t-tight"><thead><tr><th>Program</th><th>Rate</th><th>Cookie</th><th>Notes</th>'
             "</tr></thead><tbody>")
    for name, rate, cookie, note in D.PROGRAMS:
        h.append(f"<tr><td><b>{name}</b></td><td>{rate}</td><td>{cookie}</td><td>{note}</td></tr>")
    h.append("</tbody></table>")
    h.append(f'<div class="call warm"><span class="lbl">The maths that changes everything</span><p>{D.MONETISATION_MATH}</p></div>')
    h.append("</div>")
    return "\n".join(h)


def build_compliance():
    h = ['<div class="pb">']
    h.append(sec("Section 11", "Disclosure, compliance &amp; risk",
                 "Six rules. The first two protect the income; the third protects against something worse. None of this is "
                 "optional and all of it takes about ten minutes a week to get right."))
    for i, (t, p) in enumerate(D.COMPLIANCE, 1):
        h.append(f'<div class="issue"><h4><span class="n">{i:02d}</span>{t}</h4><p class="p">{p}</p></div>')
    h.append("</div>")
    return "\n".join(h)


def build_kpis():
    h = ['<div class="pb">']
    h.append(sec("Section 12", "Targets worth measuring",
                 "Output targets are commitments. Revenue targets are ranges, and the range is wide because this niche is "
                 "genuinely unpredictable at small scale."))
    h.append('<table class="t-tight"><thead><tr><th>Phase</th><th>Output</th><th>Sessions/day</th><th>IG followers</th>'
             "<th>YT subs</th><th>Commission</th><th>What actually matters this month</th></tr></thead><tbody>")
    for row in D.KPIS:
        h.append("<tr>" + f"<td><b>{row[0]}</b></td>" + "".join(f"<td>{c}</td>" for c in row[1:]) + "</tr>")
    h.append("</tbody></table>")
    h.append(f'<div class="call dark"><span class="lbl">Calibration</span><p>{D.KPI_CAVEAT}</p></div>')
    h.append('<h4 class="mini">The six leading indicators</h4>')
    h.append('<div class="flow">')
    for a, b in D.LEADING_INDICATORS:
        h.append(f'<div class="step"><div class="a">{a}</div><div class="b">{b}</div></div>')
    h.append("</div>")
    h.append("</div>")
    return "\n".join(h)


def build_seasonality():
    h = ['<div class="pb">']
    h.append(sec("Section 13", "The Indian pet seasonality calendar",
                 "Pet buying in India is intensely seasonal. Fixing the launch date against this calendar is worth more than "
                 "any individual piece of content in the plan."))
    h.append('<table class="t-tight"><thead><tr><th style="width:22mm">Month</th><th>What drives buying</th>'
             "<th>Categories to push</th></tr></thead><tbody>")
    for m, drv, cats in D.SEASONALITY:
        h.append(f"<tr><td><b>{m}</b></td><td>{drv}</td><td>{cats}</td></tr>")
    h.append("</tbody></table>")
    h.append(f'<div class="call warm"><span class="lbl">Highest-leverage decision in this document</span><p>{D.SEASONALITY_NOTE}</p></div>')
    h.append("</div>")
    return "\n".join(h)


def build_research():
    h = ['<div class="pb">']
    h.append(sec("Section 14", "Research brief — five deliverables",
                 "This is the part to hand over directly. Each deliverable has a deadline, a defined output, and the tools to "
                 "produce it. Everything here can be done on free tools."))
    for t, p, tools in D.RESEARCH_BRIEF:
        lis = "".join(f"<li>{x}</li>" for x in tools)
        h.append(f'<div class="rd"><h4>{t}</h4><p class="p">{p}</p>'
                 f'<div class="tools"><span class="lbl">Tools &amp; sources</span><ul>{lis}</ul></div></div>')
    h.append(f'<div class="call"><span class="lbl">In closing</span><p>{D.CLOSING_NOTE}</p></div>')
    h.append('<div class="foot">Pet Affiliate Playbook · India · Dogs &amp; Cats · v1.0, August 2026. '
             "Commission rates, market figures and program terms were verified against published sources in August 2026 and "
             "change frequently — verify in the relevant dashboard before relying on any figure here.</div>")
    h.append("</div>")
    return "\n".join(h)


def main():
    body = "".join([
        build_cover(), build_review(), build_categories(), build_scorecard(), build_deepdive(),
        build_personas(), build_hooks(), build_repurpose(), build_week0(), build_calendar(),
        build_money(), build_compliance(), build_kpis(), build_seasonality(), build_research(),
    ])
    html = ("<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>"
            f"<title>{D.META['title']}</title><style>{CSS}</style></head><body>{body}</body></html>")
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML written: {HTML_PATH}  ({len(html) / 1024:.1f} KB)")

    if not os.path.exists(CHROME):
        print("Chrome not found; HTML only.", file=sys.stderr)
        return
    cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
           "--virtual-time-budget=8000", f"--print-to-pdf={PDF_PATH}", f"file://{HTML_PATH}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(PDF_PATH):
        print(f"PDF written: {PDF_PATH}  ({os.path.getsize(PDF_PATH) / 1024:.1f} KB)")
    else:
        print("PDF failed:", r.stderr[-2000:], file=sys.stderr)


if __name__ == "__main__":
    main()
