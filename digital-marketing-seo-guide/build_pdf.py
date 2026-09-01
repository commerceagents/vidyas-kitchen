# -*- coding: utf-8 -*-
"""Renders the Digital Marketing / SEO / Affiliate Traffic book to HTML, then to PDF via headless Chrome."""

import os
import subprocess
import sys

import book_data as D

HERE = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(HERE, "Digital-Marketing-SEO-Affiliate-Traffic-Book.html")
PDF_PATH = os.path.join(HERE, "Digital-Marketing-SEO-Affiliate-Traffic-Book.pdf")
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
.cover h1{ font-size:34pt; line-height:1.08; margin:0 0 6mm; letter-spacing:-.01em; }
.cover .sub{ font-family:"Iowan Old Style",Georgia,serif; font-size:13.5pt; line-height:1.4; color:var(--ink2); margin:0 0 9mm; max-width:145mm; }
.cover .rule{ width:34mm; height:3px; background:var(--accent); margin:0 0 9mm; }
.cover .scope{ font-size:10.5pt; color:var(--muted); letter-spacing:.04em; }
.cover-mid{ margin-top:8mm; }
.cover-box{
  border:1px solid var(--line); border-left:3px solid var(--accent); background:var(--soft);
  padding:6mm 7mm; max-width:155mm;
}
.cover-box h4{ margin:0 0 3mm; font-size:11pt; }
.cover-box ul{ margin:0; padding-left:5mm; columns:2; column-gap:6mm; }
.cover-box li{ margin-bottom:1.6mm; color:var(--ink2); font-size:8.6pt; break-inside:avoid; }
.cover-bot{ border-top:1px solid var(--line); padding-top:5mm; font-size:8.6pt; color:var(--faint); }
.cover-bot .row{ display:flex; justify-content:space-between; }

/* ---------- section headers ---------- */
.sec{ margin:0 0 6mm; }
.sec .num{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.6pt; letter-spacing:.2em;
  text-transform:uppercase; color:var(--accent); font-weight:600;
}
.sec h2{ font-size:21pt; line-height:1.14; margin:1.5mm 0 2.5mm; letter-spacing:-.005em; }
.sec .lede{ font-size:9.6pt; color:var(--ink2); max-width:160mm; line-height:1.55; margin:0; }
h3.blk{ font-size:12.5pt; margin:8mm 0 3mm; page-break-after:avoid; }
h3.blk:first-child{ margin-top:0; }
h4.mini{
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.16em;
  text-transform:uppercase; color:var(--accent); font-weight:600; margin:6mm 0 2.5mm;
  padding-bottom:1.5mm; border-bottom:1px solid var(--line); page-break-after:avoid;
}
h4.mini:first-child{ margin-top:0; }
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
.t-tight td, .t-tight th{ padding:2mm 2.2mm; }

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

/* ---------- step blocks (numbered how-to) ---------- */
.steps{ margin-bottom:5mm; }
.step{ border-top:1px solid var(--line); padding:3.4mm 0; page-break-inside:avoid; }
.step:first-child{ border-top:none; }
.step h4{ font-size:10.6pt; margin:0 0 1.4mm; color:var(--accent-d); }
.step p{ color:var(--ink2); margin:0; font-size:8.9pt; }

/* ---------- day / roadmap cards ---------- */
.day{ border:1px solid var(--line); border-top:3px solid var(--accent); padding:4mm 5mm; margin-bottom:4mm; page-break-inside:avoid; }
.day h3{ font-size:12.5pt; margin:0 0 1mm; }
.day h3 .tag{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.6pt; letter-spacing:.14em; text-transform:uppercase; color:var(--warm); font-weight:600; display:block; margin-bottom:1mm; }
.day .grid .r{ display:flex; gap:3mm; padding:1.6mm 0; border-top:1px solid #edf2f4; font-size:8.7pt; }
.day .grid .r:first-child{ border-top:none; }
.day .grid .k{ flex:0 0 24mm; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.2pt; letter-spacing:.1em; text-transform:uppercase; font-weight:600; color:var(--faint); padding-top:.6mm; }
.day .grid .v{ flex:1; color:var(--ink2); }

/* ---------- checklist ---------- */
.ck{ margin-bottom:4mm; page-break-inside:avoid; }
.ck h4{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:600; margin:0 0 2mm; }
.ck ul{ list-style:none; margin:0; padding:0; }
.ck li{ font-size:8.7pt; color:var(--ink2); padding-left:6mm; position:relative; margin-bottom:1.8mm; }
.ck li:before{ content:"\\2610"; position:absolute; left:0; color:var(--accent); font-size:10pt; }

/* ---------- flow (two-column steps) ---------- */
.flow{ margin-bottom:5mm; }
.flow .fstep{ display:flex; gap:4mm; padding:2.6mm 0; border-top:1px solid var(--line); page-break-inside:avoid; }
.flow .fstep .a{ flex:0 0 42mm; font-weight:600; color:var(--accent-d); font-size:9pt; }
.flow .fstep .b{ flex:1; color:var(--ink2); font-size:8.7pt; }

/* ---------- issue / mistake cards ---------- */
.issue{ border-top:1px solid var(--line); padding:4mm 0 1mm; page-break-inside:avoid; }
.issue h4{ font-size:10.8pt; margin:0 0 2mm; }
.issue h4 .n{ color:var(--warm); font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8.5pt; margin-right:2.5mm; }
.issue .p{ color:var(--ink2); margin:0 0 2.5mm; }
.issue .fix{ background:var(--soft); border-left:2px solid var(--accent); padding:2.5mm 4mm; font-size:8.8pt; }
.issue .fix .lbl{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7pt; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color:var(--accent); }

/* ---------- hooks ---------- */
.hooks{ column-count:2; column-gap:8mm; }
.hgrp{ page-break-inside:avoid; break-inside:avoid; margin-bottom:4mm; }
.hgrp h4{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:7.6pt; letter-spacing:.13em; text-transform:uppercase; color:var(--accent); font-weight:600; margin:0 0 1.5mm; }
.hgrp ul{ margin:0; padding-left:4mm; }
.hgrp li{ font-size:8.5pt; margin-bottom:1.4mm; color:var(--ink2); line-height:1.42; }

.foot{ margin-top:10mm; border-top:1px solid var(--line); padding-top:4mm; font-size:8pt; color:var(--faint); }
"""


def sec(num, title, lede):
    return f'<div class="sec"><div class="num">{num}</div><h2>{title}</h2><p class="lede">{lede}</p></div>'


def steps_block(items):
    h = ['<div class="steps">']
    for title, body in items:
        h.append(f'<div class="step"><h4>{title}</h4><p>{body}</p></div>')
    h.append("</div>")
    return "".join(h)


def flow_block(items):
    h = ['<div class="flow">']
    for a, b in items:
        h.append(f'<div class="fstep"><div class="a">{a}</div><div class="b">{b}</div></div>')
    h.append("</div>")
    return "".join(h)


def checklist(title, items):
    lis = "".join(f"<li>{x}</li>" for x in items)
    return f'<div class="ck"><h4>{title}</h4><ul>{lis}</ul></div>'


def term_table(rows, headers=("Term", "What it means")):
    h = [f'<table class="t-tight"><thead><tr><th style="width:36mm">{headers[0]}</th><th>{headers[1]}</th></tr></thead><tbody>']
    for term, desc in rows:
        h.append(f"<tr><td><b>{term}</b></td><td>{desc}</td></tr>")
    h.append("</tbody></table>")
    return "".join(h)


# ------------------------------------------------------------------ builders

def build_cover():
    m = D.META
    items = "".join(f"<li>{x}</li>" for x in D.WHATS_INSIDE)
    return f"""
<div class="cover">
  <div class="cover-top">
    <div class="eyebrow">Beginner's Book &middot; Written In Plain Language</div>
    <h1>Digital Marketing,<br>SEO &amp; Affiliate<br>Traffic</h1>
    <div class="rule"></div>
    <p class="sub">{m['subtitle']}</p>
    <div class="scope">{m['scope']}</div>
  </div>
  <div class="cover-mid">
    <div class="cover-box">
      <h4>What's inside</h4>
      <ul>{items}</ul>
    </div>
  </div>
  <div class="cover-bot">
    <div class="row"><div>{m['prepared_for']}</div><div>{m['version']}</div></div>
  </div>
</div>
"""


def build_ch1():
    h = ['<div class="pb">']
    h.append(sec("Chapter 01", "The Big Picture, and Your 7-Day Roadmap",
                 "Before any tool or account, understand the shape of the whole thing: you will pick products worth "
                 "promoting, build a home for your content, and then run two engines side by side \u2014 an organic "
                 "engine (SEO, blogging, UGC content) that's slower to start but free and long-lasting, and an optional "
                 "paid engine (Google Ads, Facebook Ads) that's faster to test but costs money per click. Below is the "
                 "order to learn both, spread across seven days."))
    h.append('<div class="call"><span class="lbl">How the money actually flows</span>'
             "<p>You write a blog post or make a video about a pet product \u2192 a reader clicks your specially-tagged "
             "affiliate link \u2192 they buy on Amazon (or another store) \u2192 the store pays you a small percentage "
             "as a commission, at no extra cost to the buyer. Your only job is getting the right person to that link \u2014 "
             "everything in this book is really just different ways of doing that one thing.</p></div>")

    for tag, title, do, done in D.ROADMAP_DAYS:
        h.append(f"""
<div class="day">
  <h3><span class="tag">{tag}</span>{title}</h3>
  <div class="grid">
    <div class="r"><div class="k">Do</div><div class="v">{do}</div></div>
    <div class="r"><div class="k">Done when</div><div class="v">{done}</div></div>
  </div>
</div>""")
    h.append('<div class="call warm"><span class="lbl">After day 7</span>'
             "<p>You don't stop \u2014 you repeat the Chapter 11 weekly routine indefinitely. SEO and content are "
             "compounding: post 10 stays live earning traffic while you write post 11. Ads are optional and only worth "
             "scaling once your organic content has told you which products and hooks actually work.</p></div>")
    h.append("</div>")
    return "".join(h)


def build_ch2():
    h = ['<div class="pb">']
    h.append(sec("Chapter 02", "Finding Pet Products That Actually Sell",
                 "This is the single most important chapter to get right \u2014 every blog post, every video, and every "
                 "ad you ever make will be about a product you choose here. Seven simple checks, no guessing."))
    h.append(steps_block(D.PRODUCT_RESEARCH_STEPS))
    h.append('<div class="call"><span class="lbl">A simple example</span>'
             "<p>Say you're considering a dog dental chew. It's on Amazon's Best Sellers list (check 1 \u2713), has "
             "8,000 reviews at 4.4 stars (check 2 \u2713), costs \u20b9450 with a decent commission (check 3 \u2713), "
             "it's something owners buy monthly, not once (check 4 \u2713), and it looks satisfying on video when a "
             "dog enthusiastically chews it (check 5 \u2713). That's a strong pick \u2014 write about it first.</p></div>")
    h.append('<h4 class="mini">Joining an affiliate program, step by step</h4>')
    h.append(steps_block(D.AFFILIATE_SIGNUP_STEPS))
    h.append("</div>")
    return "".join(h)


def build_ch3():
    h = ['<div class="pb">']
    h.append(sec("Chapter 03", "Building the Home for Your Content",
                 "Your blog/landing page is where every piece of content eventually points back to \u2014 it's what "
                 "turns a viral video or a ranked blog post into an actual sale. Get this basic structure right once, "
                 "and you won't need to touch it again for months."))
    h.append('<h4 class="mini">The six pages every affiliate site needs</h4>')
    h.append(term_table(D.SITE_PAGES_NEEDED, headers=("Page", "Why it exists")))
    h.append('<h4 class="mini">Setting it up, step by step</h4>')
    h.append(steps_block(D.WEBSITE_SETUP_STEPS))
    h.append("</div>")
    return "".join(h)


def build_ch4():
    h = ['<div class="pb">']
    h.append(sec("Chapter 04", "SEO \u2014 Getting Free Traffic From Google",
                 "SEO (Search Engine Optimisation) sounds technical, but it's really just doing three simple things "
                 "well and consistently. This is the chapter that turns your blog into a source of traffic that keeps "
                 "arriving long after you've stopped actively promoting a post."))
    h.append(f'<div class="call"><span class="lbl">How Google actually decides rankings</span><p>{D.SEO_HOW_GOOGLE_RANKS}</p></div>')
    h.append('<h4 class="mini">The three pillars of SEO</h4>')
    h.append(term_table(D.SEO_PILLARS, headers=("Pillar", "In plain words")))
    h.append('<h4 class="mini">Keyword research, step by step (free, no tools required)</h4>')
    h.append(steps_block(D.KEYWORD_RESEARCH_STEPS))
    h.append(checklist("On-page SEO checklist \u2014 run this on every post before you publish", D.ONPAGE_SEO_CHECKLIST))
    h.append('<h4 class="mini">Getting backlinks (off-page SEO) as a brand-new site</h4>')
    h.append(steps_block(D.BACKLINK_STEPS))
    h.append("</div>")
    return "".join(h)


def build_ch5():
    h = ['<div class="pb">']
    h.append(sec("Chapter 05", "Writing a Blog Post That Ranks and Sells",
                 "One repeatable structure, used for every post. It satisfies what Google is looking for and what a "
                 "real reader who's about to spend money wants to see \u2014 in that order, because the second follows "
                 "naturally from the first."))
    h.append('<h4 class="mini">The 8-part post template</h4>')
    h.append(steps_block(D.BLOG_POST_TEMPLATE))
    h.append('<h4 class="mini">Post types that reliably convert into affiliate sales</h4>')
    h.append(term_table(D.POST_TYPES_THAT_CONVERT, headers=("Post type", "Why it works")))
    h.append("</div>")
    return "".join(h)


def build_ch6():
    h = ['<div class="pb">']
    h.append(sec("Chapter 06", "UGC-Style Content \u2014 Video That Doesn't Feel Like an Ad",
                 "You don't need a camera, a studio, or editing skills you don't already have. You need a phone, good "
                 "light, and a planned hook \u2014 everything else here is a repeatable checklist."))
    h.append(f'<div class="call"><span class="lbl">What \u201cUGC\u201d actually means</span><p>{D.UGC_MEANING}</p></div>')
    h.append('<h4 class="mini">Filming and posting, step by step</h4>')
    h.append(steps_block(D.UGC_STEPS))
    h.append('<h4 class="mini">One shoot, many posts \u2014 the repurposing map</h4>')
    h.append(term_table(D.CONTENT_REPURPOSE_MAP, headers=("You film/write once", "It becomes")))
    h.append("</div>")
    return "".join(h)


def build_ch7():
    h = ['<div class="pb">']
    h.append(sec("Chapter 07", "Google Ads, Start to Finish",
                 "Google Ads shows your ad to people already typing a search \u2014 the highest-intent traffic that "
                 "exists, because they're already looking for something like what you have. Treat this chapter as "
                 "optional until your organic content (Chapters 4\u20136) has proven a product and a hook actually work."))
    h.append('<h4 class="mini">Terms you\'ll see, explained simply</h4>')
    h.append(term_table(D.GOOGLE_ADS_TERMS))
    h.append('<h4 class="mini">Match types \u2014 how strict Google is about matching your keyword</h4>')
    h.append('<table class="t-tight"><thead><tr><th style="width:26mm">Match type</th><th style="width:30mm">Written as</th><th>What it does</th></tr></thead><tbody>')
    for name, fmt, desc in D.GOOGLE_MATCH_TYPES:
        h.append(f"<tr><td><b>{name}</b></td><td>{fmt}</td><td>{desc}</td></tr>")
    h.append("</tbody></table>")
    h.append('<h4 class="mini">Creating your first campaign, step by step</h4>')
    h.append(steps_block(D.GOOGLE_ADS_SETUP_STEPS))
    h.append('<h4 class="mini">Managing it afterwards</h4>')
    h.append(steps_block(D.GOOGLE_ADS_MANAGE_STEPS))
    h.append("</div>")
    return "".join(h)


def build_ch8():
    h = ['<div class="pb">']
    h.append(sec("Chapter 08", "Facebook &amp; Instagram Ads, Start to Finish",
                 "Meta Ads (Facebook and Instagram) shows your ad to people who weren't searching for anything \u2014 "
                 "you interrupt their feed. This works best with the same UGC-style video from Chapter 6, because it "
                 "blends into the feed instead of looking like an ad."))
    h.append('<h4 class="mini">Terms you\'ll see, explained simply</h4>')
    h.append(term_table(D.META_ADS_TERMS))
    h.append('<h4 class="mini">Creating your first campaign, step by step</h4>')
    h.append(steps_block(D.META_ADS_SETUP_STEPS))
    h.append('<h4 class="mini">Managing it afterwards</h4>')
    h.append(steps_block(D.META_ADS_MANAGE_STEPS))
    h.append("</div>")
    return "".join(h)


def build_ch9():
    h = ['<div class="pb">']
    h.append(sec("Chapter 09", "Turning Visitors Into Leads",
                 "Most people won't buy on their first visit. Capturing a lead means you get a second, third, and "
                 "fourth chance instead of losing that visitor the moment they close the tab."))
    h.append(f'<div class="call"><span class="lbl">What a \u201clead\u201d means here</span><p>{D.LEAD_GEN_MEANING}</p></div>')
    h.append('<h4 class="mini">Setting up lead capture, step by step</h4>')
    h.append(steps_block(D.LEAD_GEN_STEPS))
    h.append('<h4 class="mini">A simple welcome email sequence you can copy</h4>')
    h.append(term_table(D.EMAIL_SEQUENCE_EXAMPLE, headers=("When", "What to send")))
    h.append("</div>")
    return "".join(h)


def build_ch10():
    h = ['<div class="pb">']
    h.append(sec("Chapter 10", "Hooks &amp; Copywriting \u2014 The Skill Behind Everything",
                 "A \u201chook\u201d is just the first line \u2014 of a blog title, a video, an ad, an email \u2014 "
                 "whose only job is to stop someone from scrolling past. Everything above only works if the hook "
                 "earns the next few seconds of attention."))
    h.append('<h4 class="mini">Seven hook formulas, with ready examples</h4>')
    h.append('<div class="hooks">')
    for grp, items in D.HOOK_FORMULAS:
        lis = "".join(f"<li>{x}</li>" for x in items)
        h.append(f'<div class="hgrp"><h4>{grp}</h4><ul>{lis}</ul></div>')
    h.append("</div>")
    h.append('<h4 class="mini">Three copywriting frameworks for longer copy</h4>')
    h.append(term_table(D.COPY_FRAMEWORKS, headers=("Framework", "How it works")))
    h.append(checklist("Five rules that matter more than any formula", D.HOOK_RULES))
    h.append("</div>")
    return "".join(h)


def build_ch11():
    h = ['<div class="pb">']
    h.append(sec("Chapter 11", "Your Ongoing Weekly Routine, and the Tools You'll Use",
                 "This is what you actually do every week after the 7-day roadmap is done \u2014 the same simple "
                 "cycle, repeated, is what turns a handful of posts into a real, earning site."))
    h.append('<h4 class="mini">The weekly rhythm</h4>')
    h.append(term_table(D.WEEKLY_ROUTINE, headers=("Day", "Focus")))
    h.append('<h4 class="mini">The tools stack \u2014 almost entirely free</h4>')
    for group, items in D.TOOLS_STACK:
        lis = "".join(f"<li>{x}</li>" for x in items)
        h.append(f'<div class="ck"><h4>{group}</h4><ul>{lis}</ul></div>')
    h.append("</div>")
    return "".join(h)


def build_ch12():
    h = ['<div class="pb">']
    h.append(sec("Chapter 12", "Common Mistakes, and a Plain-English Glossary",
                 "Nine mistakes that cost beginners the most time and money, followed by a complete glossary of every "
                 "term used in this book, explained simply, so you never have to guess what a word means."))
    for i, (t, p) in enumerate(D.COMMON_MISTAKES, 1):
        h.append(f'<div class="issue"><h4><span class="n">{i:02d}</span>{t}</h4><p class="p">{p}</p></div>')
    h.append('<h4 class="mini" style="margin-top:8mm">Glossary</h4>')
    h.append(term_table(D.GLOSSARY))
    h.append(f'<div class="call warm"><span class="lbl">In closing</span><p>{D.CLOSING_NOTE}</p></div>')
    h.append('<div class="foot">Digital Marketing, SEO &amp; Affiliate Traffic \u00b7 Beginner\u2019s Book \u00b7 v1.0, August 2026. '
             "Platform screens (Google Ads, Meta Business Suite) change their layout periodically \u2014 the structure "
             "and logic in this book stay the same even when a button moves or is renamed.</div>")
    h.append("</div>")
    return "".join(h)


def main():
    body = "".join([
        build_cover(), build_ch1(), build_ch2(), build_ch3(), build_ch4(), build_ch5(),
        build_ch6(), build_ch7(), build_ch8(), build_ch9(), build_ch10(), build_ch11(), build_ch12(),
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
