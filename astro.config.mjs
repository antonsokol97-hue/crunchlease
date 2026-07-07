import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { DOMAIN } from './src/config.ts';

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: DOMAIN,
  output: 'static',

  integrations: [
    react(),
    mdx(),
    // Keep chrome-less embed routes out of the sitemap — they're noindex (SPEC.md §3).
    sitemap({ filter: (page) => !/\/embed\/?$/.test(page) }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare()
});