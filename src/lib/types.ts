/** Metadata for one entry in the tool registry (src/config.ts). */
export type ToolMeta = {
  slug: string;
  name: string;
  primaryKeyword: string;
  shortDescription: string;
  status: 'planned' | 'live';
};

/** One FAQ question/answer pair, rendered by Faq.astro and used to build FAQPage JSON-LD. */
export type FaqEntry = {
  question: string;
  answer: string;
};

/** One crumb in a BreadcrumbList. */
export type BreadcrumbItem = {
  name: string;
  url: string;
};
