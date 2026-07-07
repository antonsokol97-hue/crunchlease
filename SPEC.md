# CRE Calculators — MVP Build Spec (v1.1)

Spec for the first 8 tools of a commercial real estate calculator hub.
Audience of this document: Claude Code (implementation) + Anton (design & content review).
Language of product: English (US market). All UI copy in this spec is final draft unless marked TBD.

**Changelog**

- **v1.1 (2026-07-07):** §T2 cap model simplified to a single annual cap. Under a single constant `growth` rate, cumulative and non-cumulative caps are mathematically identical (the uncapped series is monotonic, so it never dips below the ceiling and rises again — the only case where the two bases diverge), so a two-way selector would be a control that does nothing. The cumulative-vs-non-cumulative distinction moves to **§T6 Rent Escalation**, whose per-year/custom schedules produce the variable increases that make the two bases genuinely diverge.

---

## 0. How to use this spec with Claude Code

1. Drop this file into the repo root as `SPEC.md`.
2. Use the kickoff prompt in **Appendix C** to scaffold the project.
3. Implement one tool per session/prompt (see build order in Appendix B). Reference sections by number, e.g. "Implement Tool 3 per SPEC.md §T3, using shared components from §5."
4. Every tool's **Worked example** doubles as a unit-test fixture. The formula engine is not done until its test matches the expected numbers exactly.

---

## 1. Product scope (MVP)

Eight standalone calculator pages + home page + 2 category hub pages:

| # | Tool | Route | Tier |
|---|------|-------|------|
| T1 | Triple Net (NNN) Lease Calculator | `/nnn-lease-calculator/` | Lease (wedge) |
| T2 | CAM Charges Calculator | `/cam-calculator/` | Lease (wedge) |
| T3 | TI Allowance & Amortization Calculator | `/tenant-improvement-calculator/` | Lease (wedge) |
| T4 | Net Effective Rent Calculator | `/net-effective-rent-calculator/` | Lease (wedge) |
| T5 | Load Factor Calculator | `/load-factor-calculator/` | Lease (wedge) |
| T6 | Rent Escalation Calculator | `/rent-escalation-calculator/` | Lease (wedge) |
| T7 | Cap Rate Calculator | `/cap-rate-calculator/` | Investment (hub) |
| T8 | DSCR Calculator | `/dscr-calculator/` | Investment (hub) |

Category hubs: `/lease-calculators/` and `/investment-calculators/` — static index pages listing tools with one-paragraph descriptions. Home page `/` — directory of all tools grouped by category, one screen, no marketing fluff.

Out of scope for MVP: user accounts, backend, saved deals server-side, 1031 tools (wave 2).

---

## 2. Tech stack & constraints

- **Astro 5** (static output) + **React islands** for calculator components only. Everything else ships zero JS.
- **TypeScript** everywhere. **Tailwind CSS** with design tokens as CSS variables (Anton supplies tokens; components must be themeable via `var(--*)`, no hardcoded colors in components).
- **`src/calc-core`** — pure TypeScript formula functions, no DOM, no React. One module per tool (`nnn.ts`, `cam.ts`, …). **Vitest** unit tests; fixtures = Worked examples from this spec.
- No backend, no database. Deploy target: **Cloudflare Pages** (static).
- No cookies except analytics consent handling. `localStorage` allowed only for unit-preference persistence (§6).
- Dependencies: keep minimal. Charts: **Recharts** (lazy-loaded island) or plain SVG if simpler. PDF export: **print stylesheet + `window.print()`** (no PDF libs in MVP).

---

## 3. URL & site architecture

- Tools live at root level with `-calculator` suffix (see §1). Trailing slash, lowercase, hyphenated.
- Canonical URL on every page. `sitemap.xml` + `robots.txt` generated at build.
- Breadcrumb: Home → Category → Tool (with `BreadcrumbList` schema).
- **Internal linking rules (mandatory):**
  - Every tool page links to 3–5 related tools inside the explainer prose (contextual, not just a widget).
  - Every tool page ends with a "Related calculators" card grid (3 cards).
  - Hub logic: T7 and T8 are linked from every lease tool at least once; lease tools cross-link within the tier.
- **State in URL:** every input serializes to query params (debounced 300 ms, `history.replaceState`). Loading a URL with params restores state. Param keys are the `key` column in each tool's input table. Invalid params → fall back to defaults silently.
- **Embed mode:** `?embed=1` renders calculator island only (no header/footer/content) + a fixed footer line: `Calculator by {SITE_NAME}` linking to the canonical page (`rel="dofollow"`). Each tool page has an "Embed this calculator" button that opens a modal with a copy-ready iframe snippet (width 100%, height per tool, `loading="lazy"`).

---

## 4. Page template (every tool page)

Order is fixed:

1. **Breadcrumb**
2. **H1** (one per page, contains primary keyword) + one-sentence value prop (≤120 chars)
3. **Calculator island** — above the fold on 375 px viewport; inputs left / results right on ≥1024 px, stacked on mobile; results update live on input (no "Calculate" button)
4. **Results action row:** Copy link · Download PDF · Embed · Reset
5. `<AdSlot id="below-results">` (§9)
6. **"How it works"** — the formula in plain English + the actual formula rendered in a `<code>` block
7. **Worked example** — same numbers as the default state
8. **Benchmarks / typical ranges** table (from Appendix A; content marked `last_reviewed` in frontmatter)
9. `<AdSlot id="mid-content">`
10. **FAQ** — 4–5 questions, accordion, `FAQPage` schema
11. **Related calculators** — 3 cards
12. Footer + disclaimer line: "Educational estimates only — not financial, tax, or legal advice."

Explainer content (items 6–10): 600–900 words total per page. Claude Code generates first draft **as separate `.mdx` content files** so Anton can edit without touching components. Tone: practitioner-direct, no filler, US CRE terminology.

---

## 5. Shared components & calc engine

**Components (`/src/components/` — shared root; calculator islands under `calculators/`):**
- `<CalcShell>` — layout, results panel, action row, URL-state sync, analytics wiring.
- `<NumberInput>` — label, unit suffix, thousands separators while typing, min/max clamp with inline error, tooltip icon (`?`) with 1–2 sentence definition. Accepts `1,500,000`, `1500000`, `1.5m` is NOT supported (keep parsing strict).
- `<UnitToggle>` — segmented control (e.g. $/SF/yr ↔ $/SF/mo).
- `<ModeTabs>` — for tools with modes (T2, T3, T5, T7).
- `<ResultCard>` — primary metric large, secondary metrics grid, semantic color state (ok / warn / fail) driven by tool logic.
- `<YearTable>` — schedule tables with sticky header, CSV download button.
- `<SensitivityGrid>` — T7 matrix, base cell highlighted.
- `<ScenarioCompare>` — "Add scenario B" duplicates current inputs into a second column; both columns editable; delta row at bottom. MVP: max 2 scenarios. Available on T1, T4, T5, T8.
- `<EmbedModal>`, `<AdSlot>`.

**calc-core rules:**
- Pure functions: `(inputs: TInput) => TOutput`. No rounding inside math; round only at display (§6).
- Every function exports its own `TInput`/`TOutput` types and a `DEFAULTS` const (the values in each tool's input table).
- Guard clauses return typed error states (`{ ok: false, error: 'LEASED_SF_EXCEEDS_BUILDING' }`), never `NaN`/`Infinity` to the UI.

---

## 6. Conventions

- **Currency:** USD, `Intl.NumberFormat('en-US')`. Dollars: 0 decimals in results (`$98,100`), 2 decimals for $/SF (`$32.70`). Rates/ratios: 2 decimals (`7.50%`, `1.45x`).
- **Units:** default rent basis is **$/SF/yr**. Global toggle to $/SF/mo (SoCal convention) persisted in `localStorage` key `rentUnit`; conversion is ×12 / ÷12; both values always shown in results ("$32.70 /SF/yr · $2.73 /SF/mo").
- **Time:** years are 1-indexed in schedules; escalations apply on each 12-month anniversary unless a tool says otherwise.
- **SF** = square feet, RSF = rentable, USF = usable, GLA = gross leasable area.
- Percent inputs are whole numbers in UI (`3` = 3%), converted to decimals in calc-core.

---

## 7. Validation & error UX

- Inline validation on blur + on URL-param load. Errors never block typing.
- Results panel has three states: **valid** (numbers), **incomplete** (grey placeholders "—"), **invalid** (single sentence explaining which rule failed).
- Cross-field rules are listed per tool under **Edge cases**. Each rule has an error string in the spec — use verbatim.

## 8. SEO & schema

- `<title>` 50–60 chars (given per tool), meta description 150–160 chars (given per tool), OG image 1200×630 generated per tool from a template (tool name + primary metric visual).
- Schema per tool page: `WebApplication` (name, description, `applicationCategory: FinanceApplication`, `offers: price 0`) + `FAQPage` + `BreadcrumbList`. JSON-LD in `<head>`.
- One `<h1>`; H2s per template §4; keyword variants (given per tool) appear naturally in H2s/prose, no stuffing.

## 9. Performance & ads readiness

- Targets: LCP < 1.0 s, CLS < 0.05, JS ≤ 80 KB gz per page (island + charts lazy).
- `<AdSlot>` renders a fixed-height reserved container from day one (mobile 320×100, desktop 728×90; `min-height` set) so enabling AdSense/Ezoic later causes **zero CLS**. Slots ship empty in MVP behind an `ADS_ENABLED` env flag.
- Fonts: max 2 families, `font-display: swap`, self-hosted.

## 10. Analytics

GA4 via lightweight loader after consent. Events: `calc_input_change` (tool, debounced 1/session per field), `calc_result_valid` (tool), `pdf_export`, `csv_export`, `embed_copied`, `share_link_copied`, `scenario_added`, `related_click` (from, to). Consent banner: minimal, decline = no GA.

---
# Tool specs

## T1 — Triple Net (NNN) Lease Calculator

**Route:** `/nnn-lease-calculator/`
**Primary keyword:** triple net lease calculator · **Variants:** nnn calculator, nnn lease calculator, commercial triple net calculator
**Meta title:** `NNN Lease Calculator — Triple Net Rent Cost Per SF & Month`
**Meta description:** `Calculate true triple net lease costs: base rent plus taxes, insurance and CAM per SF, monthly and annual totals, with escalations over the full lease term.`
**User & intent:** tenant, broker, or landlord pricing a space; wants total occupancy cost, not just face rent.

### Inputs

| Field | key | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Input mode | `mode` | tabs | `psf` | `psf` \| `totals` | Per-SF rates vs building totals + pro-rata |
| Leased area (SF) | `sf` | number | 3,000 | 100–2,000,000 | |
| Base rent | `base` | number | 24.00 | 0–500 | Unit per global toggle (§6), stored as $/SF/yr |
| Property taxes | `tax` | number | 3.50 | 0–50 | psf mode, $/SF/yr |
| Insurance | `ins` | number | 1.20 | 0–20 | psf mode |
| CAM | `cam` | number | 4.00 | 0–50 | psf mode |
| Other recoverables | `other` | number | 0 | 0–50 | psf mode, collapsed by default |
| Building area (RSF) | `bldg` | number | 10,000 | ≥ `sf` | totals mode |
| Annual taxes / insurance / CAM / other ($) | `taxT` `insT` `camT` `otherT` | number | 35,000 / 12,000 / 40,000 / 0 | ≥0 | totals mode |
| Admin fee on CAM (%) | `admin` | number | 0 | 0–25 | Tooltip: "Management/admin fee landlords add to CAM, typically 10–15%." |
| Base rent escalation (%/yr) | `esc` | number | 3 | 0–15 | |
| NNN growth assumption (%/yr) | `nnng` | number | 3 | 0–15 | Tooltip: "NNN charges float on actual expenses; this models expected growth." |
| Lease term (years) | `term` | number | 5 | 1–30 | |

### Outputs
- NNN charges: $/SF/yr, $/mo, $/yr (year 1)
- Total (gross-equivalent) rent: $/SF/yr, $/mo, $/yr (year 1)
- Pro-rata share % (totals mode only)
- Year-by-year table: base $/SF · NNN $/SF · gross $/SF · monthly $ · annual $
- Total lease obligation over term
- Stacked bar chart: base vs NNN per year
- ScenarioCompare enabled

### Formulas
```
basePSF(y)   = base × (1 + esc/100)^(y−1)
psf mode:    nnnPSF(1) = tax + ins + cam×(1 + admin/100) + other
totals mode: proRata   = sf / bldg
             nnnPSF(1) = (taxT + insT + camT×(1 + admin/100) + otherT) × proRata / sf
nnnPSF(y)    = nnnPSF(1) × (1 + nnng/100)^(y−1)
grossPSF(y)  = basePSF(y) + nnnPSF(y)
annual(y)    = grossPSF(y) × sf        monthly(y) = annual(y) / 12
totalObligation = Σ annual(y), y = 1..term
```

### Edge cases
- `sf > bldg` → error: `Leased area can't exceed building area.`
- `admin > 15` → non-blocking warning: `Admin fees above 15% are unusual — double-check the lease.`
- All currency fields ≥ 0; empty field = incomplete state, not 0.
- $/SF/mo unit toggle converts base AND all NNN rate fields consistently.

### Differentiators (must ship)
Scenario compare (two term sheets side by side) · full-term obligation number · escalation modeled separately for base and NNN · PDF export with year table · embed.

### Content outline
H2s: How triple net (NNN) leases work · How to calculate NNN cost per square foot · Worked example (defaults) · What's included in each "net" · Typical NNN expense ranges (Appendix A.5) · FAQ.
FAQ: What does NNN mean in a lease? · Is NNN paid monthly or annually? · What's a typical NNN charge per square foot? · Who pays for roof and structure in a triple net lease? · NNN vs gross lease — which is cheaper?

### Worked example (= test fixture `nnn.default`)
Defaults → NNN **$8.70/SF/yr**, gross **$32.70/SF/yr**, **$8,175/mo**, **$98,100/yr**; 5-yr total obligation (both escalating 3%) = **$520,826**.

---

## T2 — CAM Charges Calculator

**Route:** `/cam-calculator/`
**Primary keyword:** cam charges calculator · **Variants:** common area maintenance calculator, cam reconciliation calculator, cam fees commercial lease
**Meta title:** `CAM Charges Calculator — Pro-Rata Share & Reconciliation`
**Meta description:** `Work out your pro-rata CAM charges per SF and per month, model annual increases with caps, and reconcile estimated payments against actual year-end costs.`
**User & intent:** tenant checking a landlord's CAM bill or budgeting; landlord/PM setting estimates.

### Inputs

| Field | key | Type | Default | Range | Notes |
|---|---|---|---|---|---|
| Mode | `mode` | tabs | `estimate` | `estimate` \| `reconcile` | |
| Tenant area (SF) | `sf` | number | 2,500 | 100–2,000,000 | |
| Building GLA (SF) | `gla` | number | 25,000 | ≥ `sf` | |
| Total annual CAM ($) | `camT` | number | 125,000 | ≥0 | Accordion "Itemize" splits into: landscaping, snow removal, parking/lot repairs, common utilities, security, janitorial, other — sum overrides `camT` |
| Admin fee (%) | `admin` | number | 10 | 0–25 | |
| Annual CAM growth (%) | `growth` | number | 4 | 0–20 | estimate mode |
| Projection (years) | `years` | number | 5 | 1–15 | estimate mode |
| Annual CAM cap | `cap` | select | `none` | none \| annual | estimate mode |
| Cap (%/yr) | `capPct` | number | 5 | 0–15 | shown when cap = annual; ceilings each year's increase |
| Monthly estimate paid ($) | `paid` | number | 1,100 | ≥0 | reconcile mode |
| Months paid | `months` | number | 12 | 1–12 | reconcile mode |
| Actual annual CAM ($) | `actual` | number | 138,000 | ≥0 | reconcile mode |

### Outputs
- Estimate mode: pro-rata %, tenant CAM $/yr, $/SF/yr, $/mo; N-year table uncapped vs capped; cumulative savings from cap.
- Reconcile mode: tenant share of actuals, total paid, **balance due / credit** with plain-English verdict line.

### Formulas
```
proRata        = sf / gla
billed(1)      = camT × (1 + admin/100) × proRata
uncapped(y)    = billed(1) × (1 + growth/100)^(y−1)
annual cap:    allowed(1) = uncapped(1); allowed(y) = min(uncapped(y), allowed(y−1) × (1 + capPct/100))
               (single cap; ceilings each year's increase. v1.1: cumulative vs non-cumulative moved to §T6.)
reconcile:     share = actual × (1 + admin/100) × proRata
               balance = share − paid × months   (>0 due · <0 credit)
```

### Edge cases
- `sf > gla` → error: `Tenant area can't exceed building GLA.`
- Itemized sum of 0 with itemize open → incomplete state.
- Tooltip disclosure (verbatim): `Caps usually apply to controllable CAM only (excludes taxes, insurance, snow, utilities). v1 applies the cap to the full CAM figure — read your lease.`
- v1.1 backlog: controllable/uncontrollable split, occupancy gross-up. Cumulative vs non-cumulative cap compounding relocated to §T6 (needs the variable annual increases that §T6's schedules provide).

### Differentiators
Annual cap modeling on the projection · reconciliation verdict · itemized CAM accordion · CSV of projection table.

### Content outline
H2s: What CAM charges cover · How pro-rata share works · CAM caps: how an annual cap limits increases · Reconciliation: why your year-end bill differs · Typical CAM ranges & admin fees · FAQ.
FAQ: What is included in CAM charges? · How is my pro-rata share calculated? · What is a CAM reconciliation? · What is a typical CAM admin fee? · Can I negotiate a CAM cap?

### Worked example (= `cam.default`)
Estimate: pro-rata **10.00%**, billed **$13,750/yr** = **$5.50/SF/yr** = **$1,145.83/mo**.
Reconcile: share = 138,000 × 1.10 × 0.10 = **$15,180**; paid **$13,200**; **balance due $1,980**.

---

## T3 — TI Allowance & Amortization Calculator

**Route:** `/tenant-improvement-calculator/`
**Primary keyword:** tenant improvement allowance calculator · **Variants:** ti amortization calculator, ti allowance, amortized tenant improvements
**Meta title:** `Tenant Improvement Allowance & TI Amortization Calculator`
**Meta description:** `Size your TI allowance, compare it to buildout cost, and see the monthly rent add-on if the landlord amortizes the gap into the lease — with full schedule.`
**User & intent:** tenant/broker in LOI negotiation; wants (a) is the TI offer fair, (b) what does amortizing the shortfall cost.

### Inputs

Tab A — Allowance vs cost:

| Field | key | Default | Range | Notes |
|---|---|---|---|---|
| Space (SF) | `sf` | 3,000 | 100–500,000 | shared with Tab B |
| TI allowance ($/SF) | `tia` | 30 | 0–500 | |
| Estimated buildout cost ($/SF) | `cost` | 45 | 0–800 | |
| Space type | `type` | `office-2g` | office-2g \| office-wb \| medical \| retail \| restaurant \| industrial | drives benchmark band highlight (Appendix A.3) |

Tab B — Amortization:

| Field | key | Default | Range | Notes |
|---|---|---|---|---|
| Amount to amortize ($) | `p` | auto = gap from Tab A, editable | 0–10,000,000 | |
| Interest rate (%/yr) | `rate` | 8 | 0–20 | |
| Term (months) | `n` | 60 | 6–240 | |
| Lease term (months, optional) | `lease` | 60 | 6–240 | warning trigger only |

### Outputs
- Tab A: total allowance $, total cost $, **gap $ and $/SF**, benchmark verdict line ("Your $30/SF offer sits within the typical range for second-generation office").
- Tab B: **monthly payment**, rent impact **$/SF/yr**, total repaid, total interest, amortization schedule (accordion: month, payment, interest, principal, balance), CSV.

### Formulas
```
totalTIA = sf × tia        totalCost = sf × cost        gap = max(0, totalCost − totalTIA)
r = rate/100/12
PMT = r = 0 ? p / n : p × r / (1 − (1 + r)^−n)
rentAddPSFyr = PMT × 12 / sf
schedule: interest(m) = balance(m−1) × r; principal(m) = PMT − interest(m)
```

### Edge cases
- `gap = 0` → Tab A success state: `Your allowance covers the buildout — nothing to amortize.` Tab B stays usable with manual `p`.
- `n > lease` → warning: `Amortization longer than the lease term is rare — landlords typically match them.`
- `rate = 0` → straight-line PMT.

### Differentiators
Two linked modes (SERP has them only separately) · benchmark bands by space type · full schedule + CSV · rent-impact in $/SF/yr, the unit brokers actually negotiate in.

### Content outline
H2s: What a TI allowance is (and isn't) · Typical TI allowances by space type · When landlords amortize TI — and what it really costs · Worked example · Negotiation levers that move TI (term, credit, trading free rent) · FAQ.
FAQ: What is a typical tenant improvement allowance? · Is a TI allowance free money? · What does amortized TI mean? · What interest rate do landlords use to amortize TI? · Does TI allowance cover furniture?

### Worked example (= `ti.default`)
Tab A: allowance **$90,000**, cost **$135,000**, gap **$45,000** ($15/SF).
Tab B: p=45,000, 8%, 60 mo → PMT **$912.44/mo**, rent impact **$3.65/SF/yr**, total repaid **$54,746**, interest **$9,746**.

---

## T4 — Net Effective Rent Calculator

**Route:** `/net-effective-rent-calculator/`
**Primary keyword:** net effective rent calculator · **Variants:** effective rent calculator, NER commercial real estate, free rent calculator
**Meta title:** `Net Effective Rent Calculator — Free Rent, TI & Escalations`
**Meta description:** `Turn face rent into net effective rent: model free months, escalations, TI and concessions over the full term, straight-line or NPV. See the true deal economics.`
**User & intent:** broker/landlord comparing deal structures; tenant checking how good a "3 months free" offer really is.

### Inputs

| Field | key | Default | Range | Notes |
|---|---|---|---|---|
| Term (months) | `term` | 60 | 12–360 | |
| Area (SF) | `sf` | 5,000 | 100–2,000,000 | |
| Face rent ($/SF/yr) | `face` | 30 | 0–500 | |
| Escalation (%/yr) | `esc` | 3 | 0–15 | applied each 12-mo anniversary |
| Free rent (months) | `free` | 3 | 0–term−1 | abates base rent, applied at start of term at year-1 rate |
| TI allowance ($/SF) | `tia` | 30 | 0–500 | |
| Other concessions ($) | `conc` | 0 | ≥0 | moving allowance etc. |
| NPV mode | `npv` | off | toggle | advanced accordion |
| Discount rate (%/yr) | `disc` | 8 | 0–20 | NPV mode only |

### Outputs
- **NER $/SF/yr** (headline) + discount to face % ("18.8% below the $30 face rate")
- Total scheduled rent, free-rent value, TI + concessions, total collected
- Monthly rent timeline chart (shows the free-month gap and escalation steps)
- NPV mode: NPV of deal, NPV-equivalent NER
- ScenarioCompare enabled (this is THE compare-two-offers tool)

### Formulas
```
Month engine, m = 1..term:
scheduled(m) = face/12 × sf × (1 + esc/100)^floor((m−1)/12)
freeValue    = Σ scheduled(m) for m = 1..free
collected    = Σ scheduled(m) − freeValue
NER_straight ($/SF/yr) = (collected − tia×sf − conc) / (term/12) / sf

NPV mode: i = disc/100/12
NPV = −(tia×sf + conc) + Σ [ cash(m) / (1+i)^m ],  cash(m) = scheduled(m) or 0 if free
levelPmt = NPV × i / (1 − (1+i)^−term)
NER_npv ($/SF/yr) = levelPmt × 12 / sf
```

### Edge cases
- `free ≥ term` → error: `Free rent can't cover the whole term.`
- Negative NER (concessions exceed rent) → show value in fail color + line: `Concessions exceed total rent — this deal loses money on paper.`
- `disc = 0` → NPV equals straight-line; hide duplicate output.
- v1 models base rent only; tooltip: `NNN charges usually continue during free-rent periods; model them in the NNN calculator.` (contextual link to T1)

### Differentiators
Month-level engine (competitors do napkin math) · NPV toggle · timeline chart · scenario compare of two term sheets · landlord/tenant framing in content.

### Content outline
H2s: Face rent vs net effective rent · How free rent and TI change deal economics · Straight-line vs NPV effective rent · Worked example · How landlords use NER (and why face rates stay high) · FAQ.
FAQ: What is net effective rent? · How do I calculate NER with free rent? · Does NER include TI allowance? · Why do landlords give free rent instead of lower rent? · What discount rate should I use?

### Worked example (= `ner.default`)
Defaults → scheduled 5-yr rent **$796,370**, free value **$37,500**, collected **$758,870**; NER = (758,870 − 150,000)/5/5,000 = **$24.35/SF/yr**, **18.8% below face**.

---
## T5 — Load Factor Calculator

**Route:** `/load-factor-calculator/`
**Primary keyword:** load factor calculator · **Variants:** rentable vs usable square footage, loss factor calculator, core factor commercial real estate
**Meta title:** `Load Factor Calculator — Rentable vs Usable Square Feet`
**Meta description:** `Convert between usable and rentable square feet, get load and loss factors, and see what a quoted rate really costs per usable foot across two buildings.`
**User & intent:** tenant/broker touring space; confused by RSF vs USF; wants true cost comparison.

### Inputs

| Field | key | Default | Range | Notes |
|---|---|---|---|---|
| Solve for | `solve` | `lf` | `lf` \| `rsf` \| `usf` | segmented control |
| Usable SF | `usf` | 5,000 | 100–2,000,000 | hidden when solving for it |
| Rentable SF | `rsf` | — | ≥ `usf` | hidden when solving for it |
| Load factor (%) | `lf` | 15 | 0–60 | hidden when solving for it |
| Quoted rent ($/RSF/yr) | `rent` | 30 | 0–500 | cost-impact block |
| Compare mode | `cmp` | off | toggle | Building A vs B: each has `rent`, `lf`; shared USF |

### Outputs
- The solved value + both factors always shown: **load factor = RSF/USF − 1**, **loss factor = (RSF−USF)/RSF**
- Cost impact: effective **$/USF/yr** = rent × (1 + LF)
- Compare mode: table A vs B → effective $/USF each, winner highlight, delta $/yr on the tenant's USF

### Formulas
```
loadFactor = rsf/usf − 1        lossFactor = (rsf − usf)/rsf = LF/(1+LF)
rsf = usf × (1 + lf/100)        usf = rsf / (1 + lf/100)
effectivePerUSF = rent × (1 + lf/100)
```

### Edge cases
- `rsf < usf` → error: `Rentable SF is always ≥ usable SF.`
- `lf > 35` → warning: `Load factors above 35% are rare — verify the measurement standard (BOMA).`
- Terminology note in content: NYC quotes "loss factor," most markets quote "load factor" — both always displayed to catch both query intents.

### Differentiators
Solves in all three directions · shows both factor conventions · two-building comparison on cost-per-usable-foot (the actual decision) — no ranking page does this.

### Content outline
H2s: Usable vs rentable square feet · Load factor vs loss factor (the two conventions) · What a quoted rate really costs per usable foot · Comparing two buildings with different load factors · Typical load factors by building type · FAQ.
FAQ: What is a good load factor? · What's the difference between load factor and loss factor? · How is rentable square footage measured (BOMA)? · Why am I paying for space I can't use? · Do industrial leases have load factors?

### Worked example (= `lf.default`)
USF 5,000 @ 15% LF → RSF **5,750**, loss factor **13.04%**; $30/RSF quoted → effective **$34.50/USF/yr**.

---

## T6 — Rent Escalation Calculator

**Route:** `/rent-escalation-calculator/`
**Primary keyword:** rent escalation calculator · **Variants:** commercial rent increase calculator, rent escalation clause, CPI rent escalation
**Meta title:** `Rent Escalation Calculator — Fixed %, Steps & CPI Schedules`
**Meta description:** `Build the full rent schedule for any escalation clause: fixed percentage, fixed dollar steps, custom schedules or CPI with caps and floors. Export to CSV or PDF.`
**User & intent:** broker/tenant/landlord modeling a clause across a term; needs a schedule to paste into a proposal.

### Inputs

| Field | key | Default | Range | Notes |
|---|---|---|---|---|
| Escalation type | `type` | `pct` | `pct` \| `step` \| `cpi` \| `custom` | |
| Starting rent ($/SF/yr) | `start` | 28 | 0–500 | |
| Area (SF) | `sf` | 4,000 | 100–2,000,000 | |
| Term (years) | `term` | 10 | 1–30 | |
| Escalation (%/yr) | `pct` | 3 | 0–15 | type=pct |
| Step ($/SF) | `step` | 0.50 | 0–20 | type=step |
| Assumed CPI (%/yr) | `cpi` | 2.5 | 0–15 | type=cpi |
| CPI cap / floor (%) | `cap` `floor` | 4 / 2 | 0–15 | optional, type=cpi |
| Frequency (every N years) | `freq` | 1 | 1–5 | escalation applies every N years |
| Custom schedule | `sched` | — | — | editable per-year $/SF table, prefilled from `start` |
| Rent cap basis | `capMode` | `none` | none \| cumulative \| non-cumulative | v1.1; ceilings annual rent growth. Distinct from the CPI `cap`/`floor` rate clamp above |
| Rent cap (%/yr) | `capMax` | 5 | 0–15 | shown when `capMode` ≠ none |

### Formulas
```
periods elapsed at year y: k = floor((y−1)/freq)
pct:    rate(y) = start × (1 + pct/100)^k
step:   rate(y) = start + step × k
cpi:    g = clamp(cpi, floor, cap); rate(y) = start × (1 + g/100)^k
        (v1 uses a constant assumed CPI; content explains actual-CPI true-ups)
custom: rate(y) = sched[y]
rent cap (v1.1, applied to the uncapped rate(y) series above):
  non-cumulative: allowed(1)=rate(1); allowed(y)=min(rate(y), allowed(y−1) × (1+capMax/100))
  cumulative:     allowed(y)=min(rate(y), allowed(1) × (1+capMax/100)^(y−1))
  (the two bases only diverge when rate(y) is uneven — i.e. `custom`, or future actual-CPI)
annual(y) = rate(y) × sf     total = Σ annual(y)     avgRate = total / term / sf
```

### Outputs
Year-by-year table (year, $/SF, Δ%, $/mo, $/yr) · total obligation · average rate · line chart · CSV + PDF.

### Edge cases
- `cap < floor` → error: `CPI cap must be ≥ the floor.`
- `step` cannot take rate below 0 (clamp with warning).
- Custom table rows = `term`; blank row → incomplete state.

### Differentiators
All four clause types in one tool (SERP tools do fixed % only) · every-N-years frequency · export-ready schedule.

**v1.1 (relocated from §T2):** cumulative vs non-cumulative cap compounding lives here — with variable per-year increases (custom schedules, uneven CPI) the two bases genuinely diverge. cumulative caps the ceiling off year 1 on a fixed `(1+capMax/100)^(y−1)` path (banking unused headroom); non-cumulative caps each year's increase off the prior year's capped value. Implemented via the `capMode`/`capMax` inputs above, reusing `applyCap` from `src/calc-core/cam.ts`. Under the deterministic `pct`/`step`/constant-`cpi` types the two bases coincide (monotonic series); they diverge on `custom` schedules.

### Content outline
H2s: The four common escalation structures · Fixed vs CPI: who carries inflation risk · Caps, floors and how they're negotiated · Worked example · Reading an escalation clause (sample language) · FAQ.
FAQ: What is a typical commercial rent escalation? · How does a CPI escalation clause work? · What is a rent escalation cap? · Are escalations negotiable? · Do escalations apply to NNN charges too?

### Worked example (= `esc.default`)
$28 start, 3%/yr, 10 yrs, 4,000 SF → year-10 rate **$36.53/SF**, total obligation **$1,283,954**.

---

## T7 — Cap Rate Calculator (hub)

**Route:** `/cap-rate-calculator/`
**Primary keyword:** cap rate calculator · **Variants:** capitalization rate calculator, cap rate formula, property value from NOI
**Meta title:** `Cap Rate Calculator — Solve Cap Rate, Value or Required NOI`
**Meta description:** `Solve any side of the cap rate equation, build NOI from income and expenses, and stress-test value with a cap rate × NOI sensitivity matrix.`
**User & intent:** investor/broker screening a deal or backing into value/required NOI.

### Inputs

| Field | key | Default | Range | Notes |
|---|---|---|---|---|
| Solve for | `solve` | `cap` | `cap` \| `value` \| `noi` | tabs |
| NOI ($/yr) | `noi` | 150,000 | −10M–100M | manual, or from builder |
| Property value ($) | `value` | 2,000,000 | 1–1B | |
| Cap rate (%) | `cap` | 7.5 | 0.5–20 | |
| **NOI builder (accordion):** GPR `gpr` 200,000 · other income `oi` 5,000 · vacancy % `vac` 5 · taxes `tx` 22,000 · insurance `insx` 6,000 · utilities `ut` 9,000 · repairs `rep` 8,000 · reserves `res` 3,000 · management (% of EGI) `mgmt` 4 |

### Formulas
```
cap = NOI / value × 100      value = NOI / (cap/100)      NOI = value × cap/100
Builder: EGI = gpr × (1 − vac/100) + oi
         mgmt$ = EGI × mgmt/100
         NOI = EGI − (tx + insx + ut + rep + res) − mgmt$
Sensitivity matrix: rows cap 4.5%..9.0% step 0.5; cols NOI −10%, −5%, base, +5%, +10%; cell = value
```

### Edge cases
- `value ≤ 0` → error. `cap` outside 2–15% → warning: `Cap rates outside 2–15% are unusual — check inputs.`
- Negative NOI → cap shown in fail color with line: `Negative NOI: the property loses money before debt service.`
- Vacancy applies to GPR only (tooltip states this).

### Differentiators
Three-way solver · integrated NOI builder (competitors link a separate page) · sensitivity matrix — the screenshot-able asset that earns links · asset-class benchmark table.

### Content outline
H2s: The cap rate formula, three ways · Building NOI correctly (what's excluded) · What cap rates mean for value: sensitivity · Typical cap rates by asset class (Appendix A.1, `last_reviewed` shown) · Cap rate limits: what it ignores (leverage, capex, growth) · FAQ.
FAQ: What is a good cap rate? · How do I calculate cap rate from NOI? · Does cap rate include mortgage payments? · Why do lower cap rates mean higher prices? · Cap rate vs cash-on-cash return?

### Worked example (= `cap.default`)
150,000 / 2,000,000 = **7.50%**. Builder example: EGI 195,000; mgmt 7,800; NOI **$139,200**.

---

## T8 — DSCR Calculator (hub)

**Route:** `/dscr-calculator/`
**Primary keyword:** dscr calculator · **Variants:** debt service coverage ratio calculator, dscr loan calculator, max loan from noi
**Meta title:** `DSCR Calculator — Debt Service Coverage & Max Loan Sizing`
**Meta description:** `Calculate DSCR from NOI and debt service, build the payment from loan terms, and solve the maximum loan a property supports at any target coverage ratio.`
**User & intent:** investor pre-underwriting a loan; broker sanity-checking leverage; wants the max-loan number lenders won't show them.

### Inputs

| Field | key | Default | Range | Notes |
|---|---|---|---|---|
| NOI ($/yr) | `noi` | 180,000 | 0–100M | link: "Need NOI? Build it in the Cap Rate calculator" |
| Debt input mode | `dmode` | `build` | `build` \| `direct` | |
| Annual debt service ($) | `ds` | — | >0 | direct mode |
| Loan amount ($) | `loan` | 1,500,000 | 1–1B | build mode |
| Interest rate (%/yr) | `rate` | 6.75 | 0–20 | |
| Amortization (years) | `am` | 25 | 1–40 | |
| Interest-only | `io` | off | toggle | |
| Target DSCR (max-loan solver) | `target` | 1.25 | 1.0–2.5 | |

### Formulas
```
r = rate/100/12   n = am × 12
PMT = r = 0 ? loan/n : loan × r / (1 − (1+r)^−n)
annualDS = io ? loan × rate/100 : PMT × 12
DSCR = NOI / annualDS      (display: 2 decimals + "x")
Max loan: maxDS = NOI / target
  amortizing: maxLoan = (maxDS/12) × (1 − (1+r)^−n) / r     (r=0 → maxDS/12 × n)
  IO:         maxLoan = maxDS / (rate/100)
```

### Outputs
- **DSCR** with gauge bands: <1.00 fail (`Property doesn't cover the debt`) · 1.00–1.19 thin · 1.20–1.24 near typical minimum · 1.25–1.39 bankable · ≥1.40 strong
- Monthly & annual debt service
- **Max supportable loan** at target DSCR + the delta vs entered loan ("You're $236,840 under the max at 1.25x")
- ScenarioCompare enabled (two loan quotes)

### Edge cases
- `io=on` and `rate=0` → error: `Interest-only at 0% has no debt service.`
- `annualDS = 0` guard → incomplete state.
- Negative/zero NOI → DSCR `N/A` + fail line.

### Differentiators
Max-loan solver (the number people actually want; SERP pages stop at the ratio) · IO toggle · payment builder + direct mode · lender-threshold gauge · scenario compare.

### Content outline
H2s: What DSCR measures and why lenders anchor on it · Building debt service from loan terms (amortizing vs IO) · Minimum DSCRs by property type (Appendix A.2) · Solving the max loan from NOI · Levers that improve DSCR · FAQ.
FAQ: What is a good DSCR? · What DSCR do lenders require? · How do I calculate DSCR with interest-only? · Does DSCR include taxes and insurance? · How can I increase my DSCR?

### Worked example (= `dscr.default`)
Loan $1.5M @ 6.75%, 25-yr am → PMT **$10,363.67/mo**, annual DS **$124,364**; DSCR = 180,000/124,364 = **1.45x**. Max loan @1.25x target = **$1,736,836**.

---
# Appendix A — Benchmark content (directional, editorial)

All figures below are directional mid-2026 US ranges for the explainer tables. Anton reviews before publish; each page's frontmatter carries `last_reviewed: YYYY-MM-DD` rendered as "Benchmarks reviewed {date}". Refresh quarterly — it's a freshness signal and a repeat-visit hook.

**A.1 Cap rates by asset class (stabilized, national ranges; sources: CBRE 2026 U.S. Real Estate Outlook, CBRE H2 2025 Cap Rate Survey, Q1 2026 net-lease reports; reviewed 2026-07-08):** multifamily 4.5–6.5% (Class A ~4.5–5.5%; secondary markets higher) · industrial 4.5–6.5% (tightest range; big-box ~5.5–7.0%, flex higher) · single-tenant NNN retail 5.0–7.0% (overall STNL ~6.8%; trophy tenants sub-5%) · retail centers 6.5–9.0% (anchored 6.5–8.0%, strip 7.0–9.0%) · office 6.0–11% (widest/most split — Class A CBD 6.0–8.0%, Class B 8.5–11%, Class C 8.7–9.4%) · medical office 6.0–7.5% · self-storage 5.5–7.0% · net lease (investment grade) 5.0–6.5% · hotel 7.0–10%+ (widest variation by brand/quality). CBRE projects 5–15 bps compression across most types in 2026; ranges vary by market tier — primary markets run 75–150 bps below tertiary.

**A.2 Minimum DSCR by property type (2026 lender ranges; sources: Commercial Loan Direct, Clearhouse, CLS CRE, Cor Advisors; reviewed 2026-07-08):** most CRE loans require 1.20–1.35x minimum, best terms above 1.35x. Multifamily (agency Fannie/Freddie) 1.20–1.25x · industrial 1.20–1.25x (lender-favored) · retail 1.25–1.40x (grocery-anchored lower, specialty/lifestyle higher) · office 1.35–1.50x (tightened sharply on vacancy concerns; CBD non-trophy higher) · hotel/self-storage 1.40–1.60x (income volatility) · SBA owner-user 504/7a 1.15–1.25x (evaluates global cash flow) · credit-tenant NNN lease as low as 1.05x.

**A.3 TI allowance ranges ($/SF) — landlord contribution, NOT buildout cost (sources: Cauble Group, Terrapin CG, NextGen Properties, LoopNet; reviewed 2026-07-08):** second-gen office 15–40 · Class A / new office white box 60–100+ (high-vacancy markets like SF reach 120–135) · first-gen ground-up office 30–60 · medical office 60–130 (specialized MEP) · retail local/vanilla shell 20–50 · retail national credit tenant 80–150 · restaurant 40–100 (when the landlord wants the food anchor) · industrial/flex 5–20. Buildout cost runs far higher (e.g. restaurant 200–500 $/SF vs a 40–100 allowance); the gap is tenant-funded or amortized into rent. TI is not free money — landlords recoup via higher rent and/or longer term, and bigger allowances follow longer terms and stronger tenant credit.

**A.4 Load factors (sources: CommercialCafe, commercialrealestate.loans, Wiss, SVN, Re-Leased; reviewed 2026-07-08):** single-tenant/efficient 8–12% · multi-tenant office (typical) 10–25% · heavy-amenity 25%+ (unusual — investigate) · industrial 0–5%. BOMA 2024 is the current standard: it now counts some outdoor amenity space as rentable, and tenant balconies/terraces no longer carry a load factor. "Loss factor" is NYC/tristate usage; "load factor" is standard in most other US markets.

**A.5 NNN expense ranges ($/SF/yr) — market-dependent estimates, not fixed (sources: CommercialCafe, commercialrealestate.loans, Wiss, SVN, Re-Leased; reviewed 2026-07-08):** property taxes 0.50–6.00+ (varies widely by jurisdiction) · insurance 0.05–1.00+ (coastal/FL higher) · CAM 1.00–6.00 retail (fixed-rate CAM often ~$4.25/SF/yr), lower for industrial · CAM admin fee 10–15% (well-established norm).

**A.6 Escalations (sources: CommercialCafe, commercialrealestate.loans, Wiss, SVN, Re-Leased; reviewed 2026-07-08):** fixed 2.5–3.5%/yr standard (~3% most common); CPI-indexed usually capped 3–5% annually with 1.5–2.5% floors. Cumulative caps let the landlord bank unused escalation from low-inflation years and apply it later (causing sudden jumps); non-cumulative limits each year to the ceiling with no carryover — over a 10-year term the difference is meaningful dollars, so tenants seeking budget predictability push for non-cumulative.

---

# Appendix B — Build order & Definition of Done

**Wave 1 — architecture proof (goal: 2 pages fully done end-to-end):**
1. Repo scaffold per §2–§5, calc-core + Vitest wired, CI on push.
2. T5 Load Factor (simplest engine) → validates CalcShell, URL state, embed, PDF, schema.
3. T1 NNN (modes, year table, scenario compare, chart) → validates the heavy components.

**Wave 2:** T3 → T2 → T6 → T4 (reuses year-table + month engine patterns).
**Wave 3:** T7 → T8 (hubs; sensitivity grid + gauge), then home + category hubs, sitemap, OG image template, analytics, consent, AdSlot flag.

**Definition of Done per tool page — all must pass:**
- [ ] calc-core tests green, including the Worked example fixture (exact numbers)
- [ ] All edge-case error strings implemented verbatim
- [ ] URL params round-trip (set inputs → copy link → open incognito → same state)
- [ ] Embed mode renders and iframe snippet copies
- [ ] Print stylesheet produces a clean 1-page PDF with inputs + results + year table
- [ ] Lighthouse (mobile): Performance ≥ 95, CLS < 0.05, no console errors
- [ ] Schema validates (Rich Results test): WebApplication + FAQPage + BreadcrumbList
- [ ] Meta title/description from spec; single H1; canonical set
- [ ] Content .mdx present (600–900 words) with 3+ contextual internal links
- [ ] Keyboard-only pass: every input reachable, results announced (aria-live on primary metric)

---

# Appendix C — Claude Code kickoff prompts

**C.1 Scaffold prompt (run once):**

```xml
<role>You are a senior frontend engineer building a static calculator site.</role>
<context>Full specification is in SPEC.md at the repo root. Read §1–§10 before writing anything. Stack: Astro 5 + React islands + TypeScript + Tailwind + Vitest. Static output for Cloudflare Pages. Design tokens arrive later — use CSS variables with neutral placeholder values.</context>
<task>Scaffold the project: repo structure, calc-core package with test setup, CalcShell / NumberInput / UnitToggle / ResultCard shared components (§5), page layout template (§4), URL-state hook (§3), sitemap + robots + JSON-LD utilities (§8), AdSlot behind ADS_ENABLED flag (§9). Do not implement any tool yet.</task>
<format>First output the file tree with one-line purpose per file and wait for my confirmation. Then generate files. Conventional commits.</format>
```

**C.2 Per-tool prompt (template, one tool per session):**

```xml
<task>Implement Tool {N} exactly per SPEC.md §T{N}: calc-core module with types, DEFAULTS and guard errors; Vitest test using the Worked example fixture; the page at the specified route using shared components; content stub as .mdx with the H2 outline and FAQ questions from the spec.</task>
<format>Order: 1) calc-core + tests (show tests passing), 2) island component, 3) page + mdx stub. Ask zero questions if the spec answers it; flag genuine spec gaps as TODO comments referencing the section.</format>
```

**C.3 Known open items (Anton decides, not Claude Code):** site name + domain · design tokens · OG template art direction · analytics ID · final FAQ answer copy (drafts get generated, Anton edits).
