# -*- coding: utf-8 -*-
"""Vidya's Kitchen — 8-week launch marketing brief. Grounded in the live app + WhatsApp bot."""

META = {
    "title": "Vidya's Kitchen — 8-Week Launch Marketing Brief",
    "subtitle": "Sivakasi home-style gravies. Ordered today, delivered tomorrow. WhatsApp bot + app.",
    "scope": "Sep–Oct 2026  ·  Sivakasi 15 km  ·  Against-order only  ·  v1.0 from live product",
}

# Kitchen picks = home-screen cold-start row (not fake best-sellers).
KITCHEN_PICKS = [
    ("Mom's Recipe — Chicken Gravy", "349", "699", "20% OFF", "Comfort coconut-masala. First dish to advertise."),
    ("Sister's Recipe — Chicken Gravy", "349", "699", "20% OFF", "Same price band, different family story."),
    ("Sister-in-law's Pepper Chicken", "425", "849", "15% OFF", "Bold pepper. Hero Reel dish."),
    ("Idli Special Chicken Gravy", "425", "849", "15% OFF", "Sell with idli/dosa — breakfast SLOT, not breakfast menu."),
    ("Egg Curry", "149", "299", "25% OFF", "Entry price. 'Try us' offer. Default 500gm add."),
]

CHICKEN = [
    ("Mom's Recipe — Chicken Gravy", "349", "699", "20% OFF", "Comforting home-style masala with coconut undertones."),
    ("Sister's Recipe — Chicken Gravy", "349", "699", "20% OFF", "Spiced home-style gravy with a unique family touch."),
    ("Chicken Wings", "375", "749", "—", "Crisp outside, juicy inside — curry leaves and cracked pepper."),
    ("Black Pepper Chicken Gravy", "399", "799", "—", "Freshly ground pepper, onion-tomato base. Rice or parotta."),
    ("Idli Special Chicken Gravy", "425", "849", "15% OFF", "Packed for soft idlis."),
    ("Sister-in-law's Recipe — Pepper Chicken", "425", "849", "15% OFF", "Bold pepper and caramelised onions."),
    ("Chilly Chicken Gravy", "599", "1199", "—", "Tangy, spicy, bold chilly punch."),
    ("Chilly Chicken (Dry)", "599", "1199", "—", "Wok-tossed capsicum, onion, chilli-garlic glaze."),
]
EGG = [
    ("Egg Curry", "149", "299", "25% OFF", "Boiled eggs in tangy onion-tomato gravy — lunchbox favourite."),
    ("Egg Chalna", "175", "349", "25% OFF", "Spiced dry-ish masala that clings to every bite."),
]
MUTTON = [
    ("Grandma Mutton Keema", "975", "1949", "—", "Minced mutton, traditional spices. Family recipe."),
    ("Mutton Curry", "975", "1949", "—", "Bone-in, slow cooked till the oil splits. Sunday energy."),
    ("Mutton Chukka", "975", "1950", "—", "Dry roast, pepper-forward, caramelised onions."),
    ("Mutton Keema Gravy", "999", "1999", "—", "Fine mince — idli, dosa or rice."),
    ("Spicy Mutton Gravy", "999", "1999", "—", "For the brave. Bold spices, tender mutton."),
    ("Fresh Cream Mutton Curry", "1049", "2099", "—", "Rich, creamy, smooth finish. Guest table."),
    ("Mutton Stew", "1050", "2100", "—", "Light and fragrant. Easy on the stomach."),
]

APP_FLOW = [
    ("1. Splash", "First visit only (~5s). Returning users skip it. Never advertise a loading screen."),
    ("2. Phone OTP", "Name + Indian mobile. Firebase OTP. WhatsApp deep link (?phone=&name=) can skip login."),
    ("3. Pin location", "Must be inside 15 km of Sivakasi kitchen (9.452, 77.798). Out of range = cannot order. Test flag is currently Chennai — flip before ads."),
    ("4. Home", "Greeting + Kitchen picks (5 dishes) or Best Selling once real volume exists. Vidya Bot row. Explore Menu. Favourites tab."),
    ("5. Browse Menu", "Three tabs only: Chicken · Egg · Mutton. Quick-add defaults to 500gm. Photo tap opens dish detail."),
    ("6. Dish detail", "500gm (serves 1–2) or 1kg (serves 3–4). Rating, highly-reordered, reviews, favourite heart. Add to cart."),
    ("7. Cart", "Review items, quantities, strikethrough prices if a dish is on offer."),
    ("8. Schedule", "Pick a day in the next 14 IST days. Slot only if ≥24 hours before window start. Breakfast 7–9 AM / Lunch 12–2 PM / Dinner 7–9 PM. These are delivery windows, not a breakfast menu."),
    ("9. Pay", "Razorpay (UPI / card / net banking). COD is 'Coming soon' — do not advertise cash. Packaging ₹20 + delivery ₹35 + GST 5%."),
    ("10. Track", "Orders tab. WhatsApp help from tracking. Cancel allowed ≥12 hours before the slot."),
]

WA_VS_APP = [
    ("Door", "WhatsApp bot", "App (PWA)"),
    ("Open", "wa.me/917550028179", "vidyaskitchenhome.com"),
    ("Prefill / first line", '"Hi Vidya\'s Kitchen! I\'d like to place an order."', "Splash → OTP → location → home"),
    ("Menu", "List / catalog, image + name + price", "Photos, Kitchen picks, Browse, dish detail"),
    ("Cart", "Max 3 items", "Unlimited"),
    ("Size", "500gm / 1kg", "500gm / 1kg (default add = 500gm)"),
    ("Pay", "Razorpay link in chat", "Razorpay in checkout"),
    ("Best for ads", "Click-to-WhatsApp (primary CTA)", "Open App button (photos + deals)"),
]

NEVER_CLAIM = [
    ("Same-day / 30-minute delivery", "Hard rule: order at least 24 hours before the slot. Copy already says we do not accept rush orders."),
    ("Cash on delivery", "UI shows Coming soon. API rejects COD. Payment is Razorpay only."),
    ("Weekly subscription / tiffin plan", "Removed from product. Against-order only."),
    ("Breakfast dishes / full thali / veg menu", "Menu is chicken, mutton, egg only. Breakfast is a delivery SLOT (7–9 AM) for the same gravies."),
    ("Play Store / App Store download", "This is a website app (PWA). Send people to WhatsApp or vidyaskitchenhome.com."),
    ("Delivery all over Tamil Nadu", "Sivakasi, 15 km of the kitchen. Geo-target ads inside that radius only."),
    ("Fake 'best seller' counts", "Home shows Kitchen picks until 8 real units are sold. Do not invent '2,000 orders this week'."),
    ("Quote 1kg price as if it were 500gm", "App prices are per weight. Default add is 500gm. Always say the weight in the caption."),
]

ASK_MARKETING = [
    ("Admin on the same Facebook Business Manager", "Page, Instagram, WhatsApp and Ads must live in one BM."),
    ("Instagram Professional linked to the Page", "Reels + ads run as one identity."),
    ("Ads Manager + kitchen's payment card", "Never a personal card."),
    ("WhatsApp Business Account on that BM", "Required for Click-to-WhatsApp ads. Order number is +91 75500 28179."),
    ("Google Business Profile ownership", "Maps search: Vidya kitchen Sivakasi."),
    ("Tamil / Tanglish captions + 15s Reel editing", "English-only ads will under-convert."),
    ("Daily 20 min for comments and DMs", "Or route every reply to kitchen WhatsApp +91 93840 20119."),
    ("Friday report: spend, chats, orders, cost per order", "Kill anything over ₹150 per WhatsApp chat."),
]

ASK_KITCHEN = [
    ("Max orders the kitchen can cook per day", "This caps ad spend. Over-selling destroys reviews."),
    ("Exact delivery wards / pincodes inside 15 km", "Geo-target ads to the real radius."),
    ("Flip app geofence from Chennai test → Sivakasi", "Do not run ads while the app is in test zone."),
    ("First-order offer they can afford", "Push Egg Curry 500gm at ₹149 (already 25% OFF), not 40% off mutton."),
    ("20 food photos + 10 cooking/plating clips", "Phone vertical is enough. Shoot the five kitchen picks first."),
    ("Deepavali guest combos (1kg chicken + mutton)", "October is the money month. Confirm surge capacity."),
    ("Who answers +91 75500 28179 vs +91 93840 20119", "Bot number vs support number. Ads create chats; silence kills them."),
    ("Permission to use customer plate photos", "Week 3 onwards we need real UGC."),
]

QUOTA = [
    ("W1", "1–7 Sep", "15", "5", "14", "7", "Who we are + kitchen picks + how to order"),
    ("W2", "8–14 Sep", "15", "5", "14", "7", "App walkthrough + 24h cut-off as a feature"),
    ("W3", "15–21 Sep", "15", "5", "14", "7", "Family chicken recipes + first reviews"),
    ("W4", "22–30 Sep", "15", "5", "14", "7", "Weekend 1kg + first mutton"),
    ("W5", "1–7 Oct", "15", "6", "14", "7", "Guest table combos"),
    ("W6", "8–14 Oct", "15", "6", "14", "7", "Navratri visitors + Idli Special"),
    ("W7", "15–21 Oct", "18", "7", "21", "10", "Pre-Deepavali cut-off"),
    ("W8", "22–31 Oct", "18", "7", "21", "10", "Deepavali week + UGC"),
]

POST_MIX = [
    ("7", "Dish of the day", "One real menu dish, weight, ₹, serve count. Tamil caption. WhatsApp CTA."),
    ("2", "Cut-off reminder", "Order 6 AM–6 PM IST. Last order tonight for tomorrow's lunch/dinner slot."),
    ("2", "Kitchen / family", "Mom / sister / SIL / grandma story. Hands, spices, packing. Not a logo bumper."),
    ("2", "How to order", "WhatsApp bot OR app: pin location → picks → 500gm/1kg → schedule → Razorpay."),
    ("1", "Offer", "Only dishes already on offer in the app (egg 25%, Mom's/Sister's 20%, Idli/SIL 15%)."),
    ("1", "Local / Sunday", "Sivakasi family table, guests, or 1kg 'serves 3–4'."),
]

REEL_MIX = [
    ("1 · Hero kitchen pick", "12–15s", "Hands finishing Mom's or SIL pepper → box → 500gm ₹ on screen."),
    ("2 · Second dish", "12–15s", "Rotate Egg Curry (entry) / Idli Special / Sister's."),
    ("3 · How to order", "15–20s", "WhatsApp tap → Browse Menu → 500gm → 'naalaiki delivery'. End: Open App for photos."),
    ("4 · Portion truth", "10–12s", "500gm next to 1–2 plates; 1kg next to 4 plates. Never skip the weight."),
    ("5 · Cut-off clock", "8–12s", "6 AM–6 PM order window. 24 hours before Breakfast 7–9 / Lunch 12–2 / Dinner 7–9."),
]

# Week 1 day-by-day. Sep 1 2026 = Tuesday.
WEEK1_DAYS = [
    ("Tue 1 Sep", [
        ("POST", "Mom's Recipe Chicken Gravy — 500gm ₹349 (20% OFF). Kitchen pick #1. 'Amma's gravy, boxed.'"),
        ("POST", "Who we are: Sivakasi home kitchen. Chicken, mutton, egg. Order today, eat tomorrow."),
        ("REEL", "Mom's gravy finish + box + ₹349 / 500gm. CTA: WhatsApp 75500 28179."),
        ("STORY ×2", "Close-up + 'Link in bio / WhatsApp'."),
        ("WA status", "Same Mom's still. Prefill: Hi Vidya's Kitchen! I'd like to place an order."),
    ]),
    ("Wed 2 Sep", [
        ("POST", "Sister's Recipe Chicken Gravy — 500gm ₹349 (20% OFF). Kitchen pick #2."),
        ("POST", "How it works: pin your Sivakasi address in the app → pick dish → pick tomorrow's slot."),
        ("STORY ×2", "Sister's plating + cut-off line."),
        ("WA status", "Sister's still."),
    ]),
    ("Thu 3 Sep", [
        ("POST", "Sister-in-law's Pepper Chicken — 500gm ₹425 (15% OFF). Kitchen pick #3."),
        ("POST", "Sizes: 500gm serves 1–2 · 1kg serves 3–4. Default in the app is 500gm."),
        ("REEL", "SIL pepper — caramelised onion, bold pepper. Weight + price on screen."),
        ("STORY ×2", "Pepper close-up + WhatsApp button."),
        ("WA status", "Pepper chicken still."),
    ]),
    ("Fri 4 Sep", [
        ("POST", "Idli Special Chicken Gravy — 500gm ₹425 (15% OFF). Pair with idli/dosa."),
        ("POST", "Delivery slots (not a breakfast menu): 7–9 AM · 12–2 PM · 7–9 PM. Book 24h ahead."),
        ("REEL", "Idli + gravy pour. Caption: breakfast SLOT, same gravy."),
        ("STORY ×2", "Idli still + 'order tonight for tomorrow morning'."),
        ("WA status", "Idli special."),
    ]),
    ("Sat 5 Sep", [
        ("POST", "Egg Curry — 500gm ₹149 (25% OFF). Try-us price. Kitchen pick #5."),
        ("POST", "Explore Menu in the app: 17 dishes, Chicken / Egg / Mutton tabs."),
        ("POST", "Vidya Bot: chat to order. App: photos, deals, track. Two doors, one kitchen."),
        ("REEL", "Egg Curry entry offer. Screen: ₹149 / 500gm. CTA WhatsApp."),
        ("STORY ×2", "Egg + 'first order'."),
        ("WA status", "₹149 Egg Curry 500gm."),
    ]),
    ("Sun 6 Sep", [
        ("POST", "1kg Mom's ₹699 — serves 3–4. Sunday family table."),
        ("POST", "Packing shot: box, seal, rider. Trust."),
        ("REEL", "Portion truth: 500gm vs 1kg next to plates."),
        ("STORY ×2", "Sunday table + order link."),
        ("WA status", "Sunday 1kg."),
    ]),
    ("Mon 7 Sep", [
        ("POST", "Cut-off: order 6 AM–6 PM. Tonight is last call for tomorrow lunch."),
        ("POST", "No COD. Pay UPI/card on Razorpay. Fees: pack ₹20 + delivery ₹35 + GST 5%."),
        ("STORY ×2", "Clock graphic + WhatsApp."),
        ("WA status", "Order before 6 PM for tomorrow."),
    ]),
]

WEEKS_REST = [
    ("W2 · 8–14 Sep", "How to order + cut-off as a feature",
     "Black Pepper Chicken, Wings, Egg Chalna, Chilly Dry (start).",
     "Reel 3 this week is a screen-record of the app: Home → Kitchen picks → Add 500gm → Schedule tomorrow lunch → Razorpay. Do not film a fake Play Store download."),
    ("W3 · 15–21 Sep", "Family chicken recipes + first reviews",
     "Mom's, Sister's, SIL pepper — retell the three family stories. Ask every delivery for a plate photo.",
     "If a customer sends a plate, that is Reel 5. No invented 5-star counts."),
    ("W4 · 22–30 Sep", "Weekend 1kg + first mutton",
     "Mutton Curry, Grandma Keema, Mutton Chukka. 1kg prices ₹1,949–1,950. Guest/Sunday only — do not sell mutton as a weekday lunchbox.",
     "Keep Egg Curry 500gm in the mix so new people have a ₹149 door."),
    ("W5 · 1–7 Oct", "Guest table combos",
     "Fresh Cream Mutton, Spicy Mutton, Chilly Chicken Gravy. Propose a 1kg chicken + 500gm egg combo (kitchen must approve the price).",
     "Sixth Reel: guest table set for 4."),
    ("W6 · 8–14 Oct", "Navratri visitors + Idli Special",
     "Idli Special, Keema Gravy (idli/dosa), Mutton Stew (lighter). Visitors at home = extra gravy, not a restaurant.",
     "QR standees at 5 Sivakasi shops this week."),
    ("W7 · 15–21 Oct", "Pre-Deepavali cut-off",
     "All kitchen picks + 1kg mutton. Every caption has the Deepavali order-by date the kitchen confirms.",
     "7 Reels. Highest ad spend. Cap ads the hour the kitchen is full."),
    ("W8 · 22–31 Oct", "Deepavali week",
     "UGC only plus sold-out honesty. Next-order coupon dated November.",
     "Pause ads when capacity is full. Capture Google Business reviews."),
]

HOOKS = [
    ("Kitchen picks (use first)", [
        "Amma's chicken gravy. Boxed. 500gm ₹349.",
        "Sister's recipe. Same kitchen, different masala.",
        "Maama's pepper chicken — the one guests ask for.",
        "Idli + this gravy. Order tonight, breakfast slot tomorrow.",
        "Egg Curry 500gm ₹149. That's the try-us plate.",
    ]),
    ("Cut-off / 24h (never hide this)", [
        "Innikki order, naalaiki veetukku. We don't do rush.",
        "Kitchen shops fresh. That's why we need 24 hours.",
        "Order window 6 AM–6 PM. Miss it, next slot is day-after.",
        "Breakfast 7–9 is a delivery window. The gravy is the same.",
    ]),
    ("Size honesty", [
        "500gm = 1–2 plates. 1kg = 3–4. Pick in the app.",
        "Don't guess the box. The app shows both prices.",
    ]),
    ("Two doors", [
        "Chat Vidya Bot on WhatsApp. Or open vidyaskitchenhome.com for photos.",
        "Bot for speed. App for the full menu, deals, and track.",
    ]),
    ("Never use", [
        "Hot food in 30 minutes.",
        "Download on Play Store.",
        "Cash on delivery.",
        "Weekly tiffin / subscription.",
        "Best biryani in Sivakasi (we don't sell biryani).",
    ]),
]

KPIS = [
    ("5 Sep", "Accounts live", "Pixel on vidyaskitchenhome.com, IG+Page+WA in one BM, geofence = Sivakasi."),
    ("14 Sep", "First 20 WhatsApp chats", "Cost per chat under ₹40. CTA was Click-to-WA, not Play Store."),
    ("30 Sep", "40 paid orders", "CAC under ₹150. At least 8 repeats. Mix includes Egg Curry 500gm."),
    ("10 Oct", "Festival ready", "1kg guest combo live. Kitchen surge number written down."),
    ("31 Oct", "Deepavali week", "90+ orders in October. 35%+ repeats. Reviews on Google Business."),
]

CHANNELS = [
    ("45%", "Click-to-WhatsApp ads", "Opens +91 75500 28179. Geo: Sivakasi 15 km. Tamil primary text."),
    ("25%", "Instagram Reels / feed", "Boost the week's kitchen-pick Reel, not a random montage."),
    ("15%", "Retarget", "People who opened the app or watched 50% of a Reel but didn't pay."),
    ("10%", "Offline QR", "vidyaskitchenhome.com + wa.me link. Printing presses, shops."),
    ("5%", "Google Business", "No Google Search 'food delivery' bids against Swiggy."),
]
