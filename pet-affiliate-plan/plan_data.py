# -*- coding: utf-8 -*-
"""Content data for the Pet Affiliate 90-Day Playbook (India | Dogs & Cats)."""

META = {
    "title": "Pet Affiliate Playbook",
    "subtitle": "90-Day Launch Plan, Category Master List &amp; Research Brief",
    "scope": "India &nbsp;·&nbsp; Dogs &amp; Cats Only",
    "prepared_for": "Digital Marketing Freelancer — Research &amp; Execution Brief",
    "version": "v1.0 &nbsp;·&nbsp; August 2026",
}

# ---------------------------------------------------------------- plan review

PLAN_SNAPSHOT = [
    ("Month 1", "Days 1–35 (Wk 1–5)", "3 blogs/wk (Mon·Wed·Fri)", "4 Reels/wk", "2 Shorts/wk (Tue·Thu)", "—",
     "Cast a wide net. Publish 15 posts. Find which categories and hooks stick."),
    ("Month 2", "Days 36–63 (Wk 6–9)", "2 blogs/wk (Mon·Thu)", "5 Reels/wk", "2 Shorts/wk (Tue·Thu)", "1 long video / 2 wks",
     "Double down on Month-1 winners. Move into higher-value categories."),
    ("Month 3", "Days 64–91 (Wk 10–13)", "2 blogs/wk (Mon·Thu)", "5 Reels/wk + Sunday roundup", "2 Shorts/wk (Tue·Thu)", "1 long video / 2 wks",
     "Authority + high-AOV categories. Sunday roundup Reel of top-performing products."),
]

PLAN_ISSUES = [
    {
        "t": "The Month-1 blog maths doesn't reach 15–20 posts",
        "p": "Mon/Wed/Fri for four weeks is 12 posts, not 15–20. Three posts a week only reaches 15 at the end of week five.",
        "fix": "Two changes. (1) Run the Month-1 cadence for five weeks instead of four, which lands exactly on 15 posts by Day 35. "
               "(2) Add a pre-launch week (Week 0) where five cornerstone posts are written and published on Day 1, so the site never "
               "looks empty to a first-time visitor. Together that is 20 posts by Day 35, which is the top of the stated target.",
    },
    {
        "t": "Month-3 'organic search traffic' is 4–6 months early",
        "p": "A 60-day-old domain in the Indian pet niche will get very little Google traffic. Realistic timelines for a new site are "
             "4–8 months to meaningful rankings, longer for commercial keywords like 'best dog food in India'.",
        "fix": "For the 90-day window, treat Pinterest, Instagram search and YouTube search as the traffic engine, and Google as the "
               "6–12 month engine. Keep publishing SEO-structured posts — they compound — but do not set Month-3 KPIs against Google "
               "sessions. Set them against Reel saves, YouTube watch time and affiliate link clicks.",
    },
    {
        "t": "Pinterest is missing, and it is the fastest organic channel in this niche",
        "p": "Pinterest is a search engine, is heavily female-skewed (matching pet-parent purchase decisions), indexes new accounts "
             "in weeks rather than months, and every blog post already produces the assets a Pin needs.",
        "fix": "Add 5 Pins per blog post. Zero extra research, roughly 20 minutes per post. It costs nothing to test and is the single "
               "most likely source of the first ₹1,000 of commission.",
    },
    {
        "t": "No audience capture — every visitor is a one-time visitor",
        "p": "Affiliate income is fragile when 100% of traffic is rented from algorithms. There is no list in the current plan.",
        "fix": "Ship one lead magnet by Week 2 — 'New Puppy / New Kitten Shopping Checklist (PDF, with prices)'. Collect on WhatsApp "
               "(broadcast list or Channel) rather than email; in India, WhatsApp open rates massively outperform email for this audience.",
    },
    {
        "t": "No defined ratio of money pages to supporting pages",
        "p": "Commissions come from commercial-intent posts ('best X', 'X vs Y', 'X under ₹2,000'). Informational posts build topical "
             "authority but rarely convert. With no ratio defined, the calendar drifts toward whichever is easier to write.",
        "fix": "Month 1: 40% money pages / 60% supporting. Month 3: 60% money / 40% supporting. Every money page must name specific "
               "products, show a comparison table, and state a clear 'best for' verdict.",
    },
    {
        "t": "No repurposing rule, so every asset is researched from scratch",
        "p": "Three blogs, four Reels and two Shorts a week is nine original ideas per week if treated as nine separate jobs. That is "
             "the number-one reason solo content plans collapse in week three.",
        "fix": "One rule: every blog post is the parent asset. It becomes 2 Reels, 1 Short, 5 Pins, 1 carousel and 1 WhatsApp broadcast. "
               "Research once per week (three topics), produce nine assets. See the Repurposing Engine page.",
    },
    {
        "t": "No seasonality anchor",
        "p": "Pet buying in India is intensely seasonal — monsoon ticks and skin, summer cooling, Diwali noise anxiety, and the "
             "Great Indian Festival / Big Billion Days sale window which is the highest-earning three weeks of the affiliate year.",
        "fix": "Fix the launch date against the seasonality calendar in this document, and place the seasonal category in Week 9 so it "
               "lands inside its buying season. If the 90 days overlap late September to October, rewrite Weeks 9–12 around the sale events.",
    },
]

# ---------------------------------------------------------------- categories

# (num, name, subs, pet, status)  status: "yours" | "added" | "split"
CATEGORIES = [
    ("Core Consumables — bought again every month", [
        (1, "Dog Food &amp; Nutrition",
         "Dry kibble; wet food &amp; gravy pouches; puppy / adult / senior; breed-size specific; grain-free &amp; limited-ingredient; "
         "veterinary &amp; prescription diets; fresh / home-style subscriptions; toppers &amp; broths",
         "Dog", "added"),
        (2, "Cat Food &amp; Nutrition",
         "Dry kibble; wet pouches &amp; cans; kitten / adult / senior; indoor formula; hairball control; urinary &amp; renal care; "
         "high-protein &amp; grain-free; prescription diets",
         "Cat", "added"),
        (3, "Treats, Chews &amp; Dental Sticks",
         "Training treats; biscuits &amp; cookies; jerky &amp; freeze-dried meat; dental sticks &amp; chews; bully sticks, antlers, hooves; "
         "creamy lickable tubes; catnip &amp; silvervine treats; birthday cakes",
         "Both", "added"),
        (4, "Supplements &amp; Nutraceuticals",
         "Multivitamins; calcium &amp; bone; joint &amp; hip (glucosamine, MSM); skin &amp; coat (omega-3, fish oil); probiotics &amp; gut health; "
         "liver tonics; immunity boosters; hairball &amp; digestive pastes",
         "Both", "split"),
        (5, "Cat Litter (the substrate itself)",
         "Bentonite clumping; tofu / plant-based; silica crystal; paper pellet; wood pellet; scented vs unscented; low-dust variants",
         "Cat", "added"),
        (6, "Flea, Tick &amp; Deworming",
         "Spot-on pipettes; tick collars; anti-tick sprays &amp; shampoos; oral chewables; deworming syrups &amp; tablets; "
         "home &amp; kennel sprays; tick combs; mite &amp; ear-mite treatment",
         "Both", "added"),
    ]),
    ("Health, Hygiene &amp; Care", [
        (7, "Health, First Aid &amp; Recovery",
         "Wound sprays &amp; antiseptics; bandages; thermometer; E-collar / recovery cone; post-surgery suits; pill pockets &amp; pill poppers; "
         "eye &amp; ear cleaners; syringes &amp; feeders; diapers &amp; belly bands; mobility ramps &amp; slings",
         "Both", "yours"),
        (8, "Dental &amp; Oral Care",
         "Finger brushes &amp; toothbrushes; enzymatic toothpaste; water additives; dental gels; dental toys &amp; ropes; breath sprays",
         "Both", "added"),
        (9, "Grooming &amp; Coat Care",
         "Shampoo &amp; conditioner; dry &amp; waterless shampoo; medicated / anti-fungal shampoo; deshedding tools; slicker brushes &amp; rakes; "
         "nail clippers &amp; grinders; clippers &amp; trimmers; grooming gloves; paw balm; wipes; blow dryers; grooming tables &amp; tubs",
         "Both", "yours"),
        (10, "Anxiety, Calming &amp; Behaviour Aids",
         "Pheromone diffusers &amp; sprays; calming collars; anxiety / compression vests; calming chews &amp; supplements; snuffle mats; "
         "heartbeat plush toys; ear defenders; covered anxiety beds",
         "Both", "added"),
    ]),
    ("Feeding Gear", [
        (11, "Bowls, Feeders &amp; Water",
         "Stainless steel &amp; ceramic bowls; anti-skid &amp; anti-ant bowls; elevated / tilted bowls; slow feeders &amp; maze bowls; "
         "water fountains; automatic &amp; gravity feeders; travel bottles; collapsible bowls; placemats &amp; spill mats",
         "Both", "yours"),
        (12, "Food Storage &amp; Accessories",
         "Airtight storage containers; food scoops; can lids &amp; covers; treat jars; portable food pouches; feeding schedule boards",
         "Both", "added"),
    ]),
    ("Toilet, Waste &amp; Home Hygiene", [
        (13, "Litter Boxes &amp; Toilet Setup",
         "Open trays; hooded / covered boxes; top-entry boxes; self-cleaning &amp; smart boxes; litter scoops; litter mats; "
         "disposal bins &amp; liners; litter deodorisers",
         "Cat", "yours"),
        (14, "Potty Training &amp; Waste Management",
         "Pee / training pads; washable pads; pad holders; poop bags &amp; biodegradable bags; bag dispensers; poop scoopers; "
         "indoor grass patches; potty training sprays &amp; attractants; potty bells",
         "Both", "split"),
        (15, "Home Cleaning, Odour &amp; Stain",
         "Enzymatic cleaners; odour eliminators &amp; neutralisers; pet-safe floor cleaners; stain removers; lint rollers; "
         "pet hair removers; pet-hair vacuums; sofa, mattress &amp; car seat protectors; laundry aids",
         "Both", "yours"),
    ]),
    ("Comfort, Furniture &amp; Containment", [
        (16, "Beds, Mats &amp; Comfort",
         "Bolster &amp; donut beds; orthopedic / memory foam; mattresses; cave &amp; hooded beds; blankets &amp; throws; sofa nests; "
         "crate pads; waterproof mats; cooling-gel beds; raised cots",
         "Both", "yours"),
        (17, "Cooling &amp; Warming (Seasonal)",
         "Cooling gel mats; cooling bandanas &amp; vests; elevated mesh cots; ice-lick toys &amp; frozen treat moulds; pet fans; "
         "heating pads; self-warming beds; winter blankets; sweaters (see Apparel)",
         "Both", "yours"),
        (18, "Cat Furniture &amp; Scratchers",
         "Cat trees &amp; condos; scratching posts, pads &amp; ramps; wall shelves &amp; catwalks; window hammocks &amp; perches; "
         "tunnels; hideouts &amp; igloos; cat-proof furniture protectors",
         "Cat", "added"),
        (19, "Crates, Carriers, Playpens &amp; Gates",
         "Wire &amp; folding crates; soft crates; IATA-approved flight carriers; hard-shell carriers; backpack carriers; slings; "
         "trolleys &amp; strollers; playpens; safety gates; balcony &amp; window nets",
         "Both", "yours"),
    ]),
    ("Wear, Walk &amp; Safety", [
        (20, "Collars, Harnesses, Leashes &amp; Ropes",
         "Flat &amp; martingale collars; no-pull front-clip harnesses; step-in &amp; vest harnesses; standard, retractable &amp; bungee leashes; "
         "hands-free &amp; running leashes; long training lines; head halters; car seat-belt tethers; cat harnesses",
         "Both", "yours"),
        (21, "Clothing &amp; Apparel",
         "T-shirts &amp; sweaters; hoodies &amp; jackets; raincoats &amp; monsoon wear; boots &amp; socks; bandanas &amp; bow ties; "
         "festive &amp; Diwali outfits; birthday wear; cooling shirts; post-surgery bodysuits",
         "Both", "yours"),
        (22, "ID, Safety &amp; Visibility",
         "Engraved ID tags; QR-code tags; reflective collars &amp; vests; LED collars &amp; clip lights; basket muzzles; nail caps; "
         "microchip accessories; 'do not pet' patches; lost-pet kits",
         "Both", "yours"),
    ]),
    ("Play, Enrichment &amp; Training", [
        (23, "Toys, Play &amp; Enrichment",
         "Rubber chew toys &amp; stuffables; rope &amp; tug toys; fetch balls &amp; launchers; squeaky &amp; plush toys; teething toys; "
         "puzzle &amp; treat-dispensing toys; lick mats; snuffle mats; wand teasers; laser pointers; crinkle balls; "
         "catnip toys; automatic ball throwers",
         "Both", "yours"),
        (24, "Training &amp; Behaviour Tools",
         "Clickers; treat pouches; target sticks; whistles; long training leads; agility sets; potty bells; "
         "deterrent &amp; anti-chew sprays; training mats &amp; place beds; books, courses &amp; online training",
         "Both", "yours"),
    ]),
    ("Travel, Tech &amp; Adjacent Revenue", [
        (25, "Travel &amp; Outdoor Essentials",
         "Car seats &amp; boosters; hammock seat covers; seat belts; travel water bottles; collapsible bowls; travel litter trays; "
         "portable pee pads; camping &amp; hiking gear; travel first-aid kits; airline documentation folders",
         "Both", "yours"),
        (26, "Smart Pet Tech",
         "GPS trackers &amp; AirTag holders; pet cameras with treat-toss; smart automatic feeders; smart water fountains; "
         "self-cleaning litter boxes; activity &amp; health collars; smart doors &amp; flaps; interactive robot toys",
         "Both", "yours"),
        (27, "Services, Subscriptions &amp; Digital",
         "Pet insurance; vet teleconsultation plans; food subscription boxes; boarding, daycare &amp; grooming bookings; "
         "online training courses; dog-walking apps; pet DNA &amp; allergy tests; pet-friendly travel bookings",
         "Both", "added"),
        (28, "Pet-Parent Lifestyle &amp; Gifting",
         "Pet-parent apparel &amp; merch; mugs &amp; totes; custom pet portraits &amp; photo gifts; birthday party kits; "
         "memorial &amp; keepsake items; pet-themed home décor; adoption gift hampers",
         "Both", "added"),
    ]),
]

META_CATEGORY_NOTE = (
    "One more thing that is not a category but behaves like the highest-converting one: <b>Starter Kits &amp; Checklists.</b> "
    "'New Puppy Checklist', 'New Kitten Checklist', '₹5,000 Starter Setup', 'Monsoon Kit', 'Travel Kit'. These bundle 10–25 products "
    "into a single page, so one visitor can generate ten commissions instead of one, and they catch the buyer at the exact moment "
    "they have decided to spend and have no idea what to buy. Treat this as its own content format and revisit it every month."
)

# ---------------------------------------------------------------- scorecard

# tier, category, repeat, aov, per_sale, seo_comp, reelability
SCORECARD = [
    ("A", "Cat Litter", "Very high — monthly", "₹400 – 1,200", "₹20 – 400", "Low–Med", "Medium"),
    ("A", "Grooming &amp; Coat Care", "High", "₹250 – 2,500", "₹15 – 400", "Medium", "Very high"),
    ("A", "Flea, Tick &amp; Deworming", "High — seasonal spike", "₹300 – 1,200", "₹15 – 400", "Medium", "High"),
    ("A", "Dog Food &amp; Nutrition", "Very high — monthly", "₹800 – 5,000", "₹40 – 400", "Very high", "Medium"),
    ("A", "Cat Food &amp; Nutrition", "Very high — monthly", "₹400 – 3,000", "₹20 – 400", "High", "Medium"),
    ("A", "Toys, Play &amp; Enrichment", "High", "₹200 – 1,500", "₹10 – 400", "Medium", "Very high"),
    ("A", "Treats, Chews &amp; Dental", "Very high", "₹150 – 800", "₹8 – 400", "Medium", "High"),
    ("A", "Bowls, Feeders &amp; Water", "Low — durable", "₹300 – 4,500", "₹15 – 400", "Low–Med", "Very high"),
    ("A", "Home Cleaning &amp; Odour", "High", "₹300 – 3,000", "₹15 – 400", "Low", "Very high"),
    ("A", "Beds, Mats &amp; Comfort", "Low–Med", "₹800 – 6,000", "₹40 – 400", "Medium", "High"),

    ("B", "Cat Furniture &amp; Scratchers", "Low", "₹1,500 – 12,000", "₹70 – 900", "Low", "Very high"),
    ("B", "Collars, Harnesses &amp; Leashes", "Med", "₹400 – 2,500", "₹20 – 400", "Medium", "High"),
    ("B", "Anxiety &amp; Calming Aids", "Med", "₹500 – 3,000", "₹25 – 400", "Low", "High"),
    ("B", "Smart Pet Tech", "Low", "₹2,500 – 40,000", "₹120 – 1,900", "Low", "Very high"),
    ("B", "Supplements &amp; Nutraceuticals", "Very high", "₹300 – 1,500", "₹15 – 400", "Medium", "Low"),
    ("B", "Cooling &amp; Warming (Seasonal)", "Low — annual", "₹500 – 3,000", "₹25 – 400", "Low", "Very high"),
    ("B", "Litter Boxes &amp; Toilet Setup", "Low", "₹800 – 45,000", "₹40 – 2,100", "Low–Med", "High"),
    ("B", "Crates, Carriers &amp; Gates", "Low", "₹1,200 – 8,000", "₹60 – 600", "Low–Med", "Medium"),
    ("B", "Potty Training &amp; Waste", "Very high", "₹200 – 1,000", "₹10 – 400", "Low", "Medium"),
    ("B", "Health, First Aid &amp; Recovery", "Med", "₹200 – 1,500", "₹10 – 400", "Low", "Medium"),
    ("B", "Services &amp; Subscriptions", "Recurring", "Lead / signup", "₹100 – 1,500", "Low", "Low"),

    ("C", "Clothing &amp; Apparel", "Med — seasonal", "₹400 – 2,000", "₹20 – 400", "Medium", "Very high"),
    ("C", "Travel &amp; Outdoor", "Low", "₹500 – 5,000", "₹25 – 400", "Low", "Medium"),
    ("C", "Training &amp; Behaviour Tools", "Low", "₹300 – 2,000", "₹15 – 400", "Low–Med", "High"),
    ("C", "ID, Safety &amp; Visibility", "Low", "₹200 – 1,500", "₹10 – 400", "Low", "Medium"),
    ("C", "Dental &amp; Oral Care", "Med", "₹150 – 900", "₹8 – 400", "Low", "Medium"),
    ("C", "Food Storage &amp; Accessories", "Low", "₹500 – 2,000", "₹25 – 400", "Very low", "Low"),
    ("C", "Lifestyle &amp; Gifting", "Low", "₹400 – 2,500", "₹20 – 400", "Low", "High"),
]

TIER_NOTES = [
    ("Tier A — start here (Weeks 1–8)",
     "Highest combination of search demand, repeat purchase and content volume. These ten categories should carry roughly 70% of "
     "everything published in the first two months. Note that food is in Tier A on demand alone; it is the hardest to rank for and "
     "the most brand-loyal, so treat it as a long-term SEO investment rather than a source of quick commissions."),
    ("Tier B — expand into (Weeks 6–13)",
     "Lower search volume but much lower competition and, in several cases, dramatically higher value per sale. Cat furniture, smart "
     "tech and self-cleaning litter boxes are where a single conversion is worth 20 toy sales. This is where a 90-day-old site can "
     "realistically win."),
    ("Tier C — fill and seasonal",
     "Good for Reels and engagement, weak for search revenue. Use these to keep the social calendar full, to ride festive and "
     "seasonal spikes, and to feed the top of the funnel. Do not build cornerstone blog content here in the first 90 days."),
]

QUICK_WIN_NOTE = (
    "<b>The distinction that matters most:</b> the best-<i>selling</i> categories and the best categories for a brand-new affiliate "
    "site are not the same list. Food, litter and treats sell the most — and are also where every established Indian pet site and "
    "quick-commerce app already competes. The fastest money for a 90-day-old site sits in categories with a visible, filmable "
    "before-and-after and low SEO competition: deshedding tools, slow feeders and lick mats, enzymatic odour cleaners, cat trees and "
    "scratchers, cooling mats, water fountains, GPS trackers and automatic feeders. Publish for both — Tier A for the compounding "
    "search asset, the visual quick-wins for revenue inside 90 days."
)

# ---------------------------------------------------------------- deep dive

DEEP_DIVE = [
    {
        "n": 1, "cat": "Cat Litter &amp; Litter Boxes",
        "why": "The single highest repeat-purchase item in the entire cat category — bought every 3–5 weeks, forever. Cat ownership is "
               "the fastest-growing segment in urban India, and litter is the first problem every new cat parent has.",
        "who": "Women 20–35, metro and Tier-1, first cat within the last 12 months, living in a rented 1–2BHK. Highly reachable on "
               "Instagram, extremely price- and smell-sensitive.",
        "trigger": "The flat smells. Litter is tracking across the floor. The cat has started going outside the box.",
        "kw": "best cat litter india · tofu litter vs bentonite · cat litter smell solution · cheapest cat litter monthly cost · "
              "top entry litter box india · cat litter mat tracking",
        "hooks": ["Your house doesn't smell like cat. It smells like your litter choice.",
                  "I tried every litter sold in India. Here's the cost per month of each.",
                  "The 1-inch rule: why your ₹900 litter stops clumping."],
        "note": "Cheap product, tiny percentage commission — but flat-fee programs pay the same ₹250–400 on a ₹900 litter order as on a "
                "₹9,000 order. This category is where flat-fee affiliate programs beat percentage programs by 10x.",
    },
    {
        "n": 2, "cat": "Grooming &amp; Coat Care",
        "why": "The most filmable category in the niche. Deshedding, matt removal and nail trims produce satisfying before-and-after "
               "footage that carries on Reels and Shorts without any paid promotion. Indian double-coated breeds shed heavily year-round.",
        "who": "Dog parents 25–45 with Golden Retrievers, Labs, Huskies, Indies and Persians. Also budget-conscious parents trying to "
               "stop paying ₹1,200 per salon visit.",
        "trigger": "Hair on every surface. Matted coat after monsoon. A ₹1,500 grooming bill. Visible skin irritation or itching.",
        "kw": "best dog shampoo india · deshedding tool for golden retriever · dog grooming kit india price · "
              "dog smells bad after bath · how to trim dog nails at home · anti fungal shampoo dog monsoon",
        "hooks": ["This came off a Golden in ten minutes.",
                  "Stop paying ₹1,200 a visit. Here's the ₹2,400 kit that replaces it.",
                  "Human shampoo on a dog: what it actually does to their skin."],
        "note": "Best entry category for a new account. Highest ratio of view volume to production effort, and it leads naturally into "
                "shampoo, tools, dryers and flea control — four categories from one shoot.",
    },
    {
        "n": 3, "cat": "Dog Food &amp; Nutrition",
        "why": "The biggest revenue pool in Indian pet care and the largest search volume of any category. Also the most competitive and "
               "the most brand-loyal. Commercial pet food penetration in India is still in single digits, so the category is growing fast.",
        "who": "Two distinct buyers: the anxious first-time puppy parent comparing brands for the first time, and the premium parent "
               "(household income ₹15L+) actively trading up to imported or fresh food.",
        "trigger": "New puppy. Vet said switch. Loose stools. Dull coat. Price shock at the pet store.",
        "kw": "best dog food in india · best puppy food india price · drools vs pedigree vs royal canin · "
              "dog food cost per month india · grain free dog food india · best dog food for indie dogs",
        "hooks": ["₹18 a day versus ₹95 a day. Here's what actually changes.",
                  "'Chicken flavour' is not chicken. Read the label with me.",
                  "What feeding an Indie dog actually costs per month."],
        "note": "Write these posts for the long game — they will not rank in 90 days but they are the highest-value asset on the site by "
                "month eight. Avoid all medical claims; every food post gets a 'consult your vet' block.",
    },
    {
        "n": 4, "cat": "Flea, Tick &amp; Deworming",
        "why": "Acute, urgent, emotional pain point with a hard seasonal peak across the Indian monsoon. Buyers are in panic-purchase mode, "
               "which is the highest-converting mindset in affiliate marketing.",
        "who": "All dog parents, and increasingly cat parents. Strongest with parents of outdoor-walked dogs and community/Indie feeders. "
               "Skews slightly older and more male than the grooming audience.",
        "trigger": "Found a tick. Dog scratching constantly. Ticks visible in the house. Vet mentioned tick fever.",
        "kw": "best tick medicine for dogs india · tick fever dog symptoms · spot on vs tick collar · "
              "how to remove tick from dog · anti tick spray for home india · deworming schedule puppy india",
        "hooks": ["Found one tick? There are hundreds you can't see. Three-step reset.",
                  "The step everyone skips: you have to treat the house, not the dog.",
                  "Where ticks actually hide — check these five places tonight."],
        "note": "This is a health-adjacent topic. Never give dosages, never name a prescription product as a recommendation, always route "
                "to a vet. Amazon pays 0% on prescription pet medication, so stick to over-the-counter products.",
    },
    {
        "n": 5, "cat": "Cat Furniture &amp; Scratchers",
        "why": "High order value (₹1,500–12,000), remarkably low SEO competition in India, and visually spectacular on Reels. A single cat "
               "tree conversion is worth twenty toy conversions.",
        "who": "Urban cat parents in rentals, 22–35. Strong overlap with interior-design and small-space content — which means the "
               "content also reaches an audience outside the pet niche.",
        "trigger": "The cat is destroying the sofa. The cat is bored and vocal at 3am. Moving into a new flat.",
        "kw": "cat tree india price · best scratching post for cats india · cat wall shelves diy · "
              "stop cat scratching sofa · cat furniture for small apartment · sisal vs cardboard scratcher",
        "hooks": ["Your cat isn't ruining the sofa. The scratcher is in the wrong place.",
                  "A full cat setup in a rental, no drilling.",
                  "I gave my cat vertical space. Her behaviour changed in a week."],
        "note": "Best risk-adjusted category in the list for a new site: low competition, high value, high reel-ability. Prioritise "
                "in Weeks 8–10.",
    },
    {
        "n": 6, "cat": "Home Cleaning, Odour &amp; Stain",
        "why": "Almost no dedicated Indian pet content covers this well, yet it is a universal daily problem. Includes ₹8,000–30,000 "
               "pet-hair vacuums, which carry meaningful commission.",
        "who": "Every pet parent, but especially renters worried about deposits and multi-pet households. Also the pet-parent's family "
               "members, which widens the audience.",
        "trigger": "Accident on the carpet. Visitor commented on the smell. Landlord inspection. Hair in the food.",
        "kw": "pet urine smell remover india · enzymatic cleaner for pet urine · best vacuum for pet hair india · "
              "pet safe floor cleaner india · remove dog hair from sofa · cat pee smell on mattress",
        "hooks": ["Blacklight test: this is what your 'clean' floor looks like.",
                  "Regular floor cleaner doesn't remove pet urine. It hides it — and the cat re-marks the spot.",
                  "Three products and my flat stopped smelling like a pet shop."],
        "note": "Extremely low competition, strong search intent, and an easy visual demo. Underrated — treat as a Tier A quick win.",
    },
    {
        "n": 7, "cat": "Smart Pet Tech",
        "why": "Highest value per sale in the entire list. GPS trackers, treat-toss cameras, automatic feeders and self-cleaning litter "
               "boxes run ₹2,500 to ₹45,000. Almost no credible Indian review content exists.",
        "who": "Working professionals 26–40 who leave pets alone 8–10 hours, dual-income households, gadget-inclined, higher disposable "
               "income. Converts on demonstration, not on price.",
        "trigger": "Going back to office. Pet alone all day. Pet escaped once. Travelling for work. Guilt.",
        "kw": "best pet camera india · gps tracker for dogs india · airtag dog collar india · "
              "automatic cat feeder india · self cleaning litter box india price · smart water fountain for cats",
        "hooks": ["I left for eight hours and recorded everything. Here's what he did.",
                  "Does an AirTag actually work to find a lost dog in India? I tested it.",
                  "₹40,000 litter box versus a ₹1,200 tray. Thirty days later."],
        "note": "Requires you to actually own or borrow the device — you cannot fake this content and audiences detect it instantly. "
                "Budget for one hero device per month, or partner with a brand for a loaner.",
    },
    {
        "n": 8, "cat": "Anxiety, Calming &amp; Festive Noise",
        "why": "Sharply seasonal around Diwali and festival fireworks, with almost no competition and a highly emotional, urgent buyer. "
               "Also covers the year-round separation-anxiety audience.",
        "who": "Pet parents in dense urban areas, and specifically the large group of Indian pet parents who dread October. Also parents "
               "of newly adopted rescue dogs.",
        "trigger": "Diwali is in three weeks. Dog hid under the bed all night. Neighbours complaining about barking. New rescue is shut down.",
        "kw": "how to calm dog during diwali · fireworks anxiety dog india · pheromone diffuser for cats india · "
              "calming chews for dogs india · thundershirt india · separation anxiety dog training",
        "hooks": ["Diwali is three weeks away. Build the safe room now, not on the night.",
                  "Does a compression vest actually work? Two-week test.",
                  "Your dog isn't being dramatic. This is what fireworks sound like to them."],
        "note": "Publish four weeks before the festival, not during. Be honest about what does not work — calming products have a high "
                "placebo rate and audiences reward the creator who says so.",
    },
    {
        "n": 9, "cat": "Bowls, Feeders &amp; Water Fountains",
        "why": "Cheap to buy, easy to demonstrate, and the fastest-converting 'small win' in the niche. Slow feeders, lick mats and water "
               "fountains all produce an immediate visible behaviour change on camera.",
        "who": "Broad — anyone with a fast eater, a fussy drinker, or a bored pet. Very low purchase friction at the ₹300–900 price band.",
        "trigger": "Dog vomits after eating. Dog eats in nine seconds. Cat won't drink water. Ants in the food.",
        "kw": "slow feeder bowl india · best water fountain for cats india · elevated dog bowl india · "
              "lick mat for dogs india · automatic pet feeder india · anti ant pet bowl",
        "hooks": ["My dog ate in nine seconds. This ₹399 bowl fixed it.",
                  "Cats drink twice as much from moving water. Seven-day test.",
                  "A lick mat buys you twenty minutes of silence."],
        "note": "Best category for a beginner's first ten Reels: cheap to buy, easy to film, instant result, low return rate.",
    },
    {
        "n": 10, "cat": "Senior Pet Care &amp; Supplements",
        "why": "The 2015–2020 Indian adoption wave is now ageing into its senior years, and virtually nobody is serving this audience. "
               "High order value (orthopedic beds, ramps, joint supplements) and extremely loyal, high-intent readers.",
        "who": "Pet parents 30–50 with a 9+ year old dog or 11+ year old cat. Emotionally invested, willing to spend, and desperate for "
               "credible information.",
        "trigger": "Dog struggling with stairs. Slower on walks. Incontinence. Vet mentioned arthritis. Weight loss.",
        "kw": "joint supplement for dogs india · orthopedic dog bed india · dog ramp for stairs india · "
              "senior dog food india · dog diapers india · signs of arthritis in dogs",
        "hooks": ["Signs of pain that dog parents consistently miss.",
                  "He stopped using the sofa. It wasn't age — it was his hips.",
                  "Which joint supplements have actual evidence behind them, and which don't."],
        "note": "The clearest under-served gap in Indian pet content today. Requires the most careful medical language — no diagnosis, "
                "no dosage, vet disclaimer on every page — but the least competition of any category here.",
    },
]

# ---------------------------------------------------------------- personas

PERSONAS = [
    {"n": "The Panicked New Puppy Parent", "age": "22–32", "loc": "Metro / Tier-1",
     "spend": "₹8,000–20,000 in the first month, then ₹3,000–5,000/mo",
     "desc": "Brought a puppy home in the last 60 days. Buying in a panic, over-buying, and returning things. Googles everything at 1am.",
     "buys": "Starter checklists, puppy food, crate, pee pads, toys, collar, deworming, training treats",
     "reach": "Instagram Reels and Google 'how do I' searches. Highest lifetime value of any persona — win them in week one and they buy from you for a decade.",
     "avoid": "Do not lead with premium products. Lead with 'what you actually need versus what the store will upsell you'."},
    {"n": "The First-Time Kitten Parent", "age": "20–30, women-skewed", "loc": "Metro rentals",
     "spend": "₹4,000–9,000 setup, then ₹1,500–3,000/mo",
     "desc": "Often adopted an Indie or rescue kitten rather than buying. Space-constrained, landlord-conscious, smell-conscious.",
     "buys": "Litter, litter box, scratcher, wet food, wand toys, water fountain, carrier",
     "reach": "Instagram and Pinterest. Highly responsive to aesthetic, small-space and 'rental-friendly' framing.",
     "avoid": "Do not assume a house with a yard. Every recommendation must work in a 1BHK."},
    {"n": "The Premium Trade-Up Parent", "age": "30–45", "loc": "Metro, income ₹15L+",
     "spend": "₹6,000–15,000/mo",
     "desc": "Second or third year of pet parenting. Has moved past 'cheapest' and is actively buying better — imported food, orthopedic beds, smart tech.",
     "buys": "Premium and fresh food, supplements, orthopedic beds, smart tech, grooming tools, insurance",
     "reach": "YouTube long-form and detailed blog comparisons. Reads before buying. Wants specifications, tests and honest downsides.",
     "avoid": "Thin content kills trust with this group instantly. They will check whether you actually own the product."},
    {"n": "The Value-First Parent (Tier 2–3)", "age": "24–40", "loc": "Tier 2 / Tier 3 cities",
     "spend": "₹800–2,500/mo",
     "desc": "The largest and fastest-growing group by volume. Hard budget ceiling, buys on offers, heavy WhatsApp and YouTube user.",
     "buys": "Value dog food, basic collar, shampoo, deworming, cheap toys, home remedies",
     "reach": "YouTube (often in Hindi or regional language) and WhatsApp forwards. Enormously under-served by English metro content.",
     "avoid": "Never recommend a ₹6,000 bed to this group. 'Under ₹500' and 'under ₹1,000' framing converts."},
    {"n": "The Indie &amp; Community Feeder", "age": "25–45", "loc": "All cities",
     "spend": "₹2,000–6,000/mo, spread across many animals",
     "desc": "Feeds or fosters street dogs and cats. Buys in bulk, prioritises cost per kilo, deeply engaged and highly vocal community.",
     "buys": "Bulk food, deworming, tick control, basic first aid, reflective collars, feeding bowls",
     "reach": "Instagram community and Facebook groups. Lower order value but exceptional shares and saves — the best amplification audience you have.",
     "avoid": "Never treat Indies as second-class. Indie-specific content is under-served and earns enormous goodwill."},
    {"n": "The Apartment / No-Yard Parent", "age": "25–40", "loc": "High-density urban",
     "spend": "₹3,000–6,000/mo",
     "desc": "Every problem is a space or a neighbour problem — barking complaints, no place to toilet, no room to burn energy.",
     "buys": "Pee pads, indoor grass, enrichment and puzzle toys, balcony nets, anti-bark training, odour control, gates",
     "reach": "Instagram Reels solving one specific space problem. 'In a 1BHK' is the single highest-performing phrase in this niche.",
     "avoid": "Generic advice written for American backyards. Rewrite everything for 600 square feet."},
    {"n": "The Senior Pet Parent", "age": "30–50", "loc": "Metro / Tier-1",
     "spend": "₹5,000–12,000/mo, rising",
     "desc": "Pet is 9+ years old. Emotionally invested, spending more than ever, and finding almost no Indian content for this stage.",
     "buys": "Joint supplements, orthopedic beds, ramps, senior food, diapers, mobility aids, vet plans",
     "reach": "Google search and long-form YouTube. Low volume, very high intent, almost zero competition.",
     "avoid": "Anything that reads as medical advice. Route to a vet on every page — and say so plainly."},
]

# ---------------------------------------------------------------- hooks

HOOK_BANK = [
    ("Problem-first (highest CTR in this niche)", [
        "Your house doesn't smell like your cat. It smells like your litter.",
        "Your dog isn't naughty. He's under-stimulated, and it takes 15 minutes to fix.",
        "Your cat isn't ruining the sofa. The scratcher is in the wrong place.",
        "Your dog pulls because of the collar, not because of the training.",
        "If your dog vomits after eating, it's the bowl.",
        "If your cat won't drink water, it's not the water. It's that it isn't moving.",
    ]),
    ("Price contrast", [
        "₹18 a day versus ₹95 a day dog food. Here's what actually changes.",
        "₹800 bed versus ₹6,000 orthopedic bed. Thirty days later.",
        "₹250 grooming kit versus ₹2,500. Is it worth it?",
        "₹40,000 litter box versus a ₹1,200 tray. Honest verdict.",
        "Everything my puppy needed, under ₹5,000. Full list.",
        "What one Indie dog actually costs per month. Real numbers.",
    ]),
    ("Mistake / warning", [
        "Nine out of ten new cat parents get the litter depth wrong.",
        "Three things in your first-aid box that are unsafe for pets.",
        "Never use human shampoo on your dog. Here's what it does.",
        "Found one tick? There are hundreds you can't see.",
        "The step everyone skips when treating fleas: the house.",
        "Five things the pet store will upsell you that you do not need.",
    ]),
    ("Before / after and satisfying", [
        "This came off a Golden in ten minutes.",
        "Blacklight test: this is what your 'clean' floor actually looks like.",
        "Crate training, day 1 versus day 5.",
        "Cat harness training, day 1 versus day 10.",
        "Potty training in a flat, day 1 to day 14.",
        "I gave my cat vertical space. Watch what changed.",
    ]),
    ("Test / proof (builds authority fastest)", [
        "I tested six 'indestructible' toys on a Labrador.",
        "I tried every cat litter sold in India. Cost per month for each.",
        "Does an AirTag actually work to find a lost dog in India?",
        "Water fountain versus bowl. Seven-day intake test.",
        "Does a compression vest actually calm an anxious dog? Two weeks.",
        "Three pet gadgets I returned, and why.",
    ]),
    ("Myth-busting", [
        "'Chicken flavour' is not chicken. Let's read the label.",
        "Which joint supplements have actual evidence, and which don't.",
        "Grain-free is not automatically better. Here's when it matters.",
        "Trainers hate retractable leashes. They're right.",
        "Your dog does not need a sweater. Unless it's one of these breeds.",
        "Coconut oil does not treat mange. Here's what does.",
    ]),
    ("List / speed", [
        "Five cat toys under ₹300 that actually get used.",
        "Fourteen things in a pet first-aid kit for an Indian home.",
        "Twenty-seven things to buy before your puppy comes home.",
        "Post-walk paw routine in five minutes.",
        "Airline pet rules in India, in forty seconds.",
        "Bed sizing: measure your dog in fifteen seconds.",
    ]),
    ("POV / emotional", [
        "POV: it's your first night with a puppy and nobody warned you.",
        "This is what fireworks sound like to your dog.",
        "Signs of pain that dog parents consistently miss.",
        "My eleven-year-old dog's daily routine.",
        "He stopped using the sofa. It wasn't age. It was his hips.",
        "Things I'd never buy again for my dog.",
    ]),
]

HOOK_RULES = [
    "The first three seconds decide everything. Name the problem or show the result — never introduce yourself.",
    "One Reel, one product problem. Two products is two Reels.",
    "Say the price out loud on video, but never write a price in a blog post as fact — link to the live listing instead "
    "(and note that Amazon's terms prohibit stating prices outside their approved tools).",
    "Track saves and shares, not likes. Saves are the buying-intent signal, and they are what the algorithm rewards.",
    "Put the affiliate link where the audience already is: bio link-in-bio for Instagram, pinned comment plus description "
    "for YouTube, and inline in blog posts. Never bury it.",
    "Repeat winning hooks with a different product. If a hook format works, it will work five more times.",
]

# ---------------------------------------------------------------- calendar

WEEK0 = {
    "title": "Week 0 — Pre-Launch",
    "sub": "Do this in the seven days before Day 1. It is the difference between launching with a site and launching with an empty shell.",
    "groups": [
        ("Foundation", [
            "Lock the niche positioning in one sentence: who it's for, which pets, which country, what promise.",
            "Domain + hosting live. Fast theme, mobile-first, under 2.5s load on 4G.",
            "Pages published: About, Contact, Privacy Policy, Affiliate Disclosure, Editorial Policy.",
            "Google Analytics 4 + Google Search Console verified. Sitemap submitted.",
            "Affiliate link management plugin or redirect setup so links can be swapped in one place later.",
        ]),
        ("Monetisation", [
            "Amazon.in Associates application submitted (needs a live site with real content — this is why Week 0 exists).",
            "Cuelinks and EarnKaro accounts created — these give access to Flipkart, Supertails, Zigly and HUFT without individual approvals.",
            "Shortlist and save 30 hero product links across the Tier A categories.",
            "Decide the primary merchant per category using the flat-fee versus percentage logic on the monetisation page.",
        ]),
        ("Content bank", [
            "Five cornerstone posts written and scheduled to go live on Day 1: New Puppy Checklist · New Kitten Checklist · "
            "Best Dog Food in India · Best Cat Litter in India · Monthly Cost of Keeping a Dog in India.",
            "Brand kit: two fonts, three colours, one caption template, one thumbnail template, one Reel outro.",
            "Twenty B-roll clips banked (own pets, licensed stock, or brand-supplied) so no day is blocked on footage.",
            "Keyword sheet started — 100 keywords minimum, columns per the research brief at the end of this document.",
        ]),
        ("Channels", [
            "Instagram, YouTube and Pinterest handles claimed with the same name. Bios written with a single link-in-bio.",
            "Instagram bio link tool set up with a category-wise product list page.",
            "WhatsApp Channel or broadcast list created for the lead magnet.",
            "Follow 50 accounts in the niche; save 30 competitor Reels with their hooks logged.",
        ]),
    ],
}

# Each week: (num, days, month_label, theme, goal, rows)
# rows: (day_no, weekday, [(kind, text), ...], category)
WEEKS = [
    (1, "Days 1–7", "Month 1", "Starter kits — puppy &amp; kitten",
     "Three money posts live. Instagram identity established. First 100 followers. Baseline metrics recorded.",
     [
         (1, "Mon", [("BLOG", "New Puppy Checklist India: 27 Things to Buy Before Day 1 (₹4,000 / ₹9,000 / ₹18,000 tiers)"),
                     ("REEL", "Everything I bought for my new puppy under ₹5,000 — fast-cut haul with price overlays")], "Starter kit"),
         (2, "Tue", [("SHORT", "Five puppy things you're wasting money on")], "Starter kit"),
         (3, "Wed", [("BLOG", "Best Puppy Food in India 2026: nine options from ₹18/day to ₹95/day"),
                     ("REEL", "₹18 a day versus ₹95 a day puppy food — what actually changes")], "Dog food"),
         (4, "Thu", [("SHORT", "How much food does a 3-month-old puppy actually need? (chart on screen)")], "Dog food"),
         (5, "Fri", [("BLOG", "New Kitten Checklist: 21 essentials for an Indian 1BHK (₹4,200 setup)"),
                     ("REEL", "Full kitten setup in a 1BHK — no yard, no problem")], "Starter kit"),
         (6, "Sat", [("REEL", "The litter box mistake nine out of ten new cat parents make")], "Litter"),
         (7, "Sun", [("ADMIN", "Record baseline metrics. Save 15 product links. Build next week's shot list. Apply to two more affiliate networks.")], "—"),
     ]),
    (2, "Days 8–14", "Month 1", "Food &amp; feeding gear",
     "Claim the highest-value keyword cluster. Test two distinct hook styles and log which wins. Lead magnet live.",
     [
         (8, "Mon", [("BLOG", "Best Dog Food in India 2026: budget, mid and premium compared (cost-per-kg table)"),
                     ("REEL", "Reading an Indian dog food label in 30 seconds")], "Dog food"),
         (9, "Tue", [("SHORT", "'Chicken flavour' versus 'chicken meal' — why the wording matters")], "Dog food"),
         (10, "Wed", [("BLOG", "Best Cat Food in India: dry vs wet vs mixed feeding, with monthly cost"),
                      ("REEL", "Why your cat isn't drinking water — and why wet food fixes it")], "Cat food"),
         (11, "Thu", [("SHORT", "Three signs the food isn't working for your dog")], "Dog food"),
         (12, "Fri", [("BLOG", "Slow Feeders, Lick Mats &amp; Elevated Bowls: which bowl for which dog"),
                      ("REEL", "My dog ate in nine seconds. This ₹399 bowl fixed it.")], "Bowls &amp; feeders"),
         (13, "Sat", [("REEL", "Water fountain versus bowl — seven-day cat intake test")], "Bowls &amp; feeders"),
         (14, "Sun", [("ADMIN", "Publish lead magnet (Puppy/Kitten Checklist PDF) + WhatsApp capture. First hook-performance read.")], "—"),
     ]),
    (3, "Days 15–21", "Month 1", "Grooming &amp; coat care",
     "Highest reel-ability category. Push for the first 10,000-view Reel. Ten Pins per post from here on.",
     [
         (15, "Mon", [("BLOG", "Best Dog Shampoo in India for every coat type and skin problem"),
                      ("REEL", "Deshedding a Golden Retriever — ten minutes, one tool (satisfying cut)")], "Grooming"),
         (16, "Tue", [("SHORT", "Never use human shampoo on your dog — here's what it does")], "Grooming"),
         (17, "Wed", [("BLOG", "Deshedding Tools Ranked: slicker vs rake vs deshedder for Indian coats"),
                      ("REEL", "The hair pile that came off in ten minutes")], "Grooming"),
         (18, "Thu", [("SHORT", "Nail trimming without the drama — four steps")], "Grooming"),
         (19, "Fri", [("BLOG", "Cat Grooming at Home: brushes, nail caps and dry shampoo cats tolerate"),
                      ("REEL", "Brushing a cat that hates being brushed")], "Grooming"),
         (20, "Sat", [("REEL", "₹250 grooming kit versus ₹2,500 — worth it?")], "Grooming"),
         (21, "Sun", [("ADMIN", "Save ten top competitor grooming Reels. Log every hook and first-three-seconds framing.")], "—"),
     ]),
    (4, "Days 22–28", "Month 1", "Litter, toilet &amp; home hygiene",
     "The highest repeat-purchase cluster in the niche. Test problem-first hooks against price-contrast hooks.",
     [
         (22, "Mon", [("BLOG", "Best Cat Litter in India: bentonite vs tofu vs silica — smell, dust and cost per month"),
                      ("REEL", "Your house doesn't smell like your cat. It smells like your litter.")], "Litter"),
         (23, "Tue", [("SHORT", "The one-inch rule for litter depth")], "Litter"),
         (24, "Wed", [("BLOG", "Litter Boxes for Indian Homes: hooded, top-entry and self-cleaning compared"),
                      ("REEL", "Top-entry litter box — 30 days later")], "Litter box"),
         (25, "Thu", [("SHORT", "Litter tracking across the whole house? Do this.")], "Litter box"),
         (26, "Fri", [("BLOG", "Pee Pads &amp; Indoor Toilet Setup for Apartment Dogs (full potty-training kit)"),
                      ("REEL", "Potty training a puppy in a flat — day 1 to day 14")], "Potty training"),
         (27, "Sat", [("REEL", "Enzyme cleaner versus regular floor cleaner — the blacklight test")], "Home cleaning"),
         (28, "Sun", [("ADMIN", "Mid-month audit: top five posts by affiliate clicks, top five Reels by saves.")], "—"),
     ]),
    (5, "Days 29–35", "Month 1 close", "Toys, play &amp; enrichment",
     "Hit the 15-post target (20 including Week 0). Complete the full Month-1 audit and lock the Month-2 plan.",
     [
         (29, "Mon", [("BLOG", "Indestructible Dog Toys in India: what actually survives a Labrador"),
                      ("REEL", "I tested six 'indestructible' toys on a Lab")], "Toys"),
         (30, "Tue", [("SHORT", "Your dog isn't naughty — he's under-stimulated  ·  ⟵ Day 30, end of Month 1")], "Toys"),
         (31, "Wed", [("BLOG", "Cat Enrichment on a Budget: wands, tunnels and DIY (₹0–₹1,500)"),
                      ("REEL", "Five cat toys under ₹300 that actually get used")], "Toys"),
         (32, "Thu", [("SHORT", "Rotate, don't buy — the toy rotation trick")], "Toys"),
         (33, "Fri", [("BLOG", "Puzzle Toys &amp; Lick Mats: the 15-minute fix for a bored dog"),
                      ("REEL", "A lick mat buys you twenty minutes of silence")], "Enrichment"),
         (34, "Sat", [("REEL", "Toy graveyard: what we'll never buy again")], "Toys"),
         (35, "Sun", [("AUDIT", "MONTH 1 DEEP AUDIT — earnings per post, top hooks, kill list, Month-2 plan locked. See the audit template.")], "—"),
     ]),
    (6, "Days 36–42", "Month 2", "Walk gear — collars, harnesses, leashes, ID &amp; safety",
     "Cadence shifts: 2 blogs, 5 Reels, 2 Shorts. Double down on whichever Month-1 category performed best.",
     [
         (36, "Mon", [("BLOG", "No-Pull Harnesses in India: seven tested on pullers (and two to avoid)"),
                      ("REEL", "Your dog pulls because of the collar, not the training")], "Harness"),
         (37, "Tue", [("SHORT", "Front-clip versus back-clip in twenty seconds"),
                      ("REEL", "Harness fitting: the two-finger rule")], "Harness"),
         (38, "Wed", [("REEL", "Retractable leashes: why trainers hate them")], "Leash"),
         (39, "Thu", [("BLOG", "Dog ID Tags, QR Tags &amp; GPS: what actually gets a lost dog home in India"),
                      ("SHORT", "Engraved tag versus QR tag — which one works?")], "ID &amp; safety"),
         (40, "Fri", [("REEL", "Night walks: reflective versus LED collar test")], "ID &amp; safety"),
         (41, "Sat", [("REEL", "Cat harness training — day 1 versus day 10")], "Harness"),
         (42, "Sun", [("ADMIN", "Repurpose the two best Month-1 Reels with new hooks. Refresh two old posts with better links.")], "—"),
     ]),
    (7, "Days 43–49", "Month 2", "Health basics — flea, tick, deworming, first aid",
     "Highest pain-point cluster. First long-form video. Add the vet-disclaimer block to every health page.",
     [
         (43, "Mon", [("BLOG", "Tick &amp; Flea Control in India: spot-on vs collar vs oral (monsoon guide)"),
                      ("REEL", "Found one tick? There are hundreds you can't see. Three-step reset.")], "Flea &amp; tick"),
         (44, "Tue", [("SHORT", "Where ticks actually hide on your dog — check these five places"),
                      ("REEL", "Tick comb versus tweezers — the correct removal method")], "Flea &amp; tick"),
         (45, "Wed", [("REEL", "The step everyone skips: you have to treat the house, not the dog")], "Flea &amp; tick"),
         (46, "Thu", [("BLOG", "Pet First-Aid Kit for Indian Homes: 14 items, and what to never use"),
                      ("SHORT", "Three things in your first-aid box that are unsafe for pets")], "First aid"),
         (47, "Fri", [("REEL", "Deworming schedule, laid out on a calendar")], "Deworming"),
         (48, "Sat", [("LONG", "LONG VIDEO #1 (8–14 min) — 'Monsoon Pet Care in India: ticks, skin, paws and smell — the full protocol'"),
                      ("REEL", "Teaser cut from the long video")], "Flea &amp; tick"),
         (49, "Sun", [("ADMIN", "YouTube retention review: where do viewers drop off in the long video? Fix that point next time.")], "—"),
     ]),
    (8, "Days 50–56", "Month 2", "Beds, comfort &amp; cat furniture",
     "First high-order-value week. Cat furniture is the best risk-adjusted category in the whole plan — give it real effort.",
     [
         (50, "Mon", [("BLOG", "Best Dog Beds in India: orthopedic, cooling and chew-proof, by size and age"),
                      ("REEL", "₹800 bed versus ₹6,000 orthopedic — thirty-day test")], "Beds"),
         (51, "Tue", [("SHORT", "Why your dog sleeps on the floor instead of the bed you bought"),
                      ("REEL", "Bed sizing: measure your dog in fifteen seconds")], "Beds"),
         (52, "Wed", [("REEL", "A full cat tree setup in a rental — no drilling")], "Cat furniture"),
         (53, "Thu", [("BLOG", "Cat Trees &amp; Scratchers for Indian Apartments: sisal, cardboard and wall shelves"),
                      ("SHORT", "Scratching the sofa? It's a placement problem, not a behaviour problem.")], "Cat furniture"),
         (54, "Fri", [("REEL", "I gave my cat vertical space. Here's what changed in a week.")], "Cat furniture"),
         (55, "Sat", [("REEL", "Washable versus non-washable bed — one monsoon later")], "Beds"),
         (56, "Sun", [("ADMIN", "Day-56 checkpoint. Choose the Week-9 seasonal angle based on the actual launch month.")], "—"),
     ]),
    (9, "Days 57–63", "Month 2 close", "Seasonal essentials — pick your season",
     "Swap in summer, monsoon or winter depending on the calendar. Second long video. Month-2 audit on Sunday.",
     [
         (57, "Mon", [("BLOG", "[SEASONAL] Cooling Mats, Fountains &amp; Paw Protection: surviving the Indian summer  —  swap for monsoon or winter as needed"),
                      ("REEL", "Hot pavement test: seven seconds on the back of your hand")], "Cooling"),
         (58, "Tue", [("SHORT", "Cooling mat versus wet towel — what actually cools a dog"),
                      ("REEL", "Frozen lick mat, three ingredients")], "Cooling"),
         (59, "Wed", [("REEL", "A raincoat that actually stays on")], "Apparel"),
         (60, "Thu", [("BLOG", "Paw Care in India: balms, boots and the five-minute post-walk routine"),
                      ("SHORT", "Post-walk paw routine  ·  ⟵ Day 60, end of Month 2")], "Paw care"),
         (61, "Fri", [("REEL", "Winter sweaters: which breeds actually need one")], "Apparel"),
         (62, "Sat", [("LONG", "LONG VIDEO #2 — 'Everything I'd Buy Again for My Dog in India (full ₹ breakdown, one year in)'"),
                      ("REEL", "Teaser cut from the long video")], "Multi"),
         (63, "Sun", [("AUDIT", "MONTH 2 AUDIT — traffic source mix, earnings per category, decide what to scale in Month 3.")], "—"),
     ]),
    (10, "Days 64–70", "Month 3", "Smart pet tech &amp; high-value products",
     "Highest value per sale in the plan. Sunday roundup Reel starts this week and runs every week from here.",
     [
         (64, "Mon", [("BLOG", "Pet Cameras, GPS Trackers &amp; Automatic Feeders in India: what's actually worth it"),
                      ("REEL", "I left home for eight hours and recorded everything")], "Smart tech"),
         (65, "Tue", [("SHORT", "Does an AirTag actually work to find a lost dog in India?"),
                      ("REEL", "The automatic feeder that fixed my mornings")], "Smart tech"),
         (66, "Wed", [("REEL", "Self-cleaning litter box — thirty days, honest verdict")], "Litter box"),
         (67, "Thu", [("BLOG", "Smart Water Fountains for Cats: do they really increase water intake?"),
                      ("SHORT", "Cats drink twice as much from moving water")], "Bowls &amp; feeders"),
         (68, "Fri", [("REEL", "₹40,000 litter box versus a ₹1,200 tray — is it worth it?")], "Litter box"),
         (69, "Sat", [("REEL", "Three pet gadgets I returned, and why")], "Smart tech"),
         (70, "Sun", [("ROUNDUP", "WEEKLY ROUNDUP REEL #1 — top three most-clicked products of the week, with view and save counts on screen")], "Multi"),
     ]),
    (11, "Days 71–77", "Month 3", "Travel, carriers &amp; crates",
     "High-intent, low-competition search cluster. Airline and travel content ranks well and ages slowly.",
     [
         (71, "Mon", [("BLOG", "Flying With a Pet in India: IATA carriers, airline rules and the full checklist"),
                      ("REEL", "IATA carrier: how to measure your pet correctly")], "Carriers"),
         (72, "Tue", [("SHORT", "Airline pet rules in India, in forty seconds"),
                      ("REEL", "Crate training in five days")], "Crates"),
         (73, "Wed", [("REEL", "Car travel: hammock seat cover versus seat belt tether")], "Travel"),
         (74, "Thu", [("BLOG", "Road Trips With Dogs: car seats, motion sickness and the eight-item kit"),
                      ("SHORT", "Motion sickness: what to do two hours before you leave")], "Travel"),
         (75, "Fri", [("REEL", "The cat carrier your cat walks into voluntarily")], "Carriers"),
         (76, "Sat", [("REEL", "Packing for a pet trip — sixty-second checklist")], "Travel"),
         (77, "Sun", [("ROUNDUP", "WEEKLY ROUNDUP REEL #2 + admin: refresh the three highest-earning posts with updated links")], "Multi"),
     ]),
    (12, "Days 78–84", "Month 3", "Training, behaviour, anxiety &amp; festive noise",
     "Publish the festival anxiety content four weeks before the festival, not during it. Highest emotional engagement of the quarter.",
     [
         (78, "Mon", [("BLOG", "Diwali &amp; Fireworks Anxiety: calming products that help, and the myths that don't"),
                      ("REEL", "Build a safe room in ten minutes")], "Calming"),
         (79, "Tue", [("SHORT", "Does a compression vest actually work?"),
                      ("REEL", "Pheromone diffuser — two-week cat test")], "Calming"),
         (80, "Wed", [("REEL", "Clicker training: 'sit' in ninety seconds")], "Training"),
         (81, "Thu", [("BLOG", "Dog Training Kit for Beginners: clicker, pouch, long line and treats that work"),
                      ("SHORT", "The treat value ladder — why your dog ignores biscuits")], "Training"),
         (82, "Fri", [("REEL", "Separation anxiety: the departure drill")], "Calming"),
         (83, "Sat", [("REEL", "Barking at the door — three-step fix")], "Training"),
         (84, "Sun", [("ROUNDUP", "WEEKLY ROUNDUP REEL #3 + admin")], "Multi"),
     ]),
    (13, "Days 85–91", "Month 3 close", "Senior pets, supplements &amp; the 90-day scale plan",
     "The most under-served audience in Indian pet content. Close the quarter with a full audit and a Q2 plan.",
     [
         (85, "Mon", [("BLOG", "Senior Dog Care in India: joint supplements, ramps, orthopedic beds and diapers"),
                      ("REEL", "My eleven-year-old dog's daily routine")], "Senior care"),
         (86, "Tue", [("SHORT", "Joint supplements: what the label should say"),
                      ("REEL", "Ramp versus lifting — his hips thanked me")], "Senior care"),
         (87, "Wed", [("REEL", "Signs of pain that dog parents consistently miss")], "Senior care"),
         (88, "Thu", [("BLOG", "Pet Supplements in India: which ones have evidence, and which don't"),
                      ("SHORT", "Fish oil: the one question to ask your vet")], "Supplements"),
         (89, "Fri", [("REEL", "Senior cat: the litter box changes that help")], "Senior care"),
         (90, "Sat", [("REEL", "Ninety days of this channel — what I'd do differently  ·  ⟵ Day 90")], "Meta"),
         (91, "Sun", [("AUDIT", "WEEKLY ROUNDUP REEL #4 + 90-DAY AUDIT and the Quarter-2 plan.")], "Multi"),
     ]),
]

# ---------------------------------------------------------------- repurposing

REPURPOSE = [
    ("1 blog post", "The parent asset. Research once. 1,500–2,500 words, comparison table, clear 'best for' verdicts, "
                     "affiliate links on every product mention plus one in the first 200 words."),
    ("→ 2 Instagram Reels", "Reel A: the single strongest hook from the post, 15–25s. Reel B: the comparison or the "
                            "before/after, 20–35s. Both end on 'full list in bio'."),
    ("→ 1 YouTube Short", "The most instructive 30–45 seconds. Different hook wording from the Reels so the two platforms "
                          "don't feel like reposts. Affiliate link in the description and pinned comment."),
    ("→ 5 Pinterest Pins", "One vertical image per product plus one for the comparison table. Keyword-rich titles and "
                           "descriptions, all pointing at the blog post. Twenty minutes total, and the highest-ROI "
                           "twenty minutes in this plan."),
    ("→ 1 Instagram carousel", "Slide 1 the hook, slides 2–6 one product each with price band and 'best for', slide 7 the CTA. "
                               "Carousels get saved far more than Reels, and saves are the buying signal."),
    ("→ 1 WhatsApp broadcast", "Two lines and one link. Send only when there is a genuine offer or a genuinely useful list — "
                               "this channel dies fast if abused."),
    ("→ 1 Story set", "Three to five frames with a poll or question sticker, plus the link sticker. Feeds the algorithm and "
                      "generates the research questions for next week's content."),
]

# ---------------------------------------------------------------- affiliate

PROGRAMS = [
    ("Amazon.in Associates", "4.7% on Pet Products (Aug 2026 fee schedule)", "24 hours",
     "Widest catalogue and the highest buyer trust in India. But 4.7% of a ₹900 litter order is ₹42. "
     "Note: prescription pet medication earns 0%, and Amazon's terms restrict quoting prices outside their approved tools."),
    ("Flipkart", "Up to ~12%, category-dependent", "30 min direct / up to 24h via networks",
     "Direct sign-ups are frequently paused. Join through Cuelinks, EarnKaro or Admitad instead — you also get a much "
     "longer tracking window, which matters for higher-value orders."),
    ("Supertails", "~₹250–400 flat per qualifying new-customer order", "~30 days",
     "Flat fee, which makes it dramatically better than percentage programs on low-value repeat items like litter, "
     "treats and food. Access via EarnKaro or Cuelinks."),
    ("Heads Up For Tails", "~5–6% flat", "~30 days",
     "Strong brand recognition and higher average order value, especially on beds, accessories and apparel. "
     "Good fit for the premium-parent persona."),
    ("Zigly", "Advertised up to ~32% on selected products", "~30 days",
     "The headline rate is product- and cohort-dependent — verify in the dashboard before you build content around it. "
     "Worth testing because the upside is large if it holds."),
    ("Cuelinks / EarnKaro / Admitad / vCommission", "Varies by merchant", "Varies",
     "Aggregators. One login gives access to dozens of Indian pet merchants without applying to each. "
     "Start here on Day 1 — approval is fast and it removes the Amazon-approval bottleneck."),
    ("Brand direct — Wiggles, Drools, Captain Zack, Farmina", "Negotiable, often 8–15%", "Varies",
     "Worth approaching directly once you have 90 days of traffic data. Direct deals also unlock free product for reviews, "
     "which is what unlocks the Smart Tech and high-AOV categories."),
    ("Services — pet insurance, vet teleconsult, DNA tests", "₹100–1,500 per lead or signup", "Varies",
     "Highest payout per conversion in the whole list, and almost nobody in Indian pet content is promoting them. "
     "Pays on a lead, not a purchase, so the conversion bar is much lower."),
]

MONETISATION_MATH = (
    "<b>The one calculation that should shape every product link you place.</b> A ₹1,200 cat litter order pays roughly "
    "₹56 on Amazon at 4.7%. The same order through a flat-fee program like Supertails can pay ₹250–400 for a new customer — "
    "five to seven times more. So: route <b>low-value, high-repeat</b> items (litter, treats, food, poop bags) to flat-fee "
    "programs, and route <b>high-value or long-tail</b> items (₹15,000 self-cleaning litter box, obscure brands, anything "
    "where Prime delivery closes the sale) to Amazon. Put both links on the page — 'Buy on Amazon' and 'Buy on Supertails' — "
    "and let the reader choose. You get paid either way, and conversion goes up because you removed a decision."
)

# ---------------------------------------------------------------- compliance

COMPLIANCE = [
    ("Disclosure is not optional, and it goes first",
     "India's ASCI influencer guidelines require disclosure that is upfront and unmissable — in the first two lines of a caption, "
     "as an on-screen label held for at least three seconds in video, and clearly worded (#ad, #affiliate, 'paid link'). "
     "Burying it at the end of a caption or in a hashtag block does not comply."),
    ("Amazon has its own specific wording",
     "Amazon Associates requires the statement 'As an Amazon Associate I earn from qualifying purchases' on any page or channel "
     "carrying their links. Their terms also prohibit using affiliate links in email, PDFs and (in practice) closed messaging, "
     "and restrict quoting prices outside their approved tools. Read the Operating Agreement once, properly — accounts get "
     "closed for these, and closure is usually permanent."),
    ("Health content is the biggest risk in this niche",
     "Anything touching illness, dosage, medication or diagnosis is high-stakes both legally and for search rankings. "
     "Rules to hold to: never diagnose, never state a dosage, never recommend a prescription medication, always name the vet "
     "as the decision-maker, and put a visible disclaimer block on every health page. This also protects the site from "
     "Google's quality assessments of health content."),
    ("Don't claim a test you didn't run",
     "'I tested six toys' is the highest-converting content format in this plan — and the fastest way to lose an audience if "
     "it isn't true. If the product wasn't used, frame it as 'what to look for' or 'what reviewers report' instead. Audiences "
     "in this niche are unusually good at detecting fake reviews."),
    ("Use images you have the right to use",
     "Brand product photos, other creators' clips and stock without a licence are all liability. Shoot your own, use "
     "properly licensed stock, or use the brand's official affiliate creative assets."),
    ("Keep prices out of evergreen copy",
     "Prices move constantly in Indian e-commerce. Use price <i>bands</i> ('₹800–1,200') in blog posts and let the live link "
     "carry the exact figure. Speaking a price out loud on video is fine; hard-coding it in an evergreen post creates a "
     "credibility problem within weeks."),
]

# ---------------------------------------------------------------- kpis

KPIS = [
    ("Month 1", "15 blogs (20 with Week 0) · 20 Reels · 10 Shorts",
     "0–50/day, almost all social", "500–2,000", "0–300", "₹0 – 2,000",
     "Reels published on schedule · saves per Reel · which two categories produced the most saves"),
    ("Month 2", "8 blogs · 22 Reels · 8 Shorts · 2 long videos",
     "50–250/day, social + first Pinterest", "2,000–6,000", "300–1,200", "₹1,500 – 10,000",
     "Affiliate link CTR · earnings per post · YouTube average view duration · Search Console impression curve starting to lift"),
    ("Month 3", "8 blogs · 26 Reels · 8 Shorts · 2 long videos · 4 roundups",
     "150–600/day, Pinterest becoming material", "5,000–15,000", "1,000–4,000", "₹6,000 – 30,000",
     "Revenue per 1,000 sessions · top three categories by revenue · WhatsApp list size · repeat-visitor share"),
]

KPI_CAVEAT = (
    "<b>Read these as ranges, not promises.</b> They assume no paid promotion and no existing audience. The variance in this "
    "niche is extreme — one Reel that reaches a million views can beat the entire rest of the quarter, and it is normal for "
    "months one and two to look like nothing is working while the assets quietly accumulate. The number to watch is not "
    "revenue in Month 1. It is whether the publishing schedule was actually met, and whether saves per Reel are trending up."
)

LEADING_INDICATORS = [
    ("Saves + shares per Reel", "The buying-intent signal, and what the algorithm actually rewards. Likes are noise."),
    ("Affiliate link click-through rate", "Per post. Under 2% means the links are badly placed or the products don't match intent."),
    ("Earnings per post (EPC)", "Total commission divided by clicks, per post. This is what tells you which categories to scale."),
    ("YouTube average view duration", "Under 30% on Shorts means the hook failed. Fix the first three seconds, not the topic."),
    ("Search Console impressions", "Will move long before clicks do. Rising impressions in month two is the signal that the SEO "
                                   "investment is working, even at zero traffic."),
    ("Pinterest outbound clicks", "The earliest real traffic source for a new site in this niche. Check weekly."),
]

# ---------------------------------------------------------------- seasonality

SEASONALITY = [
    ("Jan", "Winter wear (North India), New Year adoption spike, 'new pet' checklist searches peak",
     "Apparel · Beds · Starter kits"),
    ("Feb", "Shedding begins as weather warms. Feb 20 — Love Your Pet Day",
     "Grooming · Deshedding tools"),
    ("Mar", "Summer prep, shedding peaks, heat begins in the South and West",
     "Cooling · Grooming · Water fountains"),
    ("Apr–May", "Peak summer. Paw burns, dehydration, heat stress. Tick season opens. Apr 11 — National Pet Day",
     "Cooling mats · Fountains · Paw balm · Flea &amp; tick"),
    ("Jun–Aug", "MONSOON — the biggest pet-problem season in India. Ticks and fleas peak, fungal skin infections, wet-dog odour, "
                "muddy paws, indoor boredom. Aug 8 International Cat Day, Aug 26 International Dog Day",
     "Flea &amp; tick · Anti-fungal shampoo · Raincoats · Paw care · Odour control · Indoor enrichment"),
    ("Sep", "Post-monsoon skin and ear problems. Ganesh Chaturthi noise. Sale-season content prep starts",
     "Grooming · Ear care · Calming"),
    ("Oct–Nov", "THE REVENUE WINDOW. Amazon Great Indian Festival and Flipkart Big Billion Days — the highest-earning three weeks "
                "of the affiliate year. Diwali fireworks anxiety. Festive outfits. Gifting",
     "Everything · Calming &amp; anxiety · Apparel · Smart tech · High-AOV"),
    ("Dec", "Winter wear, heating pads, Christmas gifting, year-end 'best of' and 'what I'd buy again' content",
     "Apparel · Warming · Gifting · Lifestyle"),
]

SEASONALITY_NOTE = (
    "<b>If the 90-day window overlaps late September to early November, rewrite the plan around it.</b> The Great Indian Festival "
    "and Big Billion Days sale period will out-earn everything else combined. Build deal-comparison and 'best offers' content three "
    "weeks in advance, have every product link pre-placed, and publish daily during the sale."
)

# ---------------------------------------------------------------- research brief

RESEARCH_BRIEF = [
    ("Deliverable 1 — Keyword sheet (by Day 7)",
     "Three hundred India-targeted keywords in one spreadsheet. Columns: keyword · monthly volume (India) · difficulty · "
     "intent (informational / commercial / transactional) · category from the master list · target URL · current top-3 results · "
     "best affiliate program for that keyword · notes. Sort by commercial intent and low difficulty — that sorted list is the "
     "blog calendar for months four to six.",
     ["Google Keyword Planner (free with any Ads account)", "Google Search Console once the site has data",
      "Ahrefs free keyword generator · Ubersuggest free tier", "AnswerThePublic for question-shaped keywords",
      "Google Trends set to India, with state-level breakdown",
      "Amazon.in and Flipkart search autocomplete — the purest commercial-intent source there is",
      "Instagram, YouTube and Pinterest search suggestions"]),
    ("Deliverable 2 — Competitor teardown (by Day 10)",
     "Ten competitors: five Indian pet blogs and five Indian pet Instagram or YouTube channels. For each, log their top ten "
     "pages or posts, which categories they cover well, which they ignore entirely, which affiliate programs they use, and their "
     "posting frequency. The gaps are the opportunity — and based on the category analysis in this document, expect the gaps to "
     "be senior pet care, home odour control, smart tech and cat furniture.",
     ["Ubersuggest or Ahrefs free site overview for top pages", "Instagram: sort profile by 'most viewed' Reels",
      "YouTube: sort channel by 'most popular'", "Save 30 competitor Reels with hook, first three seconds, and CTA logged"]),
    ("Deliverable 3 — Category validation scores (by Day 14)",
     "Score all 28 categories from the master list, one to five, on four axes: search demand in India · rupees earned per sale · "
     "reel-ability (can the benefit be shown in eight seconds?) · competition. Multiply demand × rupees-per-sale × reel-ability, "
     "divide by competition. That ranking, not intuition, decides what gets published in months four to six.",
     ["Use the scorecard in this document as the starting hypothesis, then verify with real keyword data",
      "Check actual commission per sale in each affiliate dashboard rather than trusting published rates",
      "Reddit — r/IndianPets, r/india, r/CatAdvice, r/Dogtraining — for real problem language in the audience's own words",
      "Quora India and Indian pet Facebook groups for the same reason"]),
    ("Deliverable 4 — Hero SKU price tracker (ongoing, weekly)",
     "Twenty hero products across the Tier A categories, price-checked weekly across Amazon, Flipkart, Supertails and Zigly. "
     "Affiliate content lives or dies on price accuracy — a post recommending a product that is now out of stock or 40% more "
     "expensive loses the reader permanently.",
     ["A simple Google Sheet with a weekly manual check is enough at this scale",
      "Flag any product that goes out of stock and swap the link the same day",
      "Note which merchant is cheapest per product — that is the link that should be first on the page"]),
    ("Deliverable 5 — Weekly one-page report (every Sunday)",
     "One page, same format every week: what was published · top three assets by saves and by clicks · bottom three · affiliate "
     "clicks and earnings · one thing to change next week. If a report takes more than twenty minutes to produce, it is too "
     "detailed to be useful.",
     ["Google Analytics 4 for sessions and link clicks", "Affiliate dashboards for clicks, orders and earnings",
      "Instagram and YouTube native analytics for saves, shares and retention",
      "Keep every week's report in one document so trends are visible at a glance"]),
]

CLOSING_NOTE = (
    "The plan the freelancer built is fundamentally sound — the cadence is realistic for one person, the ramp from broad to "
    "focused is right, and the shift from blog-heavy to video-heavy matches where attention actually is in India. The changes in "
    "this document are additions, not corrections: five weeks of Month-1 cadence instead of four so the post target is actually "
    "reachable, Pinterest added because it is the only organic channel that can produce results inside 90 days, a repurposing "
    "rule so nine assets a week comes from three research sessions, twelve product categories added to the list (led by food, "
    "which was the notable omission and is the largest revenue pool in the market), and realistic expectations for what search "
    "traffic will and will not do in the first quarter."
)
