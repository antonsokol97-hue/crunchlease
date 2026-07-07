import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { DOMAIN } from './src/config.ts';

// https://astro.build/config
export default defineConfig({
  site: DOMAIN,
  output: 'static',
  // Inline the (small) bundled CSS into each page so it isn't a render-blocking
  // request — the whole stylesheet is ~10KB (Lighthouse render-blocking fix).
  build: { inlineStylesheets: 'always' },
  integrations: [
    react(),
    mdx(),
    // Keep chrome-less embed routes out of the sitemap — they're noindex (SPEC.md §3).
    sitemap({ filter: (page) => !/\/embed\/?$/.test(page) }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
