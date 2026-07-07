import type { ToolCategory, ToolMeta } from './lib/types';

export const SITE_NAME = 'CrunchLease';
export const DOMAIN = 'https://crunchlease.com';

// TODO(owner): GA4 measurement ID (SPEC.md §10, Appendix C.3 #4). Empty = no
// analytics load even after consent.
export const GA_MEASUREMENT_ID = '';

// Search Console verification token (SPEC.md §8). Empty = no verification meta
// tag is emitted. Paste the token from the "HTML tag" method once verifying.
export const SEARCH_CONSOLE_VERIFICATION = '';

// Flip to true once an ad network is wired up (SPEC.md §9).
export const ADS_ENABLED = false;

// Category hub metadata (SPEC.md §1). Drives the /lease-calculators/ and
// /investment-calculators/ index pages and the tool breadcrumb.
export const CATEGORY_META: Record<ToolCategory, { name: string; slug: string; blurb: string }> = {
  lease: {
    name: 'Lease Calculators',
    slug: 'lease-calculators',
    blurb: 'Tenant- and landlord-side tools for pricing and comparing commercial leases.',
  },
  investment: {
    name: 'Investment Calculators',
    slug: 'investment-calculators',
    blurb: 'Underwriting tools for screening deals — value, returns, and loan sizing.',
  },
};

/** Tools in a category, in registry (T-number) order. */
export function toolsByCategory(category: ToolCategory): ToolMeta[] {
  return TOOL_REGISTRY.filter((tool) => tool.category === category);
}

// Tool registry — the single source of truth for hub links, sitemap coverage,
// and related-tool cross-links (SPEC.md §1). Order matches the T1–T8 numbering
// in the spec; slugs are the routes from §1's product-scope table.
export const TOOL_REGISTRY: ToolMeta[] = [
  {
    slug: 'nnn-lease-calculator',
    name: 'Triple Net (NNN) Lease Calculator',
    category: 'lease',
    primaryKeyword: 'triple net lease calculator',
    shortDescription: 'Add base rent, taxes, insurance, and CAM to see the true all-in cost of an NNN lease.',
    status: 'live',
  },
  {
    slug: 'cam-calculator',
    name: 'CAM Charges Calculator',
    category: 'lease',
    primaryKeyword: 'cam charges calculator',
    shortDescription: 'Estimate your pro-rata share of common area maintenance and reconcile year-end true-ups.',
    status: 'live',
  },
  {
    slug: 'tenant-improvement-calculator',
    name: 'TI Allowance & Amortization Calculator',
    category: 'lease',
    primaryKeyword: 'tenant improvement allowance calculator',
    shortDescription: 'Size a TI allowance against buildout cost and amortize the gap into monthly rent.',
    status: 'live',
  },
  {
    slug: 'net-effective-rent-calculator',
    name: 'Net Effective Rent Calculator',
    category: 'lease',
    primaryKeyword: 'net effective rent calculator',
    shortDescription: 'Turn face rent, free rent, and TI concessions into a single effective rent figure.',
    status: 'live',
  },
  {
    slug: 'load-factor-calculator',
    name: 'Load Factor Calculator',
    category: 'lease',
    primaryKeyword: 'load factor calculator',
    shortDescription: 'Convert between rentable and usable square feet and see the real cost per usable SF.',
    status: 'live',
  },
  {
    slug: 'rent-escalation-calculator',
    name: 'Rent Escalation Calculator',
    category: 'lease',
    primaryKeyword: 'rent escalation calculator',
    shortDescription: 'Project year-by-year rent growth under fixed %, step, CPI, or custom escalations.',
    status: 'live',
  },
  {
    slug: 'cap-rate-calculator',
    name: 'Cap Rate Calculator',
    category: 'investment',
    primaryKeyword: 'cap rate calculator',
    shortDescription: 'Solve cap rate, value, or required NOI, and stress-test value with a sensitivity matrix.',
    status: 'live',
  },
  {
    slug: 'dscr-calculator',
    name: 'DSCR Calculator',
    category: 'investment',
    primaryKeyword: 'dscr calculator',
    shortDescription: 'Calculate debt service coverage and solve the maximum loan a property supports.',
    status: 'live',
  },
];

/** Look up a tool's metadata by slug. */
export function getTool(slug: string): ToolMeta | undefined {
  return TOOL_REGISTRY.find((tool) => tool.slug === slug);
}
