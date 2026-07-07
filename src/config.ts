import type { ToolMeta } from './lib/types';

// TODO(owner): replace with the purchased domain/name (SPEC.md Appendix C.3 #1).
export const SITE_NAME = 'TODO_SITE_NAME';
export const DOMAIN = 'https://TODO-DOMAIN.example';

// Flip to true once an ad network is wired up (SPEC.md §6).
export const ADS_ENABLED = false;

// Tool registry — the single source of truth for hub links, sitemap coverage,
// and related-tool cross-links. SPEC.md Appendix A: "Architecture must not
// assume 8 tools anywhere."
export const TOOL_REGISTRY: ToolMeta[] = [
  {
    slug: 'load-factor-calculator',
    name: 'Load Factor Calculator',
    primaryKeyword: 'load factor calculator',
    shortDescription: 'Convert between rentable and usable square feet and see the real cost per usable SF.',
    status: 'planned',
  },
  {
    slug: 'triple-net-lease-calculator',
    name: 'Triple Net (NNN) Lease Calculator',
    primaryKeyword: 'triple net lease calculator',
    shortDescription: 'Add base rent, taxes, insurance, and CAM to see the true all-in cost of an NNN lease.',
    status: 'planned',
  },
  {
    slug: 'cam-charges-calculator',
    name: 'CAM Charges Calculator',
    primaryKeyword: 'CAM charges calculator',
    shortDescription: 'Estimate your pro-rata share of common area maintenance and reconcile year-end true-ups.',
    status: 'planned',
  },
  {
    slug: 'ti-allowance-amortization-calculator',
    name: 'TI Allowance Amortization Calculator',
    primaryKeyword: 'TI allowance amortization calculator',
    shortDescription: 'Amortize tenant improvement costs into rent and see the full monthly payment schedule.',
    status: 'planned',
  },
  {
    slug: 'net-effective-rent-calculator',
    name: 'Net Effective Rent Calculator',
    primaryKeyword: 'net effective rent calculator',
    shortDescription: 'Turn face rent, free rent, and TI concessions into a single effective rent figure.',
    status: 'planned',
  },
  {
    slug: 'rent-escalation-calculator',
    name: 'Rent Escalation Calculator',
    primaryKeyword: 'rent escalation calculator',
    shortDescription: 'Project year-by-year rent growth under fixed-percentage or fixed-step escalations.',
    status: 'planned',
  },
  {
    slug: 'percentage-rent-calculator',
    name: 'Percentage Rent Calculator',
    primaryKeyword: 'percentage rent calculator',
    shortDescription: 'Find the natural breakpoint and calculate percentage rent owed on top of base rent.',
    status: 'planned',
  },
  {
    slug: 'parking-ratio-calculator',
    name: 'Parking Ratio Calculator',
    primaryKeyword: 'parking ratio calculator',
    shortDescription: 'Check parking spaces per 1,000 SF against typical benchmarks, or size required spaces.',
    status: 'planned',
  },
];
