import type { ToolMeta } from './lib/types';

// TODO(owner): replace with the purchased domain/name (SPEC.md Appendix C.3 #1).
export const SITE_NAME = 'TODO_SITE_NAME';
export const DOMAIN = 'https://TODO-DOMAIN.example';

// Flip to true once an ad network is wired up (SPEC.md §9).
export const ADS_ENABLED = false;

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
    status: 'planned',
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
    status: 'planned',
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
    status: 'planned',
  },
  {
    slug: 'cap-rate-calculator',
    name: 'Cap Rate Calculator',
    category: 'investment',
    primaryKeyword: 'cap rate calculator',
    shortDescription: 'Solve cap rate, value, or required NOI, and stress-test value with a sensitivity matrix.',
    status: 'planned',
  },
  {
    slug: 'dscr-calculator',
    name: 'DSCR Calculator',
    category: 'investment',
    primaryKeyword: 'dscr calculator',
    shortDescription: 'Calculate debt service coverage and solve the maximum loan a property supports.',
    status: 'planned',
  },
];

/** Look up a tool's metadata by slug. */
export function getTool(slug: string): ToolMeta | undefined {
  return TOOL_REGISTRY.find((tool) => tool.slug === slug);
}
