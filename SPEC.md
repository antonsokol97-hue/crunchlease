# SPEC — CRE Lease Calculator Hub (MVP, Wave 1)

Product spec for a hub of commercial-real-estate lease calculators targeting US search traffic,
monetized with display ads (AdSense → Mediavine ladder) and, later, direct CRE SaaS sponsorships.

This document is the single source of truth for Claude Code sessions. Build **one tool per session**
(see Appendix B for order, Appendix C for kickoff prompts). A tool is DONE only when its unit tests
reproduce the Worked Example in its spec **to the cent**.

---

## 1. Goals & non-goals

**Goals**
- 8 interactive lease-side calculators (Tier C wedge), each on its own landing page, English, US market.
- Every page is a self-contained SEO landing: calculator above the fold + 600–1,000 words of explanation + FAQ.
- Differentiators over every competitor in the SERP: shareable URL state, scenario comparison, PDF export, embeddable widget.
- Perfect Core Web Vitals (static-first, zero CLS from ads via reserved slots).

**Non-goals (MVP)**
- No accounts, no backend, no database. Everything is client-side.
- No blog/articles. Tool pages + one hub page only.
- No i18n. `en-US` only, USD only, square feet only.

## 2. Tech stack

- **Astro 5** (static output), **React** islands for calculators only (`client:load` on the calculator island, nothing else hydrates).
- **TypeScript everywhere**, strict mode.
- **Tailwind CSS 4** for styling. Design tokens in `src/styles/tokens.css` (placeholder values — see C.3, owner decision).
- **Vitest** for unit tests of the formula engine.
- Deploy: **Cloudflare Pages** (build command `astro build`, output `dist/`).
- No other runtime dependencies unless unavoidable. No chart libs, no PDF libs, no state libs.

## 3. Architecture

```
src/
  calc-core/            # PURE TypeScript formula modules. No React, no DOM, no I/O.
    loadFactor.ts
    nnnLease.ts
    camCharges.ts
    tiAmortization.ts
    netEffectiveRent.ts
    rentEscalation.ts
    percentageRent.ts
    parkingRatio.ts
    money.ts            # rounding helpers (see §3.1)
    __tests__/          # one test file per module; fixtures = Worked Examples from this spec
  components/
    calculators/        # one React island per tool, thin UI over calc-core
    AdSlot.tsx          # reserved-height ad container (see §6)
    ShareBar.tsx        # copy-link, PDF, embed-code actions
    ScenarioCompare.tsx # A/B scenario table (see §4.3)
    Faq.astro           # renders FAQ + FAQPage JSON-LD from frontmatter data
  layouts/
    ToolLayout.astro    # h1, breadcrumb, calculator slot, content slot, related tools, schema
  pages/
    index.astro                          # hub: commercial lease calculators
    <tool-slug>/index.astro              # 8 tool pages (slugs in each tool spec)
    embed/<tool-slug>/index.astro        # chrome-less embed variant (see §4.4)
  content/tools/*.mdx   # per-tool copy: intro, how-it-works, FAQ entries
```

**Rules**
- `calc-core` functions take a typed input object, return a typed result object. Pure, deterministic, no rounding inside the math — rounding happens once at the presentation/result boundary (§3.1).
- React islands do: state ↔ URL sync, validation messages, calling calc-core, rendering results. No formulas in components.

### 3.1 Money & rounding conventions

- Compute in floating point, full precision, round **only at output**.
- Currency: round half-up to 2 decimals via `roundMoney(x)`. Display with `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})`.
- $/SF values: 2 decimals. Percentages: 2 decimals. Ratios (load factor, parking ratio): 2 decimals.
- Derived totals in Worked Examples are computed from the **rounded** payment where noted (matches financial-calculator convention).

## 4. Shared calculator features (every tool)

### 4.1 URL state (shareable scenarios)
- Every input maps to a short query param (documented per tool).
- On input change: debounce 300 ms → `history.replaceState` with current params.
- On load: parse params → hydrate state; any invalid/missing param silently falls back to default.
- "Copy link" button in ShareBar copies the canonical URL with params.

### 4.2 Validation
- Numeric fields clamp to documented ranges on blur; out-of-range typed values show inline error text (exact strings in each tool's Edge cases table) and suppress results until fixed.
- Empty required field → results area shows a neutral "Enter values to calculate" state, never NaN.

### 4.3 Scenario comparison
- "Compare scenarios" toggle duplicates the current inputs into Scenario B side-by-side (stacked on mobile).
- Compare table shows both result sets plus a delta column (absolute + %).
- URL encodes both scenarios (`b_` prefix on Scenario B params).

### 4.4 Embed widget
- Route `/embed/<tool-slug>/`: calculator island only — no header/footer/ads/content.
- Bottom bar inside the widget: "Powered by {SITE_NAME}" — a **dofollow** link to the tool's main page.
- Main page ShareBar has "Embed" → modal with copy-ready snippet:
  `<iframe src="https://{DOMAIN}/embed/<tool-slug>/" width="100%" height="620" style="border:0" loading="lazy" title="..."></iframe>`
- Embed pages: `<meta name="robots" content="noindex">`, and send `postMessage` height updates for responsive iframes.

### 4.5 PDF export
- "Download PDF" = `window.print()` + `@media print` stylesheet. **No PDF library.**
- Print view: site name + tool name, date, inputs summary table, results, scenario compare table if active, footer with canonical URL (with params). Nav, ads, FAQ, embed UI hidden.

## 5. SEO & structured data

- One primary keyword per page (listed per tool); title pattern: `{Primary Keyword, Title Case} — Free {Year-less} Tool | {SITE_NAME}`. H1 = primary keyword in natural phrasing.
- JSON-LD per tool page: `WebApplication` (applicationCategory `FinanceApplication`, `offers: {price: 0, priceCurrency: USD}`), `FAQPage` (from the tool's FAQ entries), `BreadcrumbList`. Sitewide: `WebSite` + `Organization`.
- Canonical = clean URL without query params.
- Cross-linking: every tool page ends with a "Related calculators" block (3–4 links, specified per tool) + link back to the hub. The hub (`/`) links all 8 with one-sentence descriptions.
- `sitemap.xml` (Astro integration) + `robots.txt`. OG image per tool from one template (C.3, owner decision).

## 6. Ad slots (built now, filled later)

- `<AdSlot id="..." />` renders a container with **fixed reserved height** and a subtle "Advertisement" label placeholder → zero CLS when a network is enabled later.
- Placements per tool page:
  - `below-results` — under the results card, 320×100 (mobile) / 728×90 (desktop), reserved height 100/90px.
  - `mid-content` — between "How it works" and FAQ, responsive rect, reserved height 250px.
  - `sidebar` — desktop ≥1280px only, 300×600 sticky, reserved height 600px.
- Config flag `ADS_ENABLED=false` in `src/config.ts`; when false, containers render but stay as placeholders (visible in dev, `visibility:hidden` in prod). Embed pages and print view: **no ad slots**.

## 7. Analytics

- GA4 via `astro-google-analytics` or inline gtag snippet, `defer`. Events: `calculate` (per tool, fired once per param-change batch), `copy_link`, `pdf_export`, `embed_copy`, `scenario_compare_on`.
- Search Console verification meta tag placeholder in `BaseLayout`.

## 8. Content template (every tool page, in this order)

1. H1 + one-sentence value proposition.
2. **Calculator** (island) + ShareBar.
3. AdSlot `below-results`.
4. "What it calculates / definitions" (~150 words).
5. "Formula" — the actual formula, rendered as `<code>` block + plain-English walkthrough of the Worked Example from this spec (~250 words).
6. AdSlot `mid-content`.
7. "How to interpret the result" — benchmarks/typical ranges (~200 words).
8. FAQ — 5 questions (listed per tool), 40–80 words each. **Draft copy by Claude, final edit by Anton (C.3).**
9. Related calculators block.

## 9. Definition of done (per tool)

- [ ] calc-core module + Vitest tests: Worked Example fixture passes **to the cent**; all Edge cases covered.
- [ ] Island: URL state round-trips (load → edit → copy link → open in new tab reproduces state).
- [ ] Scenario compare, PDF print view, embed route + snippet modal all functional.
- [ ] Page content per §8 template; FAQ JSON-LD validates in Rich Results Test.
- [ ] Lighthouse (mobile, prod build): Performance ≥ 95, CLS = 0.
- [ ] Added to hub page + related-links of the tools that reference it.

---

# TOOL SPECS

Conventions: all currency USD; all areas in square feet (SF); RSF = rentable SF, USF = usable SF;
`$/SF/yr` unless stated. Param names in `code` are the URL query keys.

---

## T1. Load Factor Calculator (Rentable vs Usable Square Feet)

- **Slug:** `/load-factor-calculator/` · **Primary keyword:** "load factor calculator" (secondary: "rentable vs usable square feet calculator")
- **Why first:** simplest math; proves the whole architecture (URL state, compare, PDF, embed, schema) end to end.

### Inputs
| Field | Param | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Usable SF | `usf` | number | 4,000 | 100–1,000,000 | tenant's private space |
| Rentable SF | `rsf` | number | 4,600 | 100–1,200,000 | USF + common-area share |
| Quoted rent ($/RSF/yr) | `rent` | number | 28.00 | 0–500 | optional; 0 hides rent outputs |

Mode toggle `mode` = `sf` (default, above) or `lf`: in `lf` mode user enters USF + load factor `lf` (1.00–2.00, default 1.15) and RSF is derived (`rsf = usf × lf`).

### Formulas
```
loadFactor   = rsf / usf
addOnPct     = (rsf - usf) / usf                  // = loadFactor - 1
annualRent   = rsf × rent
monthlyRent  = annualRent / 12
rentPerUsf   = annualRent / usf                   // the "real" price of usable space
```

### Outputs
Load factor (2 dp), add-on % (2 dp), annual rent, monthly rent, effective $/USF/yr.

### Edge cases
| Condition | Behavior |
|---|---|
| `rsf < usf` | Error under RSF field: "Rentable area is normally equal to or larger than usable area. Double-check which number is which." Results suppressed. |
| `usf = 0` or empty | Neutral empty state (no NaN). |
| `rent = 0` | Show load factor + add-on only; hide rent rows. |

### Worked Example (test fixture)
USF 4,000 · RSF 4,600 · rent $28.00/RSF/yr →
**loadFactor = 1.15 · addOnPct = 15.00% · annualRent = $128,800.00 · monthlyRent = $10,733.33 · rentPerUsf = $32.20**

### FAQ (5)
1. What is a load factor in commercial real estate?
2. What's the difference between rentable and usable square feet?
3. What is a typical load factor for office buildings? (answer: commonly ~1.10–1.20; higher in buildings with large lobbies/amenities)
4. How do I compare two spaces with different load factors? (answer: compare $/USF — point at this tool's rentPerUsf output and Scenario Compare)
5. Is load factor the same as loss factor? (answer: related but not identical; loss factor = (RSF−USF)/RSF)

### Related tools
NNN Lease (T2), Net Effective Rent (T5), Rent Escalation (T6).

---

## T2. Triple Net (NNN) Lease Calculator

- **Slug:** `/triple-net-lease-calculator/` · **Primary keyword:** "triple net lease calculator" (secondary: "NNN calculator", "NNN lease cost calculator")
- **Heaviest Tier-C target — the SERP is local brokers and thin tool pages.**

### Inputs
| Field | Param | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Leased area (SF) | `sf` | number | 2,500 | 100–1,000,000 | |
| Base rent ($/SF/yr) | `base` | number | 24.00 | 0–500 | |
| Property taxes ($/SF/yr) | `tax` | number | 3.50 | 0–100 | |
| Insurance ($/SF/yr) | `ins` | number | 1.25 | 0–100 | |
| CAM ($/SF/yr) | `cam` | number | 4.75 | 0–100 | link to T3 for computing this |

Toggle `unit` = `psf` (default) or `annual`: in `annual` mode tax/ins/CAM are entered as building-total dollars with a pro-rata share % field `share` (0–100, default 100) — each converts to $/SF as `total × share% / sf` before the common formulas run.

### Formulas
```
nnnPerSf        = tax + ins + cam
totalPerSf      = base + nnnPerSf
annualBase      = base × sf
annualNnn       = nnnPerSf × sf
annualTotal     = totalPerSf × sf
monthlyTotal    = annualTotal / 12
nnnShareOfTotal = annualNnn / annualTotal
```

### Outputs
NNN expenses $/SF, all-in $/SF, annual base / NNN / total, monthly total, NNN as % of total occupancy cost.

### Edge cases
| Condition | Behavior |
|---|---|
| All of tax/ins/cam = 0 | Info note: "With no pass-through expenses this is effectively a gross lease — the calculator still works, NNN = $0." |
| `sf = 0` in `annual` mode | Error: "Enter the leased area to convert building totals to per-SF costs." |
| `share > 100` | Clamp to 100 with inline note. |

### Worked Example (test fixture)
2,500 SF · base $24.00 · tax $3.50 · ins $1.25 · CAM $4.75 →
**nnnPerSf = $9.50 · totalPerSf = $33.50 · annualBase = $60,000.00 · annualNnn = $23,750.00 · annualTotal = $83,750.00 · monthlyTotal = $6,979.17 · nnnShareOfTotal = 28.36%**

### FAQ (5)
1. What does NNN mean in a lease?
2. What expenses are included in triple net charges?
3. How do I calculate the total cost of a NNN lease? (walk the example)
4. Are NNN expenses negotiable? (caps, exclusions, audit rights — high-level)
5. What's the difference between NNN, gross, and modified gross leases?

### Related tools
CAM Charges (T3), Net Effective Rent (T5), Percentage Rent (T7), Load Factor (T1).

---

## T3. CAM Charges Calculator

- **Slug:** `/cam-charges-calculator/` · **Primary keyword:** "CAM charges calculator" (secondary: "common area maintenance calculator", "CAM reconciliation calculator")

### Inputs
| Field | Param | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Tenant leased SF | `tsf` | number | 3,000 | 100–1,000,000 | |
| Total property leasable SF | `psf` | number | 40,000 | 100–10,000,000 | GLA |
| Annual CAM budget ($) | `budget` | number | 260,000 | 0–100,000,000 | building total |
| Admin/management fee (%) | `fee` | number | 15 | 0–30 | applied on tenant's CAM share |
| Monthly CAM already paid ($) | `paid` | number | 0 | 0–1,000,000 | optional, enables reconciliation output |

### Formulas
```
proRataShare  = tsf / psf
tenantCam     = budget × proRataShare × (1 + fee/100)
camPerSf      = tenantCam / tsf
monthlyCam    = tenantCam / 12
reconciliation = tenantCam - paid × 12        // >0: tenant owes; <0: credit due
```

### Outputs
Pro-rata share %, annual CAM, $/SF, monthly CAM; if `paid > 0`: year-end reconciliation (owed/credit, labeled).

### Edge cases
| Condition | Behavior |
|---|---|
| `tsf > psf` | Error: "Tenant area can't exceed the property's total leasable area." Results suppressed. |
| `psf = 0` | Neutral empty state. |
| `reconciliation` within ±$1 | Show "Fully reconciled — no true-up needed." |

### Worked Example (test fixture)
Tenant 3,000 SF · property 40,000 SF · budget $260,000 · fee 15% · paid $0 →
**proRataShare = 7.50% · tenantCam = $22,425.00 · camPerSf = $7.48 ($7.475 unrounded) · monthlyCam = $1,868.75**
Fixture 2 (reconciliation): same, `paid` = 1,700 → **reconciliation = +$2,025.00 (tenant owes)**.

### FAQ (5)
1. What are CAM charges?
2. How is my pro-rata share calculated?
3. What is a CAM admin fee and what's typical? (commonly 10–15%)
4. What is CAM reconciliation / true-up?
5. Can I cap my CAM increases? (fixed vs. capped vs. uncapped, cumulative vs. compounding — high-level)

### Related tools
NNN Lease (T2), Rent Escalation (T6), Load Factor (T1).

---

## T4. Tenant Improvement (TI) Allowance Amortization Calculator

- **Slug:** `/ti-allowance-amortization-calculator/` · **Primary keyword:** "TI allowance amortization calculator" (secondary: "tenant improvement amortization calculator", "amortized TI calculator")

### Inputs
| Field | Param | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Amount to amortize ($) | `amt` | number | 150,000 | 0–50,000,000 | build-out cost above landlord's allowance |
| Annual interest rate (%) | `rate` | number | 8.0 | 0–25 | |
| Term (months) | `term` | number | 60 | 1–360 | usually = lease term |
| Leased area (SF) | `sf` | number | 5,000 | 0–1,000,000 | optional; 0 hides $/SF outputs |

### Formulas
```
r = rate/100/12
monthlyPayment = r === 0 ? amt/term : amt × r / (1 - (1+r)^-term)
totalRepaid    = roundMoney(monthlyPayment) × term      // from ROUNDED payment
totalInterest  = totalRepaid - amt
annualAddedRent = roundMoney(monthlyPayment) × 12
addedRentPerSf  = annualAddedRent / sf                  // only if sf > 0
```
Amortization schedule (differentiator): per-month row `{month, payment, interest = balance×r, principal = payment−interest, balance}` — collapsible table, included in PDF.

### Outputs
Monthly payment, added annual rent, added rent $/SF/yr, total repaid, total interest, schedule.

### Edge cases
| Condition | Behavior |
|---|---|
| `rate = 0` | Straight-line: payment = amt/term; interest = $0; note "0% means the landlord is simply spreading cost, not financing it." |
| `term = 0` or empty | Neutral empty state. |
| `amt = 0` | Neutral empty state. |

### Worked Example (test fixture)
$150,000 · 8.0% · 60 months · 5,000 SF →
**monthlyPayment = $3,041.46 · annualAddedRent = $36,497.52 · addedRentPerSf = $7.30 ($7.2995 unrounded) · totalRepaid = $182,487.60 · totalInterest = $32,487.60**
Fixture 2 (zero rate): $120,000 · 0% · 48 mo → **monthlyPayment = $2,500.00 · totalInterest = $0.00**

### FAQ (5)
1. What is a tenant improvement allowance?
2. What does it mean to amortize TI into rent?
3. What interest rate do landlords charge on amortized TI? (commonly ~7–10%, negotiable)
4. Is amortized TI the same as a loan? (economically yes; watch what happens on early termination)
5. Should I amortize TI or pay for the build-out upfront? (cost-of-capital comparison — point at Scenario Compare)

### Related tools
Net Effective Rent (T5), NNN Lease (T2), Rent Escalation (T6).

---

## T5. Net Effective Rent Calculator

- **Slug:** `/net-effective-rent-calculator/` · **Primary keyword:** "net effective rent calculator" (secondary: "NER calculator", "effective rent calculator commercial")

### Inputs
| Field | Param | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Face/base rent ($/SF/yr) | `rent` | number | 30.00 | 0–500 | year-1 rate |
| Lease term (months) | `term` | number | 60 | 12–360 | |
| Free rent (months) | `free` | number | 4 | 0–36 | valued at year-1 rate |
| TI allowance ($/SF) | `ti` | number | 25.00 | 0–500 | landlord concession |
| Annual escalation (%) | `esc` | number | 0 | 0–15 | applied each lease year |

Straight-line (undiscounted) NER — the number brokers quote. Note in content: this is not a DCF.

### Formulas
```
years = term / 12                              // fractional years allowed
nominalRentPerSf = Σ over lease years of rent × (1+esc/100)^(yearIndex)   // partial last year pro-rated
freeRentValue    = (free / 12) × rent          // at year-1 rate
netTotalPerSf    = nominalRentPerSf - freeRentValue - ti
nerPerSfPerYear  = netTotalPerSf / years
effectiveDiscount = (rent - nerPerSfPerYear) / rent
```

### Outputs
NER $/SF/yr, total concession value $/SF, nominal vs effective total over term, discount off face %.

### Edge cases
| Condition | Behavior |
|---|---|
| `free ≥ term` | Error: "Free rent can't equal or exceed the lease term." |
| `netTotalPerSf < 0` | Warning: "Concessions exceed total rent — the landlord would be paying the tenant. Check inputs." Results still shown. |
| `term` not multiple of 12 | Pro-rate final partial year at that year's escalated rate. |

### Worked Example (test fixture)
$30.00 · 60 mo · 4 mo free · TI $25.00 · esc 0% →
**nominalRentPerSf = $150.00 · freeRentValue = $10.00 · netTotalPerSf = $115.00 · nerPerSfPerYear = $23.00 · effectiveDiscount = 23.33%**
Fixture 2 (escalations): same but esc 3% → nominal = 30 × (1+1.03+1.03²+1.03³+1.03⁴) = **$159.2741 → netTotal = $124.2741 → NER = $24.85** (24.8548 unrounded).

### FAQ (5)
1. What is net effective rent?
2. What's the difference between face rent and effective rent?
3. How do free rent and TI change what I actually pay?
4. Why do landlords give concessions instead of lowering face rent? (protects building valuation & comps)
5. Does this calculator discount cash flows? (no — straight-line, industry-standard quoting convention)

### Related tools
TI Amortization (T4), Rent Escalation (T6), NNN Lease (T2), Load Factor (T1).

---

## T6. Rent Escalation Calculator

- **Slug:** `/rent-escalation-calculator/` · **Primary keyword:** "rent escalation calculator" (secondary: "annual rent increase calculator commercial", "rent bump calculator")

### Inputs
| Field | Param | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Starting rent ($/SF/yr) | `rent` | number | 25.00 | 0–500 | |
| Escalation type | `etype` | enum | `pct` | `pct` \| `fixed` | % per year, or fixed $ step |
| Escalation rate (%/yr) | `esc` | number | 3.0 | 0–15 | when `etype=pct` |
| Fixed step ($/SF/yr) | `step` | number | 0.75 | 0–50 | when `etype=fixed` |
| Term (years) | `years` | integer | 10 | 1–30 | |
| Leased area (SF) | `sf` | number | 0 | 0–1,000,000 | optional; >0 adds annual $ column |

### Formulas
```
pct:   rentYear(n) = rent × (1+esc/100)^(n-1)            // n = 1..years
fixed: rentYear(n) = rent + step × (n-1)
totalPerSf = Σ rentYear(n)          // pct closed form: rent × ((1+g)^years − 1)/g
avgPerSf   = totalPerSf / years
cumIncrease = (rentYear(years) - rent) / rent
```

### Outputs
Year-by-year schedule table ($/SF and, if sf>0, annual $), total over term, average rent, final-year rent, cumulative increase %. Schedule included in PDF and compare mode.

### Edge cases
| Condition | Behavior |
|---|---|
| `esc = 0` / `step = 0` | Flat schedule, works fine; note "no escalation." |
| `years = 1` | Single row, total = rent. |

### Worked Example (test fixture)
$25.00 · pct 3.0% · 10 years →
**rentYear(10) = $32.62 ($32.6193 unrounded) · totalPerSf = $286.60 ($286.5970) · avgPerSf = $28.66 · cumIncrease = 30.48%**
Fixture 2 (fixed): $25.00 · step $0.75 · 10 years → **rentYear(10) = $31.75 · totalPerSf = $283.75 · avgPerSf = $28.38 (28.375)**

### FAQ (5)
1. What is a rent escalation clause?
2. What is a typical annual escalation in commercial leases? (commonly ~2.5–4% or fixed steps; varies by market/asset)
3. Fixed-percentage vs CPI-linked escalations — what's the difference?
4. How much will my rent grow over a 10-year lease? (walk the example)
5. Do escalations apply to NNN expenses too? (base rent vs pass-throughs — expenses float on actuals)

### Related tools
Net Effective Rent (T5), NNN Lease (T2), CAM Charges (T3).

---

## T7. Percentage Rent Calculator

- **Slug:** `/percentage-rent-calculator/` · **Primary keyword:** "percentage rent calculator" (secondary: "percentage lease calculator", "natural breakpoint calculator")

### Inputs
| Field | Param | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Annual base rent ($) | `base` | number | 120,000 | 0–50,000,000 | |
| Percentage rate (%) | `rate` | number | 6.0 | 0.1–20 | |
| Breakpoint type | `bp` | enum | `natural` | `natural` \| `custom` | |
| Custom breakpoint ($) | `bpv` | number | — | 0–1,000,000,000 | when `bp=custom` |
| Annual gross sales ($) | `sales` | number | 2,600,000 | 0–1,000,000,000 | |

### Formulas
```
naturalBreakpoint = base / (rate/100)
breakpoint     = bp === 'natural' ? naturalBreakpoint : bpv
percentageRent = max(0, (sales - breakpoint) × rate/100)
totalRent      = base + percentageRent
effectiveRate  = totalRent / sales
```

### Outputs
Natural breakpoint (always shown, even in custom mode, for comparison), percentage rent, total rent, effective rate % of sales. Bonus output: "sales needed before percentage rent kicks in."

### Edge cases
| Condition | Behavior |
|---|---|
| `sales ≤ breakpoint` | percentageRent = $0; note "Sales are below the breakpoint — base rent only." |
| `bp=custom` and `bpv < naturalBreakpoint` | Info badge: "This breakpoint is below the natural breakpoint — tenant-unfavorable." (and the reverse note when above) |
| `rate = 0` | Blocked by range (min 0.1). |
| `sales = 0` | effectiveRate hidden. |

### Worked Example (test fixture)
Base $120,000 · rate 6% · natural · sales $2,600,000 →
**naturalBreakpoint = $2,000,000.00 · percentageRent = $36,000.00 · totalRent = $156,000.00 · effectiveRate = 6.00%**
Fixture 2 (below breakpoint): sales $1,500,000 → **percentageRent = $0.00 · totalRent = $120,000.00 · effectiveRate = 8.00%**

### FAQ (5)
1. What is percentage rent?
2. What is a natural breakpoint and how is it calculated?
3. Natural vs artificial breakpoint — who benefits from each?
4. What sales count toward gross sales? (typical exclusions: returns, taxes, employee sales — lease-specific)
5. What's a typical percentage rate in retail leases? (commonly ~4–8%, varies by tenant type)

### Related tools
NNN Lease (T2), CAM Charges (T3), Rent Escalation (T6).

---

## T8. Parking Ratio Calculator

- **Slug:** `/parking-ratio-calculator/` · **Primary keyword:** "parking ratio calculator" (secondary: "parking spaces per 1000 sq ft calculator")

### Inputs
Mode toggle `mode`: `ratio` (default — compute the ratio) or `spaces` (compute required spaces).

| Field | Param | Type | Default | Range | Mode |
|---|---|---|---|---|---|
| Building SF | `sf` | number | 60,000 | 1,000–10,000,000 | both |
| Parking spaces available | `sp` | number | 240 | 0–100,000 | `ratio` |
| Required ratio (per 1,000 SF) | `req` | number | 5.0 | 0–20 | `spaces` |
| Spaces available (optional) | `have` | number | 0 | 0–100,000 | `spaces`; >0 adds surplus/shortfall |

### Formulas
```
ratio:  parkingRatio = sp / (sf / 1000)
spaces: requiredSpaces = ceil(req × sf / 1000)
        surplus        = have - requiredSpaces        // if have > 0
```

### Outputs
`ratio` mode: ratio per 1,000 SF (2 dp) + benchmark badge (see content: office ~4/1000, medical ~5–6, retail ~4–5, industrial ~1–2). `spaces` mode: required spaces (integer, ceil), surplus/shortfall.

### Edge cases
| Condition | Behavior |
|---|---|
| `sf = 0` | Neutral empty state. |
| `sp = 0` in ratio mode | ratio = 0 with note "No parking — common for CBD assets; verify municipal minimums." |

### Worked Example (test fixture)
Ratio mode: 240 spaces · 60,000 SF → **parkingRatio = 4.00 per 1,000 SF**
Spaces mode: req 5.0 · 22,000 SF · have 80 → **requiredSpaces = 110 · shortfall = 30**

### FAQ (5)
1. What is a parking ratio and how is it expressed?
2. What parking ratio does an office/medical/retail building need? (typical benchmarks; zoning governs)
3. Is the ratio based on rentable or gross SF? (varies by ordinance — check the code)
4. What if a building doesn't meet the required ratio? (variances, off-site agreements, valet — high-level)
5. Do parking minimums still apply everywhere? (many US cities have reduced/eliminated them — verify locally)

### Related tools
Load Factor (T1), NNN Lease (T2), CAM Charges (T3).

---

# Appendix A — URL & sitemap

```
/                                      hub: "Commercial Lease Calculators"
/load-factor-calculator/
/triple-net-lease-calculator/
/cam-charges-calculator/
/ti-allowance-amortization-calculator/
/net-effective-rent-calculator/
/rent-escalation-calculator/
/percentage-rent-calculator/
/parking-ratio-calculator/
/embed/<each-slug>/                    noindex
```
Wave 2 (separate spec later): cap-rate, DSCR, NOI, cash-on-cash, GRM, break-even-occupancy hubs + 1031 deadline & boot tools. Architecture must not assume 8 tools anywhere (tool registry = one config array in `src/config.ts`).

# Appendix B — Build order

1. **Session 0 — scaffold:** Astro project, tokens, BaseLayout/ToolLayout, AdSlot, ShareBar, ScenarioCompare shell, URL-state hook, schema helpers, hub page skeleton, Vitest setup. (Prompt C.1)
2. **T1 Load Factor** — simplest; validates the entire pipeline. Do not start T2 until T1 meets §9 fully.
3. **T2 NNN Lease** — heaviest UI (unit toggle).
4. **T3 CAM** → **T4 TI Amortization** (schedule table = the one complex component).
5. **T5 NER** → **T6 Rent Escalation** (share the year-schedule table component from T4/T6).
6. **T7 Percentage Rent** → **T8 Parking Ratio**.
7. Hub page final pass, cross-links, sitemap, OG images, Lighthouse audit.

# Appendix C — Claude Code kickoff prompts

## C.1 Scaffold session

> You are a senior front-end engineer. Read SPEC.md fully. Build **Session 0 (Appendix B, item 1)** only:
> the Astro 5 + React + Tailwind 4 + TypeScript scaffold with all shared components and utilities from
> §2–§8, an empty-but-styled hub page, and Vitest wired up with one passing dummy test in calc-core.
> Do not build any calculator yet. Use placeholder design tokens (grays + one accent) clearly marked
> `/* PLACEHOLDER — replace with final tokens */`. `SITE_NAME` and `DOMAIN` come from `src/config.ts`
> constants with TODO placeholders. When done: `astro build` must pass with zero errors, and list for
> me every TODO you left.

## C.2 Per-tool session (template — replace T«n»)

> Read SPEC.md §3–§9 and the spec for **T«n»** only. Build that tool completely: calc-core module with
> Vitest tests (the Worked Example fixtures must pass to the cent — write the tests FIRST from the
> fixtures), the React island, the page at its slug with the §8 content template (draft the copy and
> FAQ answers per the outline; mark them `<!-- DRAFT: Anton to edit -->`), the embed route, and hub +
> related-links updates. Follow every shared behavior in §4–§6. Definition of done is §9 — walk the
> checklist explicitly at the end and show me the test output.

## C.3 Owner decisions (Anton — before/while building)

1. **Name + domain** — buy before Session 0 (needed for config, embed snippets, schema).
2. **Design tokens** — colors, type scale, radii, spacing in `tokens.css`; replace placeholders after T1 proves the layout.
3. **OG image template** — one Figma frame, export per tool (title + formula visual).
4. **FAQ & content final edit** — every `DRAFT` marker; your domain voice is the moat.
5. *(reminder)* 1 hour in Google Keyword Planner (location = US) to confirm cluster volumes — reorders Wave 2 priorities, does not change this spec.
